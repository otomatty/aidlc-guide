import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
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

const fsFaults = vi.hoisted(() => ({
  mkdir: undefined as ((file: string) => void) | undefined,
  unlink: undefined as ((file: string) => void) | undefined,
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    mkdirSync: (...args: Parameters<typeof actual.mkdirSync>) => {
      fsFaults.mkdir?.(String(args[0]));
      return actual.mkdirSync(...args);
    },
    unlinkSync: (...args: Parameters<typeof actual.unlinkSync>) => {
      fsFaults.unlink?.(String(args[0]));
      return actual.unlinkSync(...args);
    },
  };
});

const roots: string[] = [];
afterEach(async () => {
  fsFaults.mkdir = undefined;
  fsFaults.unlink = undefined;
  vi.restoreAllMocks();
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

function locks(root: string): { lock: string; gate: string } {
  const resolved = realpathSync(root);
  const canonical = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const bucket = createHash("md5").update(`${canonical}\0__workspace__`).digest("hex").slice(0, 8);
  const lock = path.join(tmpdir(), `.aidlc-audit-${bucket}.lock`);
  const gate = `${lock}.reap`;
  roots.push(lock, gate);
  return { lock, gate };
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
  it.each(["lock", "gate"] as const)(
    "explains contention on the existing %s without changing it",
    async (target) => {
      const source = candidate();
      const root = temp();
      const paths = locks(root);
      mkdirSync(paths[target]);
      writeFileSync(path.join(paths[target], "owner.json"), "Existing owner\n");

      await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0")).rejects.toThrow(
        "このプロジェクトは別の処理で使用中です。完了後に再実行してください。",
      );

      expect(read(paths[target], "owner.json")).toBe("Existing owner\n");
      expect(existsSync(paths[target === "lock" ? "gate" : "lock"])).toBe(false);
      expect(existsSync(path.join(root, ".cursor"))).toBe(false);
    },
  );

  it.each(["lock", "gate"] as const)(
    "preserves permission failures acquiring the %s instead of reporting contention",
    async (target) => {
      const source = candidate();
      const root = temp();
      const paths = locks(root);
      const permissionError = Object.assign(new Error("mkdir permission denied"), {
        code: "EACCES",
      });
      fsFaults.mkdir = (file) => {
        if (file === paths[target]) throw permissionError;
      };

      await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0")).rejects.toBe(
        permissionError,
      );

      expect(existsSync(paths.lock)).toBe(false);
      expect(existsSync(paths.gate)).toBe(false);
      expect(existsSync(path.join(root, ".cursor"))).toBe(false);
    },
  );

  it("retains the acquisition error when releasing the gate also fails", async () => {
    const source = candidate();
    const root = temp();
    const { lock, gate } = locks(root);
    const primary = Object.assign(new Error("lock permission denied"), { code: "EACCES" });
    const cleanup = new Error("gate release failed");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fsFaults.mkdir = (file) => {
      if (file === lock) throw primary;
    };
    fsFaults.unlink = (file) => {
      if (file === path.join(gate, "owner.json")) throw cleanup;
    };

    const result = applyHarnessCandidate(source, root, "cursor", "2.8.0");

    await expect(result).rejects.toBe(primary);
    expect(log).toHaveBeenCalledWith(expect.any(String), cleanup);
    expect(existsSync(lock)).toBe(false);
    expect(existsSync(path.join(root, ".cursor"))).toBe(false);
  });

  it("releases the acquired workspace lock when releasing the gate fails", async () => {
    const source = candidate();
    const root = temp();
    const { lock, gate } = locks(root);
    const cleanup = new Error("gate release failed");
    fsFaults.unlink = (file) => {
      if (file === path.join(gate, "owner.json")) throw cleanup;
    };

    await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0")).rejects.toBe(cleanup);

    expect(existsSync(lock)).toBe(false);
    expect(existsSync(path.join(root, ".cursor"))).toBe(false);
  });

  it("retains failed validation and records the secondary lock release failure", async () => {
    const source = candidate();
    const root = temp();
    const { lock } = locks(root);
    const primary = new Error("Selection changed");
    const cleanup = new Error("workspace lock release failed");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fsFaults.unlink = (file) => {
      if (file === path.join(lock, "owner.json")) throw cleanup;
    };

    const result = applyHarnessCandidate(source, root, "cursor", "2.8.0", {
      validateLocked: async () => {
        throw primary;
      },
    });

    await expect(result).rejects.toBe(primary);
    expect(log).toHaveBeenCalledWith(expect.any(String), cleanup);
    expect(existsSync(path.join(root, ".cursor"))).toBe(false);
  });

  it("retains the original failure even when recording cleanup diagnostics throws", async () => {
    const source = candidate();
    const root = temp();
    const { lock } = locks(root);
    const primary = new Error("Selection changed");
    fsFaults.unlink = (file) => {
      if (file === path.join(lock, "owner.json")) throw new Error("lock release failed");
    };
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("diagnostic sink failed");
    });

    await expect(
      applyHarnessCandidate(source, root, "cursor", "2.8.0", {
        validateLocked: async () => {
          throw primary;
        },
      }),
    ).rejects.toBe(primary);
  });

  it("reports lock release failure after successful writes", async () => {
    const source = candidate();
    const root = temp();
    const { lock } = locks(root);
    const cleanup = new Error("workspace lock release failed");
    fsFaults.unlink = (file) => {
      if (file === path.join(lock, "owner.json")) throw cleanup;
    };

    await expect(applyHarnessCandidate(source, root, "cursor", "2.8.0")).rejects.toBe(cleanup);

    expect(read(root, skillPath)).toBe("Cursor workflow\n");
    expect(existsSync(path.join(root, dataDir, GUIDE_INSTALL_FILE))).toBe(true);
  });

  it.each([false, true])(
    "preserves apply and rollback diagnostics with a linked root: %s",
    async (linked) => {
      const source = candidate();
      const destination = temp();
      const root = linked ? path.join(temp(), "project") : destination;
      if (linked) symlinkSync(destination, root, process.platform === "win32" ? "junction" : "dir");
      // The merger resolves the project root before writing, including macOS temp aliases.
      const rollbackFile = path.join(realpathSync(root), skillPath);
      const { lock } = locks(root);
      const rollback = new Error("rollback unlink failed");
      const cleanup = new Error("workspace lock release failed");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      fsFaults.unlink = (file) => {
        if (file === rollbackFile) throw rollback;
        if (file === path.join(lock, "owner.json")) throw cleanup;
      };
      const isCurrent = () => !existsSync(path.join(root, skillPath));

      const result = applyHarnessCandidate(source, root, "cursor", "2.8.0", { isCurrent });

      await expect(result).rejects.toThrow("プロジェクトの設定を中止しました。");
      await expect(result).rejects.toThrow("復元結果: Error: rollback unlink failed");
      expect(log).toHaveBeenCalledWith(expect.any(String), cleanup);
      expect(existsSync(rollbackFile)).toBe(true);
      expect(existsSync(path.join(root, dataDir, GUIDE_INSTALL_FILE))).toBe(false);
    },
  );

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
