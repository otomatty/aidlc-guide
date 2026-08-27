import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyWorkflowsUpdate,
  downloadWorkflowsArchive,
  findExtractedRepoRoot,
  workflowsArchiveUrl,
} from "../src/workflows-apply.ts";

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

function write(root: string, rel: string, body: string): void {
  const file = join(root, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, body);
}

function versionFile(version: string): string {
  return `export const AIDLC_VERSION = "${version}";\n`;
}

function seedDist(version: string): string {
  const distRoot = tempDir("aidlc-dist-");
  write(
    distRoot,
    join("dist", "claude", ".claude", "tools", "aidlc-version.ts"),
    versionFile(version),
  );
  write(
    distRoot,
    join("dist", "claude", ".claude", "skills", "aidlc", "SKILL.md"),
    "new-claude-skill",
  );
  write(
    distRoot,
    join("dist", "claude", "aidlc", "spaces", "default", "memory", "org.md"),
    "new-org",
  );
  write(
    distRoot,
    join("dist", "claude", "aidlc", "spaces", "default", "memory", "team.md"),
    "framework-team",
  );
  write(
    distRoot,
    join("dist", "claude", "aidlc", "spaces", "default", "memory", "project.md"),
    "framework-project",
  );
  write(distRoot, join("dist", "cursor", "install.ts"), "// installer");
  write(
    distRoot,
    join("dist", "cursor", ".cursor", "skills", "aidlc", "SKILL.md"),
    "new-cursor-skill",
  );
  write(
    distRoot,
    join("dist", "copilot", ".aidlc", "tools", "aidlc-version.ts"),
    versionFile(version),
  );
  write(
    distRoot,
    join("dist", "copilot", ".github", "skills", "aidlc", "SKILL.md"),
    "new-copilot-skill",
  );
  write(distRoot, join("dist", "copilot", ".github", "workflows", "ci.yml"), "dist-ci");
  write(
    distRoot,
    join("dist", "opencode", ".aidlc", "tools", "aidlc-version.ts"),
    versionFile(version),
  );
  write(distRoot, join("dist", "opencode", ".opencode", "command", "aidlc.md"), "new-opencode");
  return distRoot;
}

describe("workflowsArchiveUrl", () => {
  it("pins the v-prefixed tag archive, not latest", () => {
    expect(workflowsArchiveUrl("2.6.99")).toBe(
      "https://codeload.github.com/awslabs/aidlc-workflows/zip/refs/tags/v2.6.99",
    );
    expect(workflowsArchiveUrl("v2.6.99")).toBe(
      "https://codeload.github.com/awslabs/aidlc-workflows/zip/refs/tags/v2.6.99",
    );
    expect(workflowsArchiveUrl("2.6.99")).not.toContain("latest");
  });
});

describe("downloadWorkflowsArchive", () => {
  it("maps 404 to not-found without throwing", async () => {
    const result = await downloadWorkflowsArchive(
      "2.6.99",
      async () => new Response(null, { status: 404 }),
    );
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("findExtractedRepoRoot", () => {
  it("finds the nested GitHub archive folder that contains dist/", () => {
    const extract = tempDir("aidlc-extract-");
    write(extract, join("aidlc-workflows-2.6.99", "dist", "claude", "x"), "x");
    expect(findExtractedRepoRoot(extract)).toBe(join(extract, "aidlc-workflows-2.6.99"));
  });
});

describe("applyWorkflowsUpdate", () => {
  it("refuses when the fetched dist version does not match the Guide pin", async () => {
    const workspace = tempDir("aidlc-ws-");
    const distRoot = seedDist("2.7.0");
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["claude"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("pin-mismatch");
    expect(existsSync(join(workspace, ".claude"))).toBe(false);
  });

  it("updates only selected harnesses and does not create missing ones", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".claude", "skills", "aidlc", "SKILL.md"), "old-claude");
    const distRoot = seedDist("2.6.99");
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["claude"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(true);
    expect(readFileSync(join(workspace, ".claude", "skills", "aidlc", "SKILL.md"), "utf8")).toBe(
      "new-claude-skill",
    );
    expect(existsSync(join(workspace, ".cursor"))).toBe(false);
    expect(existsSync(join(workspace, ".github"))).toBe(false);
  });

  it("keeps team.md, project.md, and intent records on the copy path", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".claude", "skills", "aidlc", "SKILL.md"), "old");
    write(workspace, join("aidlc", "spaces", "default", "memory", "team.md"), "our-team");
    write(workspace, join("aidlc", "spaces", "default", "memory", "project.md"), "our-project");
    write(workspace, join("aidlc", "spaces", "default", "memory", "org.md"), "old-org");
    write(
      workspace,
      join("aidlc", "spaces", "default", "intents", "demo-intent", "audit", "shard.md"),
      "keep-audit",
    );
    const distRoot = seedDist("2.6.99");
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["claude"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(true);
    expect(
      readFileSync(join(workspace, "aidlc", "spaces", "default", "memory", "team.md"), "utf8"),
    ).toBe("our-team");
    expect(
      readFileSync(join(workspace, "aidlc", "spaces", "default", "memory", "project.md"), "utf8"),
    ).toBe("our-project");
    expect(
      readFileSync(join(workspace, "aidlc", "spaces", "default", "memory", "org.md"), "utf8"),
    ).toBe("new-org");
    expect(
      readFileSync(
        join(
          workspace,
          "aidlc",
          "spaces",
          "default",
          "intents",
          "demo-intent",
          "audit",
          "shard.md",
        ),
        "utf8",
      ),
    ).toBe("keep-audit");
  });

  it("runs the Cursor installer instead of copying .cursor, and skips a second shell copy", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".cursor", "skills", "aidlc", "SKILL.md"), "old");
    write(workspace, join("aidlc", "spaces", "default", "memory", "team.md"), "our-team");
    const distRoot = seedDist("2.6.99");
    const calls: string[] = [];
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["cursor"],
      aidlcDirCollision: false,
      runCursorInstall: async (installTs, target) => {
        calls.push(installTs, target);
        return { ok: true, log: "installed" };
      },
    });
    expect(result.ok).toBe(true);
    expect(calls[1]).toBe(workspace);
    expect(calls[0]?.endsWith(join("dist", "cursor", "install.ts"))).toBe(true);
    expect(readFileSync(join(workspace, ".cursor", "skills", "aidlc", "SKILL.md"), "utf8")).toBe(
      "old",
    );
    expect(
      readFileSync(join(workspace, "aidlc", "spaces", "default", "memory", "team.md"), "utf8"),
    ).toBe("our-team");
  });

  it("does not overlay .aidlc when Copilot and opencode are both selected", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".aidlc", "tools", "aidlc-version.ts"), versionFile("2.5.0"));
    write(workspace, join(".github", "skills", "aidlc", "SKILL.md"), "old-copilot");
    write(workspace, join(".opencode", "command", "aidlc.md"), "old-opencode");
    const distRoot = seedDist("2.6.99");
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["copilot", "opencode"],
      aidlcDirCollision: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("collision");
    expect(readFileSync(join(workspace, ".aidlc", "tools", "aidlc-version.ts"), "utf8")).toBe(
      versionFile("2.5.0"),
    );
  });

  it("copies only aidlc-prefixed GitHub paths for Copilot", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".github", "skills", "aidlc", "SKILL.md"), "old");
    write(workspace, join(".github", "workflows", "ci.yml"), "user-ci");
    const distRoot = seedDist("2.6.99");
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["copilot"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(true);
    expect(readFileSync(join(workspace, ".github", "skills", "aidlc", "SKILL.md"), "utf8")).toBe(
      "new-copilot-skill",
    );
    expect(readFileSync(join(workspace, ".github", "workflows", "ci.yml"), "utf8")).toBe("user-ci");
  });
});
