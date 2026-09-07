import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/user-notice.ts", () => ({ showPlainNotice: vi.fn() }));
vi.mock("../src/write-global-vsix.ts", () => ({ registerApplyLatestCommand: vi.fn() }));

import { docsSkillPath, isMcpRegistered, mcpScriptPath, registerMcp } from "../src/mcp-register.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function seed() {
  const root = await mkdtemp(path.join(tmpdir(), "aidlc-registration-"));
  roots.push(root);
  const skill = path.join(root, "skill.md");
  await writeFile(
    skill,
    "---\nname: aidlc-guide-docs\ndescription: documentation lookup\n---\nRead and cite.\n",
  );
  return { root, skill };
}

describe("MCP and automatic documentation skill registration", () => {
  it("rejects missing targets under outside junctions before writing any config", async () => {
    const { root, skill } = await seed();
    const { root: outside } = await seed();
    await symlink(outside, path.join(root, ".cursor"), "junction");
    expect(await registerMcp(root, "server.mjs", skill)).toHaveProperty(
      "reason",
      "mcp-path-outside-workspace",
    );
    await expect(readFile(path.join(root, ".mcp.json"))).rejects.toHaveProperty("code", "ENOENT");
    const { root: other } = await seed();
    await mkdir(path.join(other, ".claude"));
    await symlink(outside, path.join(other, ".claude/skills"), "junction");
    expect(await registerMcp(other, "server.mjs", skill)).toHaveProperty(
      "reason",
      "docs-skill-outside-workspace",
    );
    expect(await registerMcp(other, "server.mjs", path.join(other, "missing.md"))).toHaveProperty(
      "reason",
      "registration-io-error:ENOENT",
    );
  });
  it("registers both clients, preserves other servers, and updates owned skills", async () => {
    const { root, skill } = await seed();
    await writeFile(
      path.join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { other: { command: "other" } }, preserved: true }),
    );
    expect(await registerMcp(root, "C:\\extension\\dist\\aidlc-mcp.mjs", skill)).toEqual({
      ok: true,
    });
    const claude = JSON.parse(await readFile(path.join(root, ".mcp.json"), "utf8"));
    const cursor = JSON.parse(await readFile(path.join(root, ".cursor/mcp.json"), "utf8"));
    expect(claude.mcpServers.other.command).toBe("other");
    expect(claude.preserved).toBe(true);
    expect(cursor.mcpServers["aidlc-guide"]).toEqual(claude.mcpServers["aidlc-guide"]);
    expect(cursor.mcpServers["aidlc-guide"].args[1]).toBe("C:/extension/dist/aidlc-mcp.mjs");
    expect(await isMcpRegistered(root)).toBe(true);
    await writeFile(
      skill,
      "---\nname: aidlc-guide-docs\ndescription: revised\n---\nRevised lookup.\n",
    );
    expect(await registerMcp(root, "new.mjs", skill)).toEqual({ ok: true });
    for (const harness of [".claude", ".cursor"]) {
      const installed = await readFile(
        path.join(root, harness, "skills/aidlc-guide-docs/SKILL.md"),
        "utf8",
      );
      expect(installed).toContain("Revised lookup.");
      expect(installed).toMatch(/^---\n/);
    }
  });

  it("refuses a user-edited skill before changing either MCP config", async () => {
    const { root, skill } = await seed();
    await registerMcp(root, "old.mjs", skill);
    const before = await readFile(path.join(root, ".mcp.json"), "utf8");
    const target = path.join(root, ".claude/skills/aidlc-guide-docs/SKILL.md");
    await writeFile(target, `${await readFile(target, "utf8")}User edits.\n`);
    expect(await registerMcp(root, "new.mjs", skill)).toHaveProperty("ok", false);
    expect(await readFile(path.join(root, ".mcp.json"), "utf8")).toBe(before);
    expect(await readFile(target, "utf8")).toContain("User edits.");
  });

  it.each(["null", "[]", '{"mcpServers":null}', '{"mcpServers":[]}', "{broken"])(
    "rejects malformed config %s",
    async (raw) => {
      const { root, skill } = await seed();
      await writeFile(path.join(root, ".mcp.json"), raw);
      expect(await registerMcp(root, "server.mjs", skill)).toHaveProperty(
        "reason",
        "invalid-mcp-json",
      );
      expect(await readFile(path.join(root, ".mcp.json"), "utf8")).toBe(raw);
    },
  );

  it("resolves installed bundles and skills without sibling workspace packages", async () => {
    const { root } = await seed();
    expect(mcpScriptPath(root)).toBe(path.join(root, "../mcp-server/src/index.ts"));
    expect(docsSkillPath(root)).toBe(
      path.join(root, "../mcp-server/skills/aidlc-guide-docs/SKILL.md"),
    );
    await mkdir(path.join(root, "dist"));
    await mkdir(path.join(root, "media/aidlc-guide-docs"), { recursive: true });
    await writeFile(path.join(root, "dist/aidlc-mcp.mjs"), "");
    await writeFile(path.join(root, "media/aidlc-guide-docs/SKILL.md"), "");
    expect(mcpScriptPath(root)).toBe(path.join(root, "dist/aidlc-mcp.mjs"));
    expect(docsSkillPath(root)).toBe(path.join(root, "media/aidlc-guide-docs/SKILL.md"));
    expect(await isMcpRegistered(root)).toBe(false);
  });
});
