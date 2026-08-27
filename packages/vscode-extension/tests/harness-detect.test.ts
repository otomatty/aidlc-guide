import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectHarnesses } from "../src/harness-detect.ts";

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "aidlc-harness-"));
  temps.push(dir);
  return dir;
}

function touch(root: string, rel: string, body = "x"): void {
  const file = join(root, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, body);
}

describe("detectHarnesses", () => {
  it("returns nothing in an empty workspace", () => {
    const found = detectHarnesses(tempDir());
    expect(found.harnesses).toEqual([]);
    expect(found.aidlcDirCollision).toBe(false);
  });

  it("detects Cursor from skills/aidlc or aidlc-install.json", () => {
    const bySkill = tempDir();
    mkdirSync(join(bySkill, ".cursor", "skills", "aidlc"), { recursive: true });
    expect(detectHarnesses(bySkill).harnesses.map((h) => h.id)).toEqual(["cursor"]);

    const byInstall = tempDir();
    touch(byInstall, join(".cursor", "aidlc-install.json"), "{}");
    expect(detectHarnesses(byInstall).harnesses.map((h) => h.id)).toEqual(["cursor"]);
  });

  it("detects Claude Code from .claude/skills/aidlc", () => {
    const root = tempDir();
    mkdirSync(join(root, ".claude", "skills", "aidlc"), { recursive: true });
    expect(detectHarnesses(root).harnesses.map((h) => h.id)).toEqual(["claude"]);
  });

  it("detects Copilot from .github/skills/aidlc, not from a bare .aidlc/", () => {
    const github = tempDir();
    mkdirSync(join(github, ".github", "skills", "aidlc"), { recursive: true });
    expect(detectHarnesses(github).harnesses.map((h) => h.id)).toEqual(["copilot"]);

    const engineOnly = tempDir();
    touch(engineOnly, join(".aidlc", "tools", "aidlc-version.ts"));
    expect(detectHarnesses(engineOnly).harnesses).toEqual([]);
  });

  it("detects Cursor and Claude together without inventing missing harnesses", () => {
    const root = tempDir();
    mkdirSync(join(root, ".cursor", "skills", "aidlc"), { recursive: true });
    mkdirSync(join(root, ".claude", "skills", "aidlc"), { recursive: true });
    expect(detectHarnesses(root).harnesses.map((h) => h.id)).toEqual(["cursor", "claude"]);
  });

  it("flags Copilot + opencode sharing .aidlc/ as a collision", () => {
    const root = tempDir();
    mkdirSync(join(root, ".github", "skills", "aidlc"), { recursive: true });
    touch(root, join(".aidlc", "tools", "aidlc-version.ts"));
    touch(root, join(".opencode", "command", "aidlc.md"));
    const found = detectHarnesses(root);
    expect(found.harnesses.map((h) => h.id).sort()).toEqual(["copilot", "opencode"]);
    expect(found.aidlcDirCollision).toBe(true);
  });

  it("detects Codex, Kiro CLI, and Kiro IDE from official markers", () => {
    const codex = tempDir();
    touch(codex, join(".codex", "tools", "aidlc-version.ts"));
    expect(detectHarnesses(codex).harnesses.map((h) => h.id)).toEqual(["codex"]);

    const kiro = tempDir();
    mkdirSync(join(kiro, ".kiro", "skills", "aidlc"), { recursive: true });
    expect(detectHarnesses(kiro).harnesses.map((h) => h.id)).toEqual(["kiro"]);

    const ide = tempDir();
    touch(ide, join(".kiro", "steering", "aidlc-active-memory.md"));
    expect(detectHarnesses(ide).harnesses.map((h) => h.id)).toEqual(["kiro-ide"]);
  });
});
