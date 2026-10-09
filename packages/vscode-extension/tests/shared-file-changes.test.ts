import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  changedSince,
  gitStatusSnapshot,
  parseGitStatus,
  sharedFilesFor,
  updateCommitMessage,
} from "../src/shared-file-changes.ts";

describe("parseGitStatus", () => {
  it("reads NUL-separated porcelain entries, including renames", () => {
    const raw = " M .aidlc-version\0?? .claude/tools/new.ts\0R  .cursor/b.ts\0.cursor/a.ts\0";
    expect([...parseGitStatus(raw)]).toEqual([
      [".aidlc-version", " M"],
      [".claude/tools/new.ts", "??"],
      [".cursor/b.ts", "R "],
    ]);
  });

  it("ignores an empty status", () => {
    expect(parseGitStatus("").size).toBe(0);
  });
});

describe("changedSince", () => {
  it("lists paths the update touched, not the ones already dirty", () => {
    const before = new Map([
      ["notes.md", " M"],
      [".gitignore", " M"],
    ]);
    const after = new Map([
      ["notes.md", " M"],
      [".gitignore", "MM"],
      [".aidlc-version", " M"],
    ]);
    expect(changedSince(before, after)).toEqual([".aidlc-version", ".gitignore"]);
  });

  it("reports a path the update reverted to clean", () => {
    expect(changedSince(new Map([["a.ts", " M"]]), new Map())).toEqual(["a.ts"]);
  });
});

describe("sharedFilesFor", () => {
  it("names each tool's tree once, then the pin and every root file a merge may rewrite", () => {
    expect(sharedFilesFor(["claude", "cursor", "kiro-ide", "kiro"])).toEqual([
      ".claude/",
      ".cursor/",
      ".kiro/",
      ".aidlc-version",
      ".gitignore",
      "AGENTS.md",
      ".mcp.json",
      ".vscode/settings.json",
      "opencode.json",
      "install.ts",
    ]);
  });
});

describe("updateCommitMessage", () => {
  it("names the release", () => {
    expect(updateCommitMessage("2.11.0")).toBe("chore: aidlc-workflows を 2.11.0 に更新");
  });
});

describe("gitStatusSnapshot", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "shared-changes-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("is null outside a git repository", async () => {
    await expect(gitStatusSnapshot(root)).resolves.toBeNull();
  });

  it("sees a change made between two snapshots", async () => {
    execFileSync("git", ["init", "-q"], { cwd: root });
    writeFileSync(path.join(root, ".aidlc-version"), "2.10.0\n");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync(
      "git",
      ["-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-qm", "init"],
      { cwd: root },
    );
    const before = await gitStatusSnapshot(root);
    writeFileSync(path.join(root, ".aidlc-version"), "2.11.0\n");
    mkdirSync(path.join(root, ".claude"));
    writeFileSync(path.join(root, ".claude", "x.ts"), "x\n");
    const after = await gitStatusSnapshot(root);
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(changedSince(before ?? new Map(), after ?? new Map())).toEqual([
      ".aidlc-version",
      ".claude/",
    ]);
  });

  it("sees an update to files that were already dirty, whose codes stay the same", async () => {
    execFileSync("git", ["init", "-q"], { cwd: root });
    writeFileSync(path.join(root, ".gitignore"), "node_modules/\n");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync(
      "git",
      ["-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-qm", "init"],
      { cwd: root },
    );
    writeFileSync(path.join(root, ".gitignore"), "node_modules/\ndist/\n");
    mkdirSync(path.join(root, ".claude"));
    writeFileSync(path.join(root, ".claude", "x.ts"), "old\n");
    writeFileSync(path.join(root, "notes.md"), "mine\n");
    const before = await gitStatusSnapshot(root);
    writeFileSync(path.join(root, ".gitignore"), "node_modules/\ndist/\n# AI-DLC: local working files\n");
    writeFileSync(path.join(root, ".claude", "x.ts"), "new\n");
    const after = await gitStatusSnapshot(root);
    expect(changedSince(before ?? new Map(), after ?? new Map())).toEqual([".claude/", ".gitignore"]);
  });
});
