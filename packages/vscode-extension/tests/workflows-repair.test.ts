import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureNative } from "../src/native-setup.ts";
import { configProblems, NativeConfigConflict } from "../src/workflows-conflicts.ts";
import {
  officialEquivalent,
  type RepairDependencies,
  repairWorkflows,
  validateRetainedGitignore,
} from "../src/workflows-repair.ts";

const roots: string[] = [];
async function temporary() {
  const root = await mkdtemp(path.join(tmpdir(), "repair-test-"));
  roots.push(root);
  return root;
}
function put(root: string, rel: string, text: string) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}
const conflict = (file = ".claude/CLAUDE.md", detail = "locally modified or unowned") =>
  configProblems(
    JSON.stringify({ data: { actions: [{ action: "conflict", path: file, detail }] } }),
    "claude",
  );
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("update conflict diagnostics", () => {
  it("preserves structured failures from a nonzero native dry run", async () => {
    const runner = vi.fn().mockResolvedValue({
      code: 4,
      stdout: JSON.stringify({
        message: "long raw error",
        data: {
          actions: [
            {
              action: "conflict",
              path: ".claude/CLAUDE.md",
              detail: "locally modified or unowned",
            },
            {
              action: "conflict",
              path: ".gitignore",
              detail:
                "legacy root integration ambiguous; move or delete the unmarked AI-DLC content",
            },
            { action: "preserve", path: "ok", detail: "unchanged" },
          ],
        },
      }),
      stderr: "",
    });
    const error = await configureNative(
      { executable: "/runtime/aidlc", version: "2.8.2", binDir: "/bin" },
      "/project",
      "claude",
      () => {},
      runner,
      { previewOnly: true },
    ).catch((e) => e);
    expect(error).toBeInstanceOf(NativeConfigConflict);
    expect(error.problems.map((p: { kind: string }) => p.kind)).toEqual([
      "ownership",
      "legacy-root",
    ]);
    expect(runner).toHaveBeenCalledOnce();
  });
  it("does not infer ownership from text or accept malformed actions", () => {
    for (const data of [
      "178 config conflict(s)",
      "null",
      "{}",
      '{"data":{"actions":[null,{"action":"conflict","path":3}]}}',
    ])
      expect(configProblems(data, "claude")).toEqual([]);
    expect(conflict(".mcp.json", "unknown")[0]?.kind).toBe("other");
  });
});

describe("bounded repair proposals", () => {
  const original =
    "# project\n.env\n# BEGIN AIDLC CURSOR\n# AI-DLC old\naidlc/.cache/\n!keep\n# END AIDLC CURSOR\ncustom/\n";
  const retained = "# project\n.env\naidlc/.cache/\n!keep\ncustom/";
  it("preserves outside text and ordered ignore rules", () => {
    expect(validateRetainedGitignore(original, retained)).toBe(retained);
    expect(officialEquivalent(Buffer.from("same\r\n"), Buffer.from("same\n"))).toBe(true);
    expect(officialEquivalent(Buffer.from("custom"), Buffer.from("official"))).toBe(false);
  });
  it("rejects missing rules, reordered negations, inventions and malformed blocks", () => {
    for (const proposal of [
      null,
      retained.replace("!keep\n", ""),
      retained.replace("!keep\ncustom/", "custom/\n!keep"),
      `${retained}\nsecrets/`,
    ])
      expect(() => validateRetainedGitignore(original, proposal)).toThrow();
    expect(() =>
      validateRetainedGitignore(original.replace("# END AIDLC CURSOR", ""), retained),
    ).toThrow();
  });
});

async function fixture() {
  const root = await temporary(),
    release = await temporary(),
    backupParent = await temporary();
  put(root, ".claude/skills/aidlc/SKILL.md", "skill");
  put(root, ".claude/tools/aidlc-version.ts", 'export const AIDLC_VERSION = "2.8.0";');
  put(root, ".claude/CLAUDE.md", "official old");
  put(root, ".aidlc-version", "2.8.0\n");
  put(release, "runtime/claude/.claude/CLAUDE.md", "new official");
  const oldRelease = await temporary();
  put(oldRelease, "runtime/claude/.claude/CLAUDE.md", "official old");
  const install = { executable: path.join(release, "aidlc"), version: "2.8.2", binDir: release };
  const configure: RepairDependencies["configure"] = vi.fn(
    async (_install, candidate, _harness, _log, _runner, options) => {
      const file = path.join(candidate, ".claude/CLAUDE.md");
      if (existsSync(file) && readFileSync(file, "utf8") !== "new official")
        throw new NativeConfigConflict(conflict());
      if (!options?.previewOnly) put(candidate, ".claude/CLAUDE.md", "new official");
      return { doctorOk: true, details: "", planToken: "token" };
    },
  );
  const cleanup = vi.fn();
  const run = vi
    .fn()
    .mockResolvedValue('{"proceed":true,"retainedGitignore":null,"summary":"移行します"}');
  const dependencies: Partial<RepairDependencies> = {
    readInstall: (version) =>
      version === "2.8.0"
        ? { ...install, version, executable: path.join(oldRelease, "aidlc") }
        : install,
    configure,
    probe: vi.fn().mockResolvedValue({
      tool: "claude",
      available: true,
      label: "Claude Code",
      command: "claude",
    }),
    run,
    scratch: vi.fn().mockResolvedValue({ cwd: release, env: {}, cleanup }),
  };
  const options = {
    root,
    backupParent,
    signal: new AbortController().signal,
    isCurrent: () => true,
    log: vi.fn(),
  };
  return { root, backupParent, options, dependencies, run, cleanup, configure };
}

describe("repair workflow", () => {
  it("refuses a non-UTF-8 gitignore without starting AI or changing original bytes", async () => {
    const f = await fixture();
    const bytes = Buffer.concat([
      Buffer.from("# BEGIN AIDLC CURSOR\n"),
      Buffer.from([0x82, 0xa0]),
      Buffer.from("\nsecret/\n# END AIDLC CURSOR\n"),
    ]);
    writeFileSync(path.join(f.root, ".gitignore"), bytes);
    f.dependencies.configure = vi
      .fn()
      .mockRejectedValue(
        new NativeConfigConflict(conflict(".gitignore", "legacy root integration ambiguous")),
      );
    await expect(repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies)).rejects.toThrow(
      "UTF-8",
    );
    expect(f.run).not.toHaveBeenCalled();
    expect(f.dependencies.probe).not.toHaveBeenCalled();
    expect(readFileSync(path.join(f.root, ".gitignore"))).toEqual(bytes);
    expect(readFileSync(path.join(f.root, ".claude/CLAUDE.md"), "utf8")).toBe("official old");
    expect(readFileSync(path.join(f.root, ".aidlc-version"), "utf8")).toBe("2.8.0\n");
  });
  it("diagnoses all conflicts in a copy without changing the project pin or starting AI", async () => {
    const f = await fixture();
    const result = await repairWorkflows(f.options, f.dependencies);
    expect(result.problems).toHaveLength(1);
    expect(f.run).not.toHaveBeenCalled();
    expect(readFileSync(path.join(f.root, ".aidlc-version"), "utf8")).toBe("2.8.0\n");
    expect(readFileSync(path.join(f.root, ".claude/CLAUDE.md"), "utf8")).toBe("official old");
  });
  it("uses a tool-free AI process and imports only independently validated native output with backup", async () => {
    const f = await fixture();
    const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
    expect(result.problems).toEqual([]);
    expect(result.changed).toEqual([".claude/CLAUDE.md"]);
    expect(readFileSync(path.join(f.root, ".claude/CLAUDE.md"), "utf8")).toBe("new official");
    expect(readFileSync(path.join(result.backup ?? "", "0.bin"), "utf8")).toBe("official old");
    expect(f.run.mock.calls[0]?.[0].cwd).not.toBe(f.root);
    expect(f.run.mock.calls[0]?.[0].args).toContain("--safe-mode");
    expect(f.cleanup).toHaveBeenCalledOnce();
    expect(readFileSync(path.join(f.root, ".aidlc-version"), "utf8")).toBe("2.8.0\n");
  });
  it("keeps custom edits and does not accept the AI's success claim as verification", async () => {
    const f = await fixture();
    put(f.root, ".claude/CLAUDE.md", "custom edit");
    const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
    expect(result.problems).toHaveLength(1);
    expect(result.changed).toBeUndefined();
    expect(readFileSync(path.join(f.root, ".claude/CLAUDE.md"), "utf8")).toBe("custom edit");
  });
  it("rejects stale snapshots after concurrent edits and releases the operation lock", async () => {
    const f = await fixture();
    f.run.mockImplementation(async () => {
      put(f.root, ".claude/new-rule.md", "user writing");
      return '{"proceed":true}';
    });
    await expect(repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies)).rejects.toThrow(
      "診断後に設定が変更",
    );
    expect(readFileSync(path.join(f.root, ".claude/CLAUDE.md"), "utf8")).toBe("official old");
    expect((await repairWorkflows(f.options, f.dependencies)).problems).toHaveLength(1);
  });
  it("cancels without writes and reports unavailable or unauthenticated CLI", async () => {
    const f = await fixture();
    f.dependencies.probe = vi
      .fn()
      .mockResolvedValue({ available: false, detail: "CLI がありません" });
    await expect(repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies)).rejects.toThrow(
      "CLI がありません",
    );
    expect(f.run).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    await expect(
      repairWorkflows({ ...f.options, signal: controller.signal, tool: "claude" }, f.dependencies),
    ).rejects.toThrow();
    expect(readFileSync(path.join(f.root, ".claude/CLAUDE.md"), "utf8")).toBe("official old");
  });
});
