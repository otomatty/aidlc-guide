import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HarnessId } from "../src/harness-detect.ts";
import { HARNESS_DIRECTORIES } from "../src/native-harness-merge.ts";
import { configureNative } from "../src/native-setup.ts";
import { configProblems, NativeConfigConflict } from "../src/workflows-conflicts.ts";
import {
  generatedDocumentBlock,
  generatedGitignoreBlock,
  officialEquivalent,
  type RepairDependencies,
  reapplyLocalPatches,
  repairWorkflows,
  validateMergedPatch,
  validateRetainedDocument,
  validateRetainedGitignore,
} from "../src/workflows-repair.ts";
import { repairHash } from "../src/workflows-repair-files.ts";
import { harnessVersionRel } from "../src/workflows-version.ts";

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

const legacyAgents =
  "# Project guide\nUse /aidlc to start AI-DLC.\n\n<!-- BEGIN AIDLC CURSOR -->\n# Old AI-DLC\nold text\n<!-- END AIDLC CURSOR -->\n\n## Team notes\n";
const retainedAgents = "# Project guide\nUse /aidlc to start AI-DLC.\n\n## Team notes";
const frameworkAgentsBlock =
  "<!-- BEGIN AI-DLC:cursor -->\n# AI-DLC on Cursor\nnew text\n<!-- END AI-DLC:cursor -->";

describe("legacy Markdown proposals", () => {
  it("keeps project text that mentions AI-DLC and drops the whole marked legacy block", () => {
    expect(validateRetainedDocument(legacyAgents, retainedAgents)).toBe(retainedAgents);
    expect(validateRetainedDocument(legacyAgents, retainedAgents.replace("\n\n", "\n"))).toBe(
      retainedAgents.replace("\n\n", "\n"),
    );
  });
  it.each([
    ["dropped project text", retainedAgents.replace("## Team notes", "")],
    ["kept legacy text", `${retainedAgents}\nold text`],
    ["invented text", `${retainedAgents}\nnew rule`],
    ["edited text", retainedAgents.replace("Project", "Product")],
    ["reordered text", "## Team notes\n# Project guide\nUse /aidlc to start AI-DLC."],
    ["managed markers", `${retainedAgents}\n${frameworkAgentsBlock}`],
    ["non-string", null],
  ])("rejects %s", (_label, proposal) => {
    expect(() => validateRetainedDocument(legacyAgents, proposal)).toThrow();
  });
  it("accepts deleting a document that contains only the legacy block", () => {
    const only = "<!-- BEGIN AIDLC CURSOR -->\nold\n<!-- END AIDLC CURSOR -->";
    expect(validateRetainedDocument(only, "")).toBe("");
    expect(validateRetainedDocument(only, " \n ")).toBe("");
  });
  it("refuses an unmarked document because deleted lines cannot be identified", () => {
    const unmarked = "# Mine\n\n# AI-DLC\nRun /aidlc.\n";
    expect(() => validateRetainedDocument(unmarked, "# Mine")).toThrow("区切りがない");
    expect(() => validateRetainedDocument(unmarked, unmarked.trim())).toThrow("区切りがない");
  });
  it("extracts exactly one complete generated block", () => {
    expect(generatedDocumentBlock(`intro\r\n${frameworkAgentsBlock}\r\nfooter\r\n`)).toBe(
      frameworkAgentsBlock,
    );
    for (const generated of [
      "",
      frameworkAgentsBlock.replace("<!-- END AI-DLC:cursor -->", "<!-- END AI-DLC:claude -->"),
      `${frameworkAgentsBlock}\n${frameworkAgentsBlock}`,
    ])
      expect(() => generatedDocumentBlock(generated)).toThrow("管理ブロック");
  });
});

const frameworkIgnoreBlock =
  "# BEGIN AI-DLC:gitignore\n# AI-DLC runtime\naidlc/.cache/\n# END AI-DLC:gitignore";

describe("generated gitignore block", () => {
  it.each(["\n", "\r\n"])(
    "extracts only the complete framework block with %j newlines",
    (newline) => {
      const generated = `dist\n.vscode/*\n${frameworkIgnoreBlock}\n*.local\n`.replaceAll(
        "\n",
        newline,
      );
      expect(generatedGitignoreBlock(generated, ".env\n!keep")).toBe(frameworkIgnoreBlock);
    },
  );
  it.each([
    "",
    frameworkIgnoreBlock.replace("# END AI-DLC:gitignore", ""),
    frameworkIgnoreBlock.replace("# END AI-DLC:gitignore", "# END AI-DLC:other"),
    frameworkIgnoreBlock.replace("# BEGIN AI-DLC:gitignore", "# BEGIN AI-DLC:other"),
    `${frameworkIgnoreBlock}\n${frameworkIgnoreBlock}`,
    "# END AI-DLC:gitignore\n# AI-DLC runtime\n# BEGIN AI-DLC:gitignore",
    frameworkIgnoreBlock.replace("# AI-DLC runtime", "# generic"),
  ])("rejects incomplete, mismatched or ambiguous generated blocks (%#)", (generated) => {
    expect(() => generatedGitignoreBlock(generated, "")).toThrow("公式の .gitignore");
  });
  it("refuses new generic exclusions inside the native ownership block", () => {
    const generated = frameworkIgnoreBlock.replace(
      "# AI-DLC runtime",
      "# Logs\ndist\n*.local\n# AI-DLC runtime",
    );
    expect(() => generatedGitignoreBlock(generated, "dist\n!dist/keep")).toThrow(
      "一般的な除外ルール",
    );
    expect(generatedGitignoreBlock(generated, "dist\n*.local\n!dist/keep")).toBe(generated);
  });
});

async function fixture(harness: HarnessId = "claude", files = [".claude/CLAUDE.md"]) {
  const root = await temporary(),
    release = await temporary(),
    backupParent = await temporary();
  const dir = HARNESS_DIRECTORIES[harness];
  const extraDir =
    harness === "copilot"
      ? ".github"
      : harness === "opencode"
        ? ".opencode"
        : harness === "codex"
          ? ".agents"
          : dir;
  const detector =
    harness === "copilot"
      ? ".github/skills/aidlc/SKILL.md"
      : harness === "opencode"
        ? ".opencode/command/aidlc.md"
        : `${dir}/skills/aidlc/SKILL.md`;
  put(root, detector, "skill");
  put(root, harnessVersionRel(harness), 'export const AIDLC_VERSION = "2.8.0";');
  put(root, ".aidlc-version", "2.8.0\n");
  const oldRelease = await temporary();
  for (const file of files) {
    put(root, file, "official old");
    put(release, `runtime/${harness}/${file}`, "new official");
    put(oldRelease, `runtime/${harness}/${file}`, "official old");
  }
  for (const distribution of [release, oldRelease])
    put(
      distribution,
      `runtime/${harness}/${dir}/tools/data/aidlc-projection.json`,
      JSON.stringify({
        schemaVersion: 1,
        distribution: harness,
        harnessDir: dir,
        managedDirectories: [...new Set([dir, extraDir, "aidlc"])],
        rootIntegrations:
          harness === "claude"
            ? []
            : [
                { path: "AGENTS.md", policy: "managed-block" },
                ...(harness === "opencode"
                  ? [{ path: "opencode.json", policy: "whole-file" }]
                  : []),
              ],
      }),
    );
  const install = { executable: path.join(release, "aidlc"), version: "2.8.2", binDir: release };
  const configure: RepairDependencies["configure"] = vi.fn(
    async (_install, candidate, _harness, _log, _runner, options) => {
      const conflicts = files.filter(
        (rel) =>
          existsSync(path.join(candidate, rel)) &&
          readFileSync(path.join(candidate, rel), "utf8") !== "new official",
      );
      if (conflicts.length)
        throw new NativeConfigConflict(
          conflicts.flatMap((rel) => conflict(rel).map((problem) => ({ ...problem, harness }))),
        );
      if (!options?.previewOnly) for (const file of files) put(candidate, file, "new official");
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
  return {
    root,
    release,
    oldRelease,
    backupParent,
    options,
    dependencies,
    run,
    cleanup,
    configure,
  };
}

async function gitignoreFixture(generated: string, preamble = "") {
  const f = await fixture();
  const original = `${preamble}# project\n.env\n# BEGIN AIDLC CURSOR\n# old rules\naidlc/.cache/\n# END AIDLC CURSOR\ncache/\n!cache/keep\n`;
  const retained = `${preamble}# project\n.env\naidlc/.cache/\ncache/\n!cache/keep`;
  put(f.root, ".gitignore", original);
  f.dependencies.configure = vi.fn(async (...args) => {
    if (readFileSync(path.join(args[1], ".gitignore"), "utf8").includes("# BEGIN AIDLC CURSOR"))
      throw new NativeConfigConflict([
        ...conflict(),
        ...conflict(".gitignore", "legacy root integration ambiguous"),
      ]);
    return f.configure(...args);
  });
  f.dependencies.pristine = vi.fn(async (_install, candidate) => {
    put(candidate, ".gitignore", generated);
    return { doctorOk: true, details: "", planToken: "token" };
  });
  f.run.mockResolvedValue(JSON.stringify({ proceed: true, retainedGitignore: retained }));
  return { ...f, original, retained };
}

describe("legacy gitignore repair", () => {
  it("cancels provider detection before creating a scratch session or sending a proposal", async () => {
    const f = await fixture();
    const controller = new AbortController();
    const reason = new Error("cancelled during provider detection");
    f.dependencies.probe = vi.fn(async (_tool, signal) => {
      expect(signal).toBe(controller.signal);
      controller.abort(reason);
      signal?.throwIfAborted();
      throw new Error("expected cancellation");
    });
    await expect(
      repairWorkflows({ ...f.options, tool: "claude", signal: controller.signal }, f.dependencies),
    ).rejects.toBe(reason);
    expect(f.dependencies.probe).toHaveBeenCalledOnce();
    expect(f.dependencies.scratch).not.toHaveBeenCalled();
    expect(f.run).not.toHaveBeenCalled();
  });
  it.each(["\n", "\r\n"])(
    "keeps existing rules and excludes generated preamble and suffix with %j newlines",
    async (newline) => {
      const f = await gitignoreFixture(
        `dist\n.vscode/*\n${frameworkIgnoreBlock}\n*.local\n`.replaceAll("\n", newline),
      );
      const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
      expect(result.problems).toEqual([]);
      expect(result.changed).toContain(".gitignore");
      expect(readFileSync(path.join(f.root, ".gitignore"), "utf8")).toBe(
        `${frameworkIgnoreBlock}\n\n${f.retained}\n`,
      );
      expect(readFileSync(path.join(f.root, ".aidlc-version"), "utf8")).toBe("2.8.0\n");
      const manifest = JSON.parse(
        readFileSync(path.join(result.backup ?? "", "manifest.json"), "utf8"),
      );
      const saved = manifest.changes.find(
        (change: { path: string }) => change.path === ".gitignore",
      );
      expect(readFileSync(path.join(result.backup ?? "", saved.backup), "utf8")).toBe(f.original);
    },
  );
  it("keeps native ownership bytes when generic rules are already in the project", async () => {
    const block = frameworkIgnoreBlock.replace(
      "# AI-DLC runtime",
      "# Logs\ndist\n*.local\n# AI-DLC runtime",
    );
    const f = await gitignoreFixture(block, "dist\n*.local\n!dist/keep\n");
    const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
    expect(result.problems).toEqual([]);
    expect(readFileSync(path.join(f.root, ".gitignore"), "utf8")).toBe(
      `${block}\n\n${f.retained}\n`,
    );
  });
  it.each([
    frameworkIgnoreBlock.replace("# AI-DLC runtime", "dist\n# AI-DLC runtime"),
    frameworkIgnoreBlock.replace("# END AI-DLC:gitignore", "# END AI-DLC:other"),
  ])(
    "leaves every original file unchanged when generated rules are unsafe (%#)",
    async (generated) => {
      const f = await gitignoreFixture(generated);
      await expect(
        repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies),
      ).rejects.toThrow("公式の .gitignore");
      expect(readFileSync(path.join(f.root, ".gitignore"), "utf8")).toBe(f.original);
      expect(readFileSync(path.join(f.root, ".claude/CLAUDE.md"), "utf8")).toBe("official old");
      expect(readFileSync(path.join(f.root, ".aidlc-version"), "utf8")).toBe("2.8.0\n");
      expect(f.dependencies.configure).toHaveBeenCalledTimes(1);
    },
  );
});

describe("local patches on official files", () => {
  const base = "a\nb\nc";
  const local = "a\nb\npatch\nc";
  const target = "a\nb2\nc";
  it("accepts a merge built only from existing lines that keeps every added line", () => {
    expect(validateMergedPatch(base, local, target, "a\nb2\npatch\nc")).toBe("a\nb2\npatch\nc");
  });
  it.each([
    ["missing patch line", "a\nb2\nc"],
    ["dropped official lines", "patch"],
    ["invented line", "a\nb2\npatch\nc\nextra"],
    ["empty", ""],
    ["non-string", null],
  ])("rejects %s", (_label, merged) => {
    expect(() => validateMergedPatch(base, local, target, merged)).toThrow();
  });
  it("re-applies only onto the exact official bytes it expects", async () => {
    const root = await temporary();
    put(root, "a.ts", "official\r\n");
    put(root, "b.ts", "someone else's edit");
    const officialHash = repairHash("official\n");
    expect(
      reapplyLocalPatches(root, [
        { path: "a.ts", officialHash, content: "patched" },
        { path: "b.ts", officialHash, content: "patched" },
        { path: "missing.ts", officialHash, content: "patched" },
      ]),
    ).toEqual({ applied: ["a.ts"], skipped: ["b.ts", "missing.ts"] });
    expect(readFileSync(path.join(root, "a.ts"), "utf8")).toBe("patched");
    expect(readFileSync(path.join(root, "b.ts"), "utf8")).toBe("someone else's edit");
  });
  it("restores the official file for the update and returns the AI-merged patch", async () => {
    const f = await fixture();
    put(f.root, ".claude/CLAUDE.md", "official old\npatched line");
    f.run.mockResolvedValue(
      JSON.stringify({
        proceed: true,
        mergedFiles: { ".claude/CLAUDE.md": "new official\npatched line" },
      }),
    );
    const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
    expect(result.problems).toEqual([]);
    expect(readFileSync(path.join(f.root, ".claude/CLAUDE.md"), "utf8")).toBe("new official");
    expect(result.patches).toEqual([
      {
        path: ".claude/CLAUDE.md",
        officialHash: repairHash("new official"),
        content: "new official\npatched line",
      },
    ]);
    expect(result.message).toContain("更新の完了後に当て直します");
    expect(f.run.mock.calls[0]?.[0].prompt).toContain("patched line");
  });
  it("keeps the patch without asking AI when the official file did not change", async () => {
    const f = await fixture();
    put(f.root, harnessVersionRel("claude"), 'export const AIDLC_VERSION = "2.8.2";');
    put(f.root, ".claude/CLAUDE.md", "new official\npatched line");
    const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
    expect(result.patches?.[0]?.content).toBe("new official\npatched line");
    expect(f.run.mock.calls[0]?.[0].prompt).not.toContain("patched line");
  });
  it("leaves a local edit unchanged when the previous official copy is unavailable", async () => {
    const f = await fixture();
    put(f.root, ".claude/CLAUDE.md", "official old\npatched line");
    put(f.root, harnessVersionRel("claude"), 'export const AIDLC_VERSION = "2.7.0";');
    const readInstall = f.dependencies.readInstall;
    f.dependencies.readInstall = (version) =>
      version === "2.7.0" ? null : (readInstall?.(version) ?? null);
    const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
    expect(result.patches ?? []).toEqual([]);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(readFileSync(path.join(f.root, ".claude/CLAUDE.md"), "utf8")).toBe(
      "official old\npatched line",
    );
  });
});

describe("legacy Markdown repair", () => {
  async function agentsFixture(retained: string) {
    const f = await fixture();
    put(f.root, "AGENTS.md", legacyAgents);
    f.dependencies.configure = vi.fn(async (...args) => {
      if (!readFileSync(path.join(args[1], "AGENTS.md"), "utf8").includes("<!-- BEGIN AI-DLC:"))
        throw new NativeConfigConflict([
          ...conflict(),
          ...conflict("AGENTS.md", "legacy root integration ambiguous").map((problem) => ({
            ...problem,
            harness: "cursor" as const,
          })),
        ]);
      return f.configure(...args);
    });
    f.dependencies.pristine = vi.fn(async (_install, candidate) => {
      put(candidate, "AGENTS.md", `${frameworkAgentsBlock}\n`);
      return { doctorOk: true, details: "", planToken: "token" };
    });
    f.run.mockResolvedValue(
      JSON.stringify({ proceed: true, retainedDocuments: { "AGENTS.md": retained } }),
    );
    return f;
  }
  it("keeps project text, replaces the old block with the official one and backs up", async () => {
    const f = await agentsFixture(retainedAgents);
    const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
    expect(result.problems).toEqual([]);
    expect(result.changed).toContain("AGENTS.md");
    expect(readFileSync(path.join(f.root, "AGENTS.md"), "utf8")).toBe(
      `${retainedAgents}\n\n${frameworkAgentsBlock}\n`,
    );
    expect(f.dependencies.pristine).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      "cursor",
      expect.any(Function),
      undefined,
      expect.objectContaining({ mcp: "none" }),
    );
    expect(f.run.mock.calls[0]?.[0].prompt).toContain("old text");
  });
  it("leaves the original file unchanged when AI drops project text", async () => {
    const f = await agentsFixture("# Project guide");
    await expect(
      repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies),
    ).rejects.toThrow("独自の文章");
    expect(readFileSync(path.join(f.root, "AGENTS.md"), "utf8")).toBe(legacyAgents);
  });
});

const multiDirectoryHarnesses: { harness: HarnessId; files: string[] }[] = [
  {
    harness: "copilot",
    files: [
      ".github/skills/aidlc/SKILL.md",
      ".github/agents/aidlc-product-agent.md",
      ".github/hooks/aidlc.json",
      "AGENTS.md",
    ],
  },
  {
    harness: "opencode",
    files: [
      ".opencode/command/aidlc.md",
      ".opencode/agents/aidlc-product-agent.md",
      ".opencode/plugin/aidlc-opencode-adapter.ts",
      "AGENTS.md",
      "opencode.json",
    ],
  },
  { harness: "codex", files: [".agents/skills/aidlc/SKILL.md", "AGENTS.md"] },
];

describe.each(multiDirectoryHarnesses)("$harness repair distribution", ({ harness, files }) => {
  it.each(["prior", "target"])(
    "repairs every managed directory and root file matching the %s distribution",
    async (reference) => {
      const f = await fixture(harness, files);
      if (reference === "target") {
        for (const file of files) put(f.release, `runtime/${harness}/${file}`, "official old");
        const readInstall = f.dependencies.readInstall;
        f.dependencies.readInstall = (version) =>
          version === "2.8.0" ? null : (readInstall?.(version) ?? null);
      }
      const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
      expect(result.problems).toEqual([]);
      expect(result.changed?.sort()).toEqual([...files].sort());
      for (const file of files)
        expect(readFileSync(path.join(f.root, file), "utf8")).toBe("new official");
      expect(readFileSync(path.join(f.root, ".aidlc-version"), "utf8")).toBe("2.8.0\n");
    },
  );
  it.each(["AGENTS.md", files[0] ?? ""])(
    "preserves custom edits to %s and leaves other files untouched",
    async (file) => {
      const f = await fixture(harness, files);
      put(f.root, file, "user instructions");
      const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
      expect(result.problems.map((problem) => problem.path)).toEqual([file]);
      expect(result.changed).toBeUndefined();
      for (const rel of files)
        expect(readFileSync(path.join(f.root, rel), "utf8")).toBe(
          rel === file ? "user instructions" : "official old",
        );
    },
  );
});

describe("repair workflow", () => {
  it.each([
    ".mcp.json",
    "aidlc/spaces/default/memory/project.md",
    ".claude/tools/data/aidlc-manifest.json",
    ".claude/tools/data/aidlc-guide-install.json",
  ])(
    "does not regenerate undeclared files, team memory or ownership metadata: %s",
    async (file) => {
      const f = await fixture("claude", [file]);
      const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
      expect(result.problems.map((problem) => problem.path)).toEqual([file]);
      expect(result.changed).toBeUndefined();
      expect(readFileSync(path.join(f.root, file), "utf8")).toBe("official old");
    },
  );
  it("refuses distributions with a mismatched harness identity", async () => {
    const f = await fixture();
    for (const distribution of [f.release, f.oldRelease])
      put(
        distribution,
        "runtime/claude/.claude/tools/data/aidlc-projection.json",
        JSON.stringify({
          schemaVersion: 1,
          distribution: "copilot",
          harnessDir: ".claude",
          managedDirectories: [".claude"],
          rootIntegrations: [],
        }),
      );
    const result = await repairWorkflows({ ...f.options, tool: "claude" }, f.dependencies);
    expect(result.problems).toHaveLength(1);
    expect(result.changed).toBeUndefined();
  });
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
