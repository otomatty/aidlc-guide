import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractOutputRows,
  OUT_REL,
  positionalAgreement,
  regenerateArtifactMap,
  resolveFileNames,
  splitStageSections,
  tidyDescription,
} from "./build-artifact-map.ts";

describe("extractOutputRows", () => {
  it("reads a two-column table, dropping header and separator rows", () => {
    const rows = extractOutputRows(
      [
        "| File | Contents |",
        "|------|----------|",
        "| `unit-of-work.md` | Unit definitions, responsibilities |",
        "| `traceability.json` | Coverage table |",
      ].join("\n"),
    );
    expect(rows).toEqual([
      { fileName: "unit-of-work.md", description: "Unit definitions, responsibilities" },
      { fileName: "traceability.json", description: "Coverage table" },
    ]);
  });

  it("skips the ordinal column of a numbered table", () => {
    const rows = extractOutputRows(
      [
        "| # | File | Contents |",
        "|---|------|----------|",
        "| 1 | `architecture.md` | Patterns |",
      ].join("\n"),
    );
    expect(rows).toEqual([{ fileName: "architecture.md", description: "Patterns" }]);
  });

  it("drops a trailing Condition column, which is not part of the description", () => {
    const rows = extractOutputRows(
      [
        "| Artifact | Description | Condition |",
        "|----------|-------------|-----------|",
        "| build-instructions.md | Build commands | Always |",
      ].join("\n"),
    );
    expect(rows[0]?.description).toBe("Build commands");
  });

  it("keeps a translated label as a row with no filename", () => {
    const rows = extractOutputRows(
      ["| 成果物 | 説明 |", "|--------|------|", "| CD 設定文書 | CD パイプライン設定 |"].join(
        "\n",
      ),
    );
    expect(rows).toEqual([{ fileName: null, description: "CD パイプライン設定" }]);
  });

  it("reads a bullet list and joins its wrapped continuation lines", () => {
    const rows = extractOutputRows(
      [
        "- `team-practices.md` -- descriptive, team-voice prose. Five sections",
        "  matching `team.md` headings.",
        "- `evidence.md` -- per-agent finding summary.",
      ].join("\n"),
    );
    expect(rows).toEqual([
      {
        fileName: "team-practices.md",
        description: "descriptive, team-voice prose. Five sections matching `team.md` headings.",
      },
      { fileName: "evidence.md", description: "per-agent finding summary." },
    ]);
  });

  it("ignores prose bullets naming a path rather than an artifact", () => {
    const rows = extractOutputRows(
      [
        "- `aidlc/spaces/<active-space>/memory/team.md` -- section-replace on promotion.",
        "- `contributions/aidlc-{quality,developer}-agent.md` -- spoke contributions.",
      ].join("\n"),
    );
    expect(rows).toEqual([]);
  });
});

describe("splitStageSections", () => {
  const page = [
    "# Inception",
    "",
    "## Stage 2.7: Units Generation",
    "",
    "### Purpose",
    "",
    "Decomposes the design.",
    "",
    "### Outputs",
    "",
    "| File | Contents |",
    "|------|----------|",
    "| `unit-of-work.md` | Unit definitions |",
    "",
    "### Approval Gate",
    "",
    "| File | Contents |",
    "| `not-an-output.md` | Belongs to another section |",
    "",
    "## Stage 2.8: Contract Design",
    "",
    "### Outputs",
    "",
    "- `contract-summary.md` -- the pinned contracts.",
  ].join("\n");

  it("keys sections by stage number and stops Outputs at the next heading", () => {
    const sections = splitStageSections(page, "inception");
    expect(sections.map((s) => s.number)).toEqual(["2.7", "2.8"]);
    expect(sections[0]?.rows).toEqual([
      { fileName: "unit-of-work.md", description: "Unit definitions" },
    ]);
    expect(sections[1]?.rows).toEqual([
      { fileName: "contract-summary.md", description: "the pinned contracts." },
    ]);
  });

  it("records the GitHub anchor and DocPath of each section", () => {
    const [first] = splitStageSections(page, "inception");
    expect(first?.anchor).toBe("#stage-27-units-generation");
    expect(first?.docPath).toBe("reference/04-stages/inception.md");
  });

  it("reads the Japanese headings of the same page shape", () => {
    const sections = splitStageSections(
      [
        "## ステージ 2.7: 単位生成",
        "",
        "### 出力",
        "",
        "| `unit-of-work.md` | ユニット定義 |",
      ].join("\n"),
      "inception",
    );
    expect(sections[0]?.number).toBe("2.7");
    expect(sections[0]?.rows[0]?.description).toBe("ユニット定義");
  });

  it("reads the em-dash headings the initialization page uses", () => {
    const sections = splitStageSections(
      [
        "## Stage 0.1 — Workspace Scaffold",
        "",
        "### Outputs",
        "",
        "- `scaffold-report.md` -- what was created.",
      ].join("\n"),
      "initialization",
    );
    expect(sections[0]?.number).toBe("0.1");
  });

  it("keeps the first Outputs section when a stage also has a Key Outputs one", () => {
    const sections = splitStageSections(
      [
        "## Stage 1.1: Intent Capture",
        "### Outputs",
        "| `intent-statement.md` | The real one |",
        "### Notes",
        "### Key Outputs",
        "| `intent-statement.md` | A later summary |",
      ].join("\n"),
      "ideation",
    );
    expect(sections[0]?.rows).toEqual([
      { fileName: "intent-statement.md", description: "The real one" },
    ]);
  });
});

describe("resolveFileNames", () => {
  const produces = ["build-instructions", "build-and-test-summary", "build-test-results"];

  it("resolves a canonical name whose file is named differently", () => {
    const resolved = resolveFileNames(
      produces,
      "build-instructions.md, build-and-test-summary.md, test-results.md (engine-resolved)",
    );
    expect(resolved["build-test-results"]?.[0]).toBe("test-results.md");
    expect(resolved["build-instructions"]?.[0]).toBe("build-instructions.md");
  });

  it("prefers an exact stem match over position when the list is reordered", () => {
    const resolved = resolveFileNames(
      produces,
      "test-results.md, build-and-test-summary.md, build-instructions.md",
    );
    expect(resolved["build-instructions"]?.[0]).toBe("build-instructions.md");
  });

  it("ignores position entirely when the two lists differ in length", () => {
    const resolved = resolveFileNames(produces, "test-results.md");
    expect(resolved["build-test-results"]).toEqual([
      "build-test-results.md",
      "build-test-results.json",
    ]);
  });

  it("probes both extensions when the stage declares no outputs line", () => {
    expect(resolveFileNames(["traceability"], null)).toEqual({
      traceability: ["traceability.md", "traceability.json"],
    });
  });
});

describe("positionalAgreement", () => {
  const en = [
    { fileName: "a.md", description: "A" },
    { fileName: "b.md", description: "B" },
  ];

  it("agrees when the translation keeps row order", () => {
    const ja = [
      { fileName: "a.md", description: "あ" },
      { fileName: "b.md", description: "い" },
    ];
    expect(positionalAgreement(en, ja)).toEqual({ checked: 2, agreed: 2 });
  });

  it("reports disagreement when the translation reorders rows", () => {
    const ja = [
      { fileName: "b.md", description: "い" },
      { fileName: "a.md", description: "あ" },
    ];
    expect(positionalAgreement(en, ja)).toEqual({ checked: 2, agreed: 0 });
  });

  it("checks nothing when the row counts differ, so position is never trusted", () => {
    expect(positionalAgreement(en, [{ fileName: "a.md", description: "あ" }])).toEqual({
      checked: 0,
      agreed: 0,
    });
  });

  it("skips rows whose label is translated, since they carry no filename", () => {
    const ja = [
      { fileName: null, description: "あ" },
      { fileName: "b.md", description: "い" },
    ];
    expect(positionalAgreement(en, ja)).toEqual({ checked: 1, agreed: 1 });
  });
});

describe("tidyDescription", () => {
  it("collapses wrapped whitespace and strips the leading dash separator", () => {
    expect(tidyDescription("--  per-agent finding\n  summary.")).toBe("per-agent finding summary.");
  });

  it("strips an em dash separator too", () => {
    expect(tidyDescription("— チームの語り口")).toBe("チームの語り口");
  });
});

describe("regenerateArtifactMap", () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");

  /**
   * A copy, not this repository: the real file is read by
   * `packages/docs-bridge/tests/artifact-map.test.ts`, which vitest may be
   * running in a parallel worker. Writing it here would race that read and
   * leave the tree dirty on a genuine mismatch.
   */
  function copyWorkspace(): string {
    const root = mkdtempSync(path.join(tmpdir(), "artifact-map-"));
    for (const rel of [
      path.join("packages", "docs-bridge", "data"),
      path.join(".claude", "tools", "data"),
      path.join(".claude", "aidlc-common", "stages"),
      path.join("docs", "reference"),
    ]) {
      cpSync(path.join(repoRoot, rel), path.join(root, rel), { recursive: true });
    }
    return root;
  }

  it("rewrites the map from the workspace's own snapshot", () => {
    const root = copyWorkspace();
    const before = readFileSync(path.join(root, OUT_REL), "utf8");
    writeFileSync(path.join(root, OUT_REL), '{"stale": true}\n');

    expect(regenerateArtifactMap(root)).toBe(true);
    expect(readFileSync(path.join(root, OUT_REL), "utf8")).toBe(before);
  });

  /**
   * The `outputs:` frontmatter is where `traceability` -> `traceability.json`
   * comes from. Without the stage files the probe falls back to `.md` and every
   * aliased filename is silently wrong, so a workspace missing them must not be
   * written at all.
   */
  it("refuses to write a map whose filenames would be guessed", () => {
    const root = copyWorkspace();
    const before = readFileSync(path.join(root, OUT_REL), "utf8");
    rmSync(path.join(root, ".claude", "aidlc-common", "stages"), { recursive: true });

    expect(regenerateArtifactMap(root)).toBe(false);
    expect(readFileSync(path.join(root, OUT_REL), "utf8")).toBe(before);
  });

  it("no-ops on a workspace that carries docs but no artifact map to keep", () => {
    const root = mkdtempSync(path.join(tmpdir(), "artifact-map-"));
    mkdirSync(path.join(root, "docs", "reference", "en", "04-stages"), { recursive: true });
    writeFileSync(path.join(root, "docs", "reference", "en", "04-stages", "ideation.md"), "# x\n");
    expect(regenerateArtifactMap(root)).toBe(false);
  });
});
