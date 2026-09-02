import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildArtifactMap,
  extractOutputRows,
  OUT_REL,
  positionalAgreement,
  readCommittedMap,
  readSourceVersion,
  regenerateArtifactMap,
  resolveFileNames,
  serialize,
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
        description: "descriptive, team-voice prose. Five sections matching team.md headings.",
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
    expect(resolved["build-test-results"]?.candidates[0]).toBe("test-results.md");
    expect(resolved["build-test-results"]?.guessed).toBe(false);
    expect(resolved["build-instructions"]?.candidates[0]).toBe("build-instructions.md");
  });

  /**
   * Equal length is not alignment. The artifacts that match by name are the
   * witnesses: here `build-instructions.md` sits at index 2 while its artifact
   * is at index 0, which proves the lists are not positionally aligned — so the
   * aliased artifact must not be handed the file at its own index
   * (`build-instructions.md`, an entirely different artifact).
   */
  it("rejects position when the exact matches show the list is reordered", () => {
    const resolved = resolveFileNames(
      produces,
      "test-results.md, build-and-test-summary.md, build-instructions.md",
    );
    expect(resolved["build-instructions"]?.candidates[0]).toBe("build-instructions.md");
    expect(resolved["build-instructions"]?.guessed).toBe(false);
    expect(resolved["build-test-results"]?.candidates[0]).not.toBe("build-instructions.md");
    expect(resolved["build-test-results"]?.guessed).toBe(true);
  });

  /**
   * The dangerous case: `outputs:` exists but does not name this artifact, so
   * neither an exact stem nor a safe position answers. The probe still returns
   * something, and that something is a guess.
   */
  it("flags an artifact the outputs line does not name", () => {
    const resolved = resolveFileNames(produces, "test-results.md");
    expect(resolved["build-test-results"]?.candidates).toEqual([
      "build-test-results.md",
      "build-test-results.json",
    ]);
    expect(resolved["build-test-results"]?.guessed).toBe(true);
  });

  it("flags every artifact when the stage declares no outputs line", () => {
    expect(resolveFileNames(["traceability"], null)).toEqual({
      traceability: { candidates: ["traceability.md", "traceability.json"], guessed: true },
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

  it("keeps link text and drops the target, which does not resolve from a card", () => {
    expect(tidyDescription("see [Runtime graph](../13-runtime-graph.md) for the DAG")).toBe(
      "see Runtime graph for the DAG",
    );
  });

  it("keeps the contents of a code span and drops its backticks", () => {
    expect(tidyDescription("the fenced `yaml` block mirrors `bolt_dag.units[].kind`")).toBe(
      "the fenced yaml block mirrors bolt_dag.units[].kind",
    );
  });

  it("keeps an emphasised word and drops its markers", () => {
    expect(tidyDescription("the **final stage** of the workflow")).toBe(
      "the final stage of the workflow",
    );
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
   * The ja construction and operation pages translate the filename column, so
   * their descriptions are paired by row index and `positionalAgreement` can
   * corroborate nothing there. An en table that reorders while ja does not
   * would therefore re-pair silently onto the wrong artifacts — so the recorded
   * en order is compared against the committed map and the write is refused.
   */
  /** Swap two rows of the en operation Outputs table, in place. */
  function reorderEnOutputs(root: string): void {
    const page = path.join(root, "docs", "reference", "en", "04-stages", "operation.md");
    const lines = readFileSync(page, "utf8").split("\n");
    const at = lines.reduce<number[]>((found, line, index) => {
      if (line.startsWith("| cd-config.md") || line.startsWith("| deployment-strategy.md")) {
        found.push(index);
      }
      return found;
    }, []);
    const [first = 0, second = 0] = at;
    const swapped = lines[first] ?? "";
    lines[first] = lines[second] ?? "";
    lines[second] = swapped;
    writeFileSync(page, lines.join("\n"));
  }

  it("drops ja rather than re-pairing it when the en Outputs rows reordered", () => {
    const root = copyWorkspace();
    const before = readFileSync(path.join(root, OUT_REL), "utf8");
    reorderEnOutputs(root);

    const built = buildArtifactMap(root, readSourceVersion(root), readCommittedMap(root));
    expect(built.reorderedStages).toEqual(["deployment-pipeline"]);
    // Dropped, not re-paired: every ja description on that stage goes null so
    // the card falls back to English.
    const stage = built.map.stages["deployment-pipeline"];
    for (const [artifact, entry] of Object.entries(stage?.artifacts ?? {})) {
      expect(entry.descriptions.ja, artifact).toBeNull();
      expect(entry.descriptions.en, artifact).not.toBeNull();
    }
    // And the write still happens: this fires during a docs sync, whose PR is
    // where the ja page would be updated. Blocking it would deadlock that.
    expect(regenerateArtifactMap(root)).toBe(true);
    expect(readFileSync(path.join(root, OUT_REL), "utf8")).not.toBe(before);
  });

  it("refuses to write a map whose filenames would be guessed", () => {
    const root = copyWorkspace();
    const before = readFileSync(path.join(root, OUT_REL), "utf8");
    rmSync(path.join(root, ".claude", "aidlc-common", "stages"), { recursive: true });
    rmSync(path.join(root, "packages", "docs-bridge", "data", "upstream-stages"), {
      recursive: true,
    });

    expect(regenerateArtifactMap(root)).toBe(false);
    expect(readFileSync(path.join(root, OUT_REL), "utf8")).toBe(before);
  });

  /**
   * Adopting the new order as the baseline would make the next derivation see
   * no reorder, re-pair the stale ja rows onto the wrong artifacts, and differ
   * from what was just written — failing the byte-identity gate the docs sync
   * runs before it can open the PR that carries the new translation. The state
   * has to be stable, so the trusted order stays put until it is confirmed.
   */
  it("keeps the trusted order so a dropped pairing survives the next derivation", () => {
    const root = copyWorkspace();
    reorderEnOutputs(root);

    expect(regenerateArtifactMap(root)).toBe(true);
    const written = readFileSync(path.join(root, OUT_REL), "utf8");

    const second = buildArtifactMap(root, readSourceVersion(root), readCommittedMap(root));
    expect(second.reorderedStages).toEqual(["deployment-pipeline"]);
    expect(serialize(second.map)).toBe(written);
  });

  it("re-pairs on --accept-ja-order, which is how a human confirms the ja page", () => {
    const root = copyWorkspace();
    reorderEnOutputs(root);
    regenerateArtifactMap(root);

    const accepted = buildArtifactMap(root, readSourceVersion(root), readCommittedMap(root), true);
    const stage = accepted.map.stages["deployment-pipeline"];
    expect(accepted.reorderedStages).toEqual([]);
    expect(stage?.joinOrder?.[0]).toBe("deployment-strategy.md");
    for (const entry of Object.values(stage?.artifacts ?? {})) {
      expect(entry.descriptions.ja).not.toBeNull();
    }
  });

  it("no-ops on a workspace that carries docs but no artifact map to keep", () => {
    const root = mkdtempSync(path.join(tmpdir(), "artifact-map-"));
    mkdirSync(path.join(root, "docs", "reference", "en", "04-stages"), { recursive: true });
    writeFileSync(path.join(root, "docs", "reference", "en", "04-stages", "ideation.md"), "# x\n");
    expect(regenerateArtifactMap(root)).toBe(false);
  });
});
