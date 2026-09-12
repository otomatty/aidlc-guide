import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyHarnessCandidate,
  GUIDE_INSTALL_FILE,
  planHarnessCandidate,
} from "../src/native-harness-merge.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function temp(): string {
  const root = mkdtempSync(path.join(tmpdir(), "aidlc-harness-merge-"));
  roots.push(root);
  return root;
}

function write(root: string, relative: string, text: string): void {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function read(root: string, relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

function hash(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

const skillPath = ".cursor/skills/aidlc/SKILL.md";
const dataDir = ".cursor/tools/data";
const memoryPath = "aidlc/spaces/default/memory/org.md";

function candidate(version = "2.8.0", skill = "Cursor workflow\n"): string {
  const root = temp();
  const stamp = {
    schemaVersion: 1,
    frameworkVersion: version,
    distribution: "cursor",
    harnessDir: ".cursor",
  };
  const projection = {
    schemaVersion: 1,
    distribution: "cursor",
    productName: "Cursor",
    configNextStep: "Open Cursor and run /aidlc --doctor",
    harnessDir: ".cursor",
    managedDirectories: [".cursor", "aidlc"],
    rootIntegrations: [
      { path: ".gitignore", policy: "managed-block", marker: "gitignore" },
      { path: "AGENTS.md", policy: "managed-block", marker: "agents" },
      { path: "install.ts", policy: "whole-file" },
    ],
  };
  const managed: Record<string, string> = {
    [skillPath]: skill,
    ".cursor/tools/aidlc-version.ts": `export const AIDLC_VERSION = "${version}";\n`,
    [`${dataDir}/aidlc-stamp.json`]: JSON.stringify(stamp),
    [`${dataDir}/aidlc-projection.json`]: JSON.stringify(projection),
  };
  for (const [relative, text] of Object.entries(managed)) write(root, relative, text);
  const ignore = "# BEGIN AI-DLC:gitignore\n.cursor/cache\n# END AI-DLC:gitignore";
  const agents = "<!-- BEGIN AI-DLC:agents -->\nUse Cursor for AI-DLC.\n<!-- END AI-DLC:agents -->";
  const installer = "// Cursor installer\n";
  write(root, ".gitignore", `${ignore}\n`);
  write(root, "AGENTS.md", `${agents}\n`);
  write(root, "install.ts", installer);
  write(root, memoryPath, "Framework method\n");
  write(root, "aidlc/active-space", "default\n");
  write(
    root,
    `${dataDir}/aidlc-manifest.json`,
    JSON.stringify({
      ...stamp,
      mcpMode: "none",
      files: Object.fromEntries(
        Object.entries(managed).map(([relative, text]) => [relative, hash(text)]),
      ),
      rootContributions: {
        ".gitignore": { policy: "managed-block", hash: hash(ignore), marker: "gitignore" },
        "AGENTS.md": { policy: "managed-block", hash: hash(agents), marker: "agents" },
        "install.ts": { policy: "whole-file", hash: hash(installer) },
      },
    }),
  );
  return root;
}

describe("native harness candidate merge", () => {
  it("adds Cursor alongside Claude while preserving complete root files and workflow records", async () => {
    const source = candidate();
    const root = temp();
    const ignore =
      "# user ignores\r\nsecrets/\r\n# BEGIN AI-DLC:gitignore\r\n.claude/cache\r\n# END AI-DLC:gitignore";
    const agents =
      "# Team instructions\r\nCustom rules.\r\n<!-- BEGIN AIDLC CURSOR -->\r\nLegacy instructions.\r\n<!-- END AIDLC CURSOR -->";
    write(root, ".gitignore", ignore);
    write(root, "AGENTS.md", agents);
    write(root, ".claude/skills/aidlc/SKILL.md", "Existing Claude workflow\n");
    write(root, "aidlc/spaces/default/intents/current/aidlc-state.md", "Active stage\n");

    await applyHarnessCandidate(source, root, "cursor", "2.8.0");

    expect(read(root, ".gitignore").endsWith(ignore)).toBe(true);
    expect(read(root, ".gitignore")).toContain("# BEGIN AI-DLC:guide-cursor-gitignore");
    expect(read(root, "AGENTS.md").startsWith(agents)).toBe(true);
    expect(read(root, "AGENTS.md")).toContain("<!-- BEGIN AI-DLC:guide-cursor-agents -->");
    expect(read(root, skillPath)).toBe("Cursor workflow\n");
    expect(read(root, ".claude/skills/aidlc/SKILL.md")).toBe("Existing Claude workflow\n");
    expect(read(root, "aidlc/spaces/default/intents/current/aidlc-state.md")).toBe(
      "Active stage\n",
    );
  });

  it("keeps user ignore overrides after framework rules and omits generic installer patterns", async () => {
    const source = candidate();
    const root = temp();
    const incoming =
      "# BEGIN AI-DLC:gitignore\n*.local\n# AI-DLC\n.claude/settings.local.json\n# END AI-DLC:gitignore";
    write(source, ".gitignore", `${incoming}\n`);
    const manifest = JSON.parse(read(source, `${dataDir}/aidlc-manifest.json`));
    manifest.rootContributions[".gitignore"].hash = hash(incoming);
    write(source, `${dataDir}/aidlc-manifest.json`, JSON.stringify(manifest));
    const original = "*.local\n!config.local\n";
    write(root, ".gitignore", original);

    await applyHarnessCandidate(source, root, "cursor", "2.8.0");

    const merged = read(root, ".gitignore");
    expect(merged.endsWith(original)).toBe(true);
    expect(merged.split("\n").filter((line) => line === "*.local")).toHaveLength(1);
    expect(merged.indexOf(".claude/settings.local.json")).toBeLessThan(
      merged.indexOf("!config.local"),
    );
    execFileSync("git", ["-C", root, "init", "--quiet"], { stdio: "pipe" });
    const match = execFileSync(
      "git",
      ["-C", root, "check-ignore", "--no-index", "-v", "config.local"],
      { encoding: "utf8" },
    );
    expect(match).toContain(":!config.local\tconfig.local");

    await applyHarnessCandidate(source, root, "cursor", "2.8.0");

    expect(read(root, ".gitignore")).toBe(merged);
  });

  it("seeds missing shared memory and preserves the existing method and active space", async () => {
    const source = candidate();
    const root = temp();
    write(source, "aidlc/spaces/default/memory/team.md", "Default team\n");
    write(root, memoryPath, "Our customised method\n");
    write(root, "aidlc/active-space", "engineering\n");

    await applyHarnessCandidate(source, root, "cursor", "2.8.0");

    expect(read(root, memoryPath)).toBe("Our customised method\n");
    expect(read(root, "aidlc/spaces/default/memory/team.md")).toBe("Default team\n");
    expect(read(root, "aidlc/active-space")).toBe("engineering\n");
  });

  it("refuses a candidate containing workflow records", async () => {
    const source = candidate();
    const root = temp();
    write(source, "aidlc/spaces/default/intents/unrelated/aidlc-state.md", "Do not copy\n");

    await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0")).rejects.toThrow();

    expect(existsSync(path.join(root, ".cursor"))).toBe(false);
    expect(existsSync(path.join(root, "aidlc"))).toBe(false);
  });

  it("records Guide ownership and the installed root block identity for later updates", async () => {
    const source = candidate();
    const root = temp();

    await applyHarnessCandidate(source, root, "cursor", "2.8.0");

    const receipt = JSON.parse(read(root, `${dataDir}/${GUIDE_INSTALL_FILE}`));
    expect(receipt).toMatchObject({
      schemaVersion: 1,
      harness: "cursor",
      version: "2.8.0",
      files: { [skillPath]: hash(read(root, skillPath)) },
    });
    expect(receipt.files[memoryPath]).toBeUndefined();
    const manifest = JSON.parse(read(root, `${dataDir}/aidlc-manifest.json`));
    expect(manifest.rootContributions["AGENTS.md"].marker).toBe("guide-cursor-agents");
    expect(manifest.rootContributions["AGENTS.md"].hash).toBe(
      hash(read(root, "AGENTS.md").trimEnd()),
    );
  });

  it("rejects a conflicting managed file without changing other files", async () => {
    const source = candidate();
    const root = temp();
    write(root, skillPath, "User's existing workflow\n");
    write(root, ".gitignore", "private/\n");

    await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0")).rejects.toThrow();

    expect(read(root, skillPath)).toBe("User's existing workflow\n");
    expect(read(root, ".gitignore")).toBe("private/\n");
    expect(existsSync(path.join(root, "AGENTS.md"))).toBe(false);
  });

  it("accepts identical managed files and does not duplicate its root blocks", async () => {
    const source = candidate();
    const root = temp();
    write(root, skillPath, read(source, skillPath));

    await applyHarnessCandidate(source, root, "cursor", "2.8.0");
    const once = read(root, ".gitignore");
    await applyHarnessCandidate(source, root, "cursor", "2.8.0");

    expect(read(root, ".gitignore")).toBe(once);
    expect(read(root, skillPath)).toBe(read(source, skillPath));
  });

  it("updates files previously installed by Guide when their contents are unchanged", async () => {
    const root = temp();
    await applyHarnessCandidate(candidate(), root, "cursor", "2.8.0");
    write(root, "AGENTS.md", `${read(root, "AGENTS.md")}\nNew user instructions.\n`);

    await applyHarnessCandidate(
      candidate("2.8.1", "New Cursor workflow\n"),
      root,
      "cursor",
      "2.8.1",
    );

    expect(read(root, skillPath)).toBe("New Cursor workflow\n");
    expect(read(root, "AGENTS.md")).toContain("New user instructions.");
    expect(JSON.parse(read(root, `${dataDir}/aidlc-stamp.json`)).frameworkVersion).toBe("2.8.1");
  });

  it("refuses to overwrite edits to a previously installed managed file", async () => {
    const root = temp();
    await applyHarnessCandidate(candidate(), root, "cursor", "2.8.0");
    write(root, skillPath, "Local adjustments\n");

    await expect(
      applyHarnessCandidate(candidate("2.8.1"), root, "cursor", "2.8.1"),
    ).rejects.toThrow();

    expect(read(root, skillPath)).toBe("Local adjustments\n");
    expect(JSON.parse(read(root, `${dataDir}/aidlc-stamp.json`)).frameworkVersion).toBe("2.8.0");
  });

  it("refuses to overwrite edits within a Guide root block", async () => {
    const root = temp();
    await applyHarnessCandidate(candidate(), root, "cursor", "2.8.0");
    const modified = read(root, "AGENTS.md").replace(
      "Use Cursor for AI-DLC.",
      "Customised Cursor instructions.",
    );
    write(root, "AGENTS.md", modified);

    await expect(
      applyHarnessCandidate(candidate("2.8.1"), root, "cursor", "2.8.1"),
    ).rejects.toThrow();

    expect(read(root, "AGENTS.md")).toBe(modified);
  });

  it("previews without writing and refuses a plan after the destination changes", async () => {
    const source = candidate();
    const root = temp();
    write(root, ".gitignore", "private/\n");
    const plan = await planHarnessCandidate(source, root, "cursor", "2.8.0");

    expect(plan.planToken).toEqual(expect.any(String));
    expect(existsSync(path.join(root, ".cursor"))).toBe(false);
    expect(read(root, ".gitignore")).toBe("private/\n");
    write(root, ".gitignore", "private/\nnew-rule/\n");

    await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0", plan)).rejects.toThrow();
    expect(read(root, ".gitignore")).toBe("private/\nnew-rule/\n");
    expect(existsSync(path.join(root, ".cursor"))).toBe(false);
  });

  it("accepts a preview token for the same candidate and unchanged destination", async () => {
    const source = candidate();
    const root = temp();
    const plan = await planHarnessCandidate(source, root, "cursor", "2.8.0");

    await applyHarnessCandidate(source, root, "cursor", "2.8.0", plan);

    expect(read(root, skillPath)).toBe("Cursor workflow\n");
  });

  it("refuses a candidate file whose bytes disagree with its native manifest", async () => {
    const source = candidate();
    const root = temp();
    write(source, skillPath, "Unexpected replacement\n");

    await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0")).rejects.toThrow();
    expect(existsSync(path.join(root, ".cursor"))).toBe(false);
  });

  it.each(["AGENTS.md", "install.ts"])(
    "refuses a changed root contribution %s whose native manifest hash no longer matches",
    async (relative) => {
      const source = candidate();
      const root = temp();
      const original = read(source, relative);
      write(
        source,
        relative,
        original.replace(relative === "AGENTS.md" ? "Use Cursor" : "installer", "Changed"),
      );

      await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0")).rejects.toThrow();

      expect(existsSync(path.join(root, ".cursor"))).toBe(false);
      expect(existsSync(path.join(root, relative))).toBe(false);
    },
  );

  it("rejects path traversal in a native file manifest", async () => {
    const source = candidate();
    const root = temp();
    const manifest = JSON.parse(read(source, `${dataDir}/aidlc-manifest.json`));
    manifest.files["../outside.txt"] = hash("escaped\n");
    write(source, `${dataDir}/aidlc-manifest.json`, JSON.stringify(manifest));

    await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0")).rejects.toThrow();
    expect(existsSync(path.join(root, ".cursor"))).toBe(false);
  });

  it("rejects a destination directory symlink without writing to its target", async () => {
    const source = candidate();
    const root = temp();
    const outside = temp();
    write(outside, "keep.txt", "Outside project\n");
    symlinkSync(
      outside,
      path.join(root, ".cursor"),
      process.platform === "win32" ? "junction" : "dir",
    );

    await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0")).rejects.toThrow();

    expect(read(outside, "keep.txt")).toBe("Outside project\n");
    expect(existsSync(path.join(outside, "skills"))).toBe(false);
  });

  it("runs the final locked validation before any writes", async () => {
    const source = candidate();
    const root = temp();
    const validateLocked = vi.fn(async () => {
      throw new Error("Selection changed");
    });
    const onApplyStart = vi.fn();

    await expect(
      applyHarnessCandidate(source, root, "cursor", "2.8.0", { validateLocked, onApplyStart }),
    ).rejects.toThrow("Selection changed");

    expect(validateLocked).toHaveBeenCalledOnce();
    expect(existsSync(path.join(root, ".cursor"))).toBe(false);
  });

  it("detects a destination edit made during final validation and preserves it", async () => {
    const source = candidate();
    const root = temp();
    write(root, ".gitignore", "original/\n");
    const validateLocked = async () => {
      write(root, ".gitignore", "concurrent-change/\n");
    };

    await expect(
      applyHarnessCandidate(source, root, "cursor", "2.8.0", { validateLocked }),
    ).rejects.toThrow();

    expect(read(root, ".gitignore")).toBe("concurrent-change/\n");
    expect(existsSync(path.join(root, ".cursor"))).toBe(false);
  });

  it("restores root files and removes new files when cancelled during writes", async () => {
    const source = candidate();
    const root = temp();
    const ignore = "private/\n";
    write(root, ".gitignore", ignore);
    const onApplyStart = vi.fn();
    let observedWrite = false;
    const isCurrent = () => {
      observedWrite ||=
        existsSync(path.join(root, skillPath)) || read(root, ".gitignore") !== ignore;
      return !observedWrite;
    };

    await expect(
      applyHarnessCandidate(source, root, "cursor", "2.8.0", { isCurrent, onApplyStart }),
    ).rejects.toThrow();

    expect(onApplyStart).toHaveBeenCalledOnce();
    expect(observedWrite).toBe(true);
    expect(read(root, ".gitignore")).toBe(ignore);
    expect(existsSync(path.join(root, skillPath))).toBe(false);
    expect(existsSync(path.join(root, "AGENTS.md"))).toBe(false);
    expect(existsSync(path.join(root, memoryPath))).toBe(false);
  });
});
