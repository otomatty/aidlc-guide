import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyWorkflowsUpdate,
  downloadWorkflowsArchive,
  extractDownloadedArchive,
  findExtractedRepoRoot,
  workflowsArchiveUrl,
} from "../src/workflows-apply.ts";

const execFileAsync = promisify(execFile);

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
    join("dist", "copilot", "aidlc", "spaces", "default", "memory", "org.md"),
    "new-org",
  );
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
      "https://codeload.github.com/awslabs/aidlc-workflows/tar.gz/refs/tags/v2.6.99",
    );
    expect(workflowsArchiveUrl("v2.6.99")).toBe(
      "https://codeload.github.com/awslabs/aidlc-workflows/tar.gz/refs/tags/v2.6.99",
    );
    expect(workflowsArchiveUrl("2.6.99")).not.toContain("latest");
    expect(workflowsArchiveUrl("2.6.99")).not.toContain("/zip/");
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

  it("refuses when dist harness version files do not all match the pin", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".claude", "skills", "aidlc", "SKILL.md"), "old-claude");
    const distRoot = seedDist("2.6.99");
    write(
      distRoot,
      join("dist", "copilot", ".aidlc", "tools", "aidlc-version.ts"),
      versionFile("2.7.0"),
    );
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["claude"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("pin-mismatch");
    expect(readFileSync(join(workspace, ".claude", "skills", "aidlc", "SKILL.md"), "utf8")).toBe(
      "old-claude",
    );
  });

  it("refuses when a dist version file exists but is not a semver", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".claude", "skills", "aidlc", "SKILL.md"), "old-claude");
    const distRoot = seedDist("2.6.99");
    write(
      distRoot,
      join("dist", "copilot", ".aidlc", "tools", "aidlc-version.ts"),
      "export const AIDLC_VERSION = 'dev';\n",
    );
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["claude"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("pin-mismatch");
    expect(readFileSync(join(workspace, ".claude", "skills", "aidlc", "SKILL.md"), "utf8")).toBe(
      "old-claude",
    );
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

  it("refuses to apply when the workspace is already at or above the pin", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".claude", "skills", "aidlc", "SKILL.md"), "old-claude");
    write(workspace, join(".claude", "tools", "aidlc-version.ts"), versionFile("2.7.0"));
    const distRoot = seedDist("2.6.99");
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["claude"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("would-downgrade");
    expect(readFileSync(join(workspace, ".claude", "skills", "aidlc", "SKILL.md"), "utf8")).toBe(
      "old-claude",
    );
  });

  it("skips a harness already at the pin and still updates an older sibling", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".cursor", "skills", "aidlc", "SKILL.md"), "old-cursor");
    write(workspace, join(".cursor", "tools", "aidlc-version.ts"), versionFile("2.7.0"));
    write(workspace, join(".claude", "skills", "aidlc", "SKILL.md"), "old-claude");
    write(workspace, join(".claude", "tools", "aidlc-version.ts"), versionFile("2.5.0"));
    write(workspace, join("aidlc", "spaces", "default", "memory", "org.md"), "keep-org");
    const distRoot = seedDist("2.6.99");
    const calls: string[] = [];
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["cursor", "claude"],
      aidlcDirCollision: false,
      runCursorInstall: async (installTs, target) => {
        calls.push(installTs, target);
        return { ok: true, log: "should-not-run" };
      },
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual([]);
    expect(readFileSync(join(workspace, ".cursor", "skills", "aidlc", "SKILL.md"), "utf8")).toBe(
      "old-cursor",
    );
    expect(readFileSync(join(workspace, ".claude", "skills", "aidlc", "SKILL.md"), "utf8")).toBe(
      "new-claude-skill",
    );
    expect(
      readFileSync(join(workspace, "aidlc", "spaces", "default", "memory", "org.md"), "utf8"),
    ).toBe("keep-org");
    expect(result.log.some((line) => line.includes("想定版以上のハーネス"))).toBe(true);
  });

  it("does not run the Cursor installer when another harness already has a newer shell", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".cursor", "skills", "aidlc", "SKILL.md"), "old-cursor");
    write(workspace, join(".cursor", "tools", "aidlc-version.ts"), versionFile("2.5.0"));
    write(workspace, join(".claude", "skills", "aidlc", "SKILL.md"), "old-claude");
    write(workspace, join(".claude", "tools", "aidlc-version.ts"), versionFile("2.7.0"));
    write(workspace, join("aidlc", "spaces", "default", "memory", "org.md"), "keep-org");
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
        return { ok: true, log: "should-not-run" };
      },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("would-downgrade");
    expect(calls).toEqual([]);
    expect(readFileSync(join(workspace, ".cursor", "skills", "aidlc", "SKILL.md"), "utf8")).toBe(
      "old-cursor",
    );
    expect(
      readFileSync(join(workspace, "aidlc", "spaces", "default", "memory", "org.md"), "utf8"),
    ).toBe("keep-org");
  });

  it("records a copy failure instead of rejecting the apply promise", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, ".claude", "i-am-a-file");
    const distRoot = seedDist("2.6.99");
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["claude"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("copy-failed");
    expect(result.failed).toContain("claude");
    expect(result.log.some((line) => line.includes("コピーに失敗"))).toBe(true);
  });

  it("does not overlay the shared shell when a selected harness failed", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".claude", "skills", "aidlc", "SKILL.md"), "old-claude");
    const distRoot = seedDist("2.6.99");
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["claude", "codex"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(false);
    expect(result.failed).toContain("codex");
    expect(existsSync(join(workspace, "aidlc", "spaces", "default", "memory", "org.md"))).toBe(
      false,
    );
  });

  it("fails when the selected overlay has no shared aidlc shell in dist", async () => {
    const workspace = tempDir("aidlc-ws-");
    write(workspace, join(".claude", "skills", "aidlc", "SKILL.md"), "old-claude");
    const distRoot = seedDist("2.6.99");
    rmSync(join(distRoot, "dist", "claude", "aidlc"), { recursive: true, force: true });
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["claude"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing-dist");
    expect(readFileSync(join(workspace, ".claude", "skills", "aidlc", "SKILL.md"), "utf8")).toBe(
      "old-claude",
    );
  });

  it("refuses to copy through a symlink destination", async () => {
    const workspace = tempDir("aidlc-ws-");
    const outside = tempDir("aidlc-out-");
    write(outside, "secret.txt", "keep");
    symlinkSync(
      outside,
      join(workspace, ".claude"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const distRoot = seedDist("2.6.99");
    const result = await applyWorkflowsUpdate({
      workspaceRoot: workspace,
      distRoot,
      pin: "2.6.99",
      selected: ["claude"],
      aidlcDirCollision: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("copy-failed");
    expect(readFileSync(join(outside, "secret.txt"), "utf8")).toBe("keep");
  });
});

describe("extractDownloadedArchive", () => {
  it("extracts a gzip-compressed tar with GNU tar flags", async () => {
    const src = tempDir("aidlc-tar-src-");
    write(src, "hello.txt", "hello");
    const outDir = tempDir("aidlc-tar-out-");
    await execFileAsync("tar", ["-czf", "bundle.tar.gz", "-C", src, "hello.txt"], {
      cwd: outDir,
      windowsHide: true,
    });
    const dest = tempDir("aidlc-tar-dest-");
    const extracted = await extractDownloadedArchive(join(outDir, "bundle.tar.gz"), dest);
    expect(extracted.ok).toBe(true);
    expect(readFileSync(join(dest, "hello.txt"), "utf8")).toBe("hello");
  });
});
