import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BundledPluginCatalog } from "../packages/shared-types/src/bundled-plugins.ts";
import {
  buildCatalog,
  diffTrees,
  parseListing,
  regenerateCatalog,
  scopeStages,
} from "./build-bundled-plugins.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const listing = {
  title: "focus",
  tagline: "一文",
  status: "preview",
  harness: "claude",
  scope: "focus-flow",
  summary: "説明",
  fitFor: ["a"],
  notFitFor: ["b"],
  requirements: [{ id: "opus", level: "info", label: "Opus", detail: "d" }],
  startCommand: "/aidlc --scope focus-flow",
  sample: { file: "sample/a.svg", alt: "見本" },
};

describe("parseListing", () => {
  it("accepts a complete listing", () => {
    expect(parseListing(listing, "focus")).toMatchObject({ title: "focus", status: "preview" });
    expect(parseListing({ ...listing, sample: null }, "focus").sample).toBeNull();
  });

  it("names what is wrong with a listing", () => {
    expect(() => parseListing({ ...listing, title: "" }, "focus")).toThrow(/title/);
    expect(() => parseListing({ ...listing, status: "beta" }, "focus")).toThrow(/status/);
    expect(() => parseListing({ ...listing, fitFor: "a" }, "focus")).toThrow(/fitFor/);
    expect(() =>
      parseListing(
        { ...listing, requirements: [{ ...listing.requirements[0], level: "must" }] },
        "focus",
      ),
    ).toThrow(/level/);
    expect(() => parseListing({ ...listing, harness: "codex" }, "focus")).toThrow(/harness/);
    expect(() => parseListing([], "focus")).toThrow(/focus/);
  });

  it("keeps the sample inside the listing's folder", () => {
    for (const file of ["../README.md", "/etc/a.svg", "sample\\a.svg", "sample/a.png"])
      expect(() => parseListing({ ...listing, sample: { file, alt: "x" } }, "focus"), file).toThrow(
        /sample/,
      );
  });
});

describe("diffTrees", () => {
  it("reports added and changed files, sorted, and leaves the rest out", () => {
    const before = new Map([
      [".claude/a.md", "1"],
      [".claude/b.md", "2"],
      [".claude/gone.md", "3"],
    ]);
    const after = new Map([
      [".claude/b.md", "changed"],
      [".claude/a.md", "1"],
      [".claude/z.md", "new"],
      [".claude/c.md", "new"],
    ]);
    expect(diffTrees(before, after)).toEqual({
      added: [".claude/c.md", ".claude/z.md"],
      changed: [".claude/b.md"],
    });
  });
});

describe("scopeStages", () => {
  const graph = [
    { slug: "state-init", name: "State Init", phase: "initialization" },
    { slug: "requirements-analysis", name: "Requirements Analysis", phase: "inception" },
    { slug: "user-stories", name: "User Stories", phase: "inception" },
    { slug: "units-generation", name: "Units Generation", phase: "inception" },
    {
      slug: "x-test",
      name: "テスト",
      phase: "construction",
      plugin: "x",
      for_each: "unit-of-work",
    },
  ];
  const grid = {
    "x-flow": {
      stages: {
        "state-init": "EXECUTE",
        "requirements-analysis": "EXECUTE",
        "user-stories": "SKIP",
        "units-generation": "EXECUTE",
        "x-test": "EXECUTE",
      },
    },
  };

  it("lists what the scope runs past initialization, in graph order, by origin", () => {
    expect(scopeStages(graph, grid, "x-flow", "x", new Set(["requirements-analysis"]))).toEqual([
      {
        slug: "requirements-analysis",
        name: "Requirements Analysis",
        phase: "inception",
        origin: "core-extended",
        perUnit: false,
      },
      {
        slug: "units-generation",
        name: "Units Generation",
        phase: "inception",
        origin: "core",
        perUnit: false,
      },
      { slug: "x-test", name: "テスト", phase: "construction", origin: "plugin", perUnit: true },
    ]);
  });

  it("refuses a scope the composed graph does not know", () => {
    expect(() => scopeStages(graph, grid, "missing", "x", new Set())).toThrow(/missing/);
  });
});

describe("the focus catalog", () => {
  let catalog: BundledPluginCatalog;
  let work: string;
  beforeAll(async () => {
    work = mkdtempSync(path.join(tmpdir(), "bundled-plugins-"));
    catalog = await buildCatalog(root, work);
  }, 120_000);
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it("describes focus from its listing and from composing it", () => {
    const focus = catalog.plugins.find((plugin) => plugin.name === "focus");
    expect(focus).toBeDefined();
    if (focus === undefined) return;
    expect(focus.version).toBe("0.1.0");
    expect(focus.sourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(focus.status).toBe("preview");
    expect(focus.stages.map((stage) => [stage.slug, stage.origin])).toEqual([
      ["reverse-engineering", "core-extended"],
      ["requirements-analysis", "core-extended"],
      ["domain-design", "core-extended"],
      ["units-generation", "core-extended"],
      ["delivery-planning", "core-extended"],
      ["focus-test", "plugin"],
      ["focus-implement", "plugin"],
    ]);
    expect(focus.files.added).toEqual(
      expect.arrayContaining([
        ".claude/aidlc-common/stages/construction/focus-test.md",
        ".claude/agents/focus-reviewer-agent.md",
        ".claude/tools/aidlc-sensor-focus-diagrams.ts",
      ]),
    );
    expect(focus.files.changed).toEqual(
      expect.arrayContaining([
        ".claude/aidlc-common/stages/inception/requirements-analysis.md",
        ".claude/tools/data/stage-graph.json",
      ]),
    );
    // Nothing outside the harness tree.
    for (const file of [...focus.files.added, ...focus.files.changed])
      expect(file.startsWith(".claude/"), file).toBe(true);
    expect(focus.sample?.svg).toContain("<svg");
  });

  it("is what the repository has committed", async () => {
    await expect(regenerateCatalog(root, true)).resolves.toBeUndefined();
  }, 120_000);
});
