import type { Phase, StageStatus } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { parseState, readState, SUPPORTED_STATE_VERSION } from "../src/parse/state.ts";
import { expectOk, fixture, REAL_RECORD } from "./paths.ts";

const KNOWN_PHASES: Phase[] = [
  "INITIALIZATION",
  "IDEATION",
  "INCEPTION",
  "CONSTRUCTION",
  "OPERATION",
];
const KNOWN_STATUSES: StageStatus[] = [
  "not-started",
  "in-progress",
  "awaiting-approval",
  "revising",
  "completed",
  "skipped",
];

describe("readState — golden snapshot (pinned copy of the real State Version 7 file)", () => {
  it("parses every section of the real format", async () => {
    const { value, warnings } = expectOk(await readState(fixture("golden")));

    expect(value.stateVersion).toBe(SUPPORTED_STATE_VERSION);
    expect(value.project).toBe("PRDに従って実装をしてください");
    expect(value.scope).toBe("prd-implementation");
    expect(value.depth).toBe("Standard");
    expect(value.phase).toBe("CONSTRUCTION");
    expect(value.currentStage).toBe("code-generation");
    expect(value.nextStage).toBe("build-and-test");
    // The current stage's own mark — `[-]` in the snapshot, so no gate is open.
    expect(value.gate).toBe("in-progress");
    expect(value.done).toBe(17);
    expect(value.total).toBe(21);
    expect(value.unparseable).toBeUndefined();
    // G-6 agrees with the EXECUTE tally in this snapshot, so no warning.
    expect(warnings).toBeUndefined();

    // 32 checkbox rows across the five phase headings.
    expect(value.stages).toHaveLength(32);
    expect(value.stages.filter((s) => s.execution === "EXECUTE")).toHaveLength(21);
    expect(value.stages.filter((s) => s.phase === "CONSTRUCTION").map((s) => s.slug)).toEqual([
      "functional-design",
      "nfr-requirements",
      "nfr-design",
      "infrastructure-design",
      "code-generation",
      "build-and-test",
      "ci-pipeline",
    ]);
    expect(value.stages.find((s) => s.slug === "code-generation")).toEqual({
      slug: "code-generation",
      phase: "CONSTRUCTION",
      execution: "EXECUTE",
      status: "in-progress",
    });
    // `- [ ] market-research — SKIP`: an unticked box that is out of scope, so
    // it reads as skipped rather than not-started.
    expect(value.stages.find((s) => s.slug === "market-research")).toEqual({
      slug: "market-research",
      phase: "IDEATION",
      execution: "SKIP",
      status: "skipped",
    });
    expect(value.stages.every((s) => s.unparseable === undefined)).toBe(true);
  });
});

describe("readState — live record (structural, values move as the workflow advances)", () => {
  it("still parses the record this repository is being built under", async () => {
    const { value } = expectOk(await readState(REAL_RECORD));

    expect(value.stateVersion).toBe(SUPPORTED_STATE_VERSION);
    expect(KNOWN_PHASES).toContain(value.phase);
    expect(value.stages.length).toBeGreaterThan(0);
    expect(value.total).toBeGreaterThan(0);
    expect(value.done).toBeLessThanOrEqual(value.total);
    expect(value.unparseable).toBeUndefined();
    for (const stage of value.stages) {
      expect(KNOWN_STATUSES).toContain(stage.status);
      expect(KNOWN_PHASES).toContain(stage.phase);
      expect(stage.unparseable).toBeUndefined();
    }
  });
});

describe("G-2 — version gate", () => {
  it("refuses a newer State Version without attempting a parse", async () => {
    expect(await readState(fixture("unsupported-version"))).toEqual({
      unsupported: true,
      version: "9",
    });
  });

  it("refuses a file with no State Version field", async () => {
    expect(await readState(fixture("no-version"))).toEqual({
      unsupported: true,
      version: "unknown",
    });
  });

  it("reports a non-numeric version verbatim", () => {
    const text = "## Project Information\n- **State Version**: seven\n";
    expect(parseState(text)).toEqual({ unsupported: true, version: "seven" });
  });

  it("ignores a State Version that is not inside Project Information", () => {
    const text = "## Runtime State\n- **State Version**: 7\n";
    expect(parseState(text)).toEqual({ unsupported: true, version: "unknown" });
  });
});

describe("entry-level failures", () => {
  it("reports a missing state file", async () => {
    expect(await readState(fixture("does-not-exist"))).toEqual({
      error: true,
      reason: "state-missing",
    });
  });

  it("reports a state path that is not a readable file", async () => {
    expect(await readState(fixture("state-not-a-file"))).toEqual({
      error: true,
      reason: "state-unreadable",
    });
  });
});

describe("R-RC-3 — mid-write tolerance", () => {
  it("treats a truncated file as missing fields, not a crash", async () => {
    const { value } = expectOk(await readState(fixture("truncated")));

    expect(value.project).toBe("half-written workspace");
    expect(value.depth).toBe("Standard");
    // Current Status never made it to disk.
    expect(value.phase).toBe("INITIALIZATION");
    expect(value.unparseable?.phase).toBe("missing field");
    expect(value.currentStage).toBeNull();
    expect(value.gate).toBeNull();
    // The half-written row is not a stage row yet, so it is not counted.
    expect(value.stages.map((s) => s.slug)).toEqual(["intent-capture"]);
    expect(value.done).toBe(1);
    expect(value.total).toBe(1);
  });

  it("survives an empty file", () => {
    expect(parseState("")).toEqual({ unsupported: true, version: "unknown" });
  });
});

describe("G-3/G-4/G-5 — row- and field-level degradation", () => {
  it("marks unknown marks and unknown execution words without losing the row", async () => {
    const { value, warnings } = expectOk(await readState(fixture("degraded")));

    expect(warnings).toBeUndefined();
    expect(value.stages.find((s) => s.slug === "feasibility")).toEqual({
      slug: "feasibility",
      phase: "IDEATION",
      execution: "EXECUTE",
      status: "not-started",
      unparseable: 'unknown-mark: "@"',
    });
    // An unreadable execution column degrades to SKIP so it cannot inflate the
    // G-6 EXECUTE tally.
    expect(value.stages.find((s) => s.slug === "scope-definition")).toEqual({
      slug: "scope-definition",
      phase: "IDEATION",
      execution: "SKIP",
      status: "completed",
      unparseable: "unknown-execution: PONDERING",
    });
  });

  it("drops rows under an unknown phase heading (G-4)", async () => {
    const { value } = expectOk(await readState(fixture("degraded")));
    expect(value.stages.map((s) => s.slug)).not.toContain("teleportation");
    expect(value.stages).toHaveLength(6);
  });

  it("marks an unknown Lifecycle Phase and keeps the rest of the model", async () => {
    const { value } = expectOk(await readState(fixture("degraded")));
    expect(value.unparseable?.phase).toBe("unknown phase: SPECULATION");
    expect(value.unparseable?.scope).toBe("missing field: Project Information → Scope");
    expect(value.unparseable?.depth).toBe("missing field: Scope Configuration → Depth");
    expect(value.currentStage).toBe("user-stories");
    expect(value.gate).toBe("in-progress");
  });

  it("falls back to the [x]+[S] tally when Completed is absent (G-5)", async () => {
    const { value } = expectOk(await readState(fixture("degraded")));
    // Only `[x] intent-capture — EXECUTE` counts: the tally shares G-6's
    // in-scope denominator, so out-of-scope rows never advance it.
    expect(value.done).toBe(1);
    expect(value.total).toBe(3);
  });

  it("reads an unticked out-of-scope row as skipped, not not-started", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 7",
      "## Stage Progress",
      "### IDEATION PHASE",
      "- [ ] a — EXECUTE",
      "- [ ] b — SKIP",
      "- [-] c — SKIP",
    ].join("\n");
    const { value } = expectOk(parseState(text));
    expect(value.stages.map((s) => s.status)).toEqual(["not-started", "skipped", "in-progress"]);
    // A skipped row is not counted as done — total is the EXECUTE row alone.
    expect(value.done).toBe(0);
    expect(value.total).toBe(1);
  });

  it("does not read an unknown execution token as skipped", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 7",
      "## Stage Progress",
      "### IDEATION PHASE",
      "- [ ] a — PONDERING",
      "## Current Status",
      "- **Current Stage**: a",
    ].join("\n");
    const { value } = expectOk(parseState(text));
    // The row degrades to SKIP so it cannot inflate the G-6 EXECUTE tally, but
    // that guard is about counting — the checkbox still says not-started, and
    // the gate must not report a skip the file never stated.
    expect(value.stages[0]).toEqual({
      slug: "a",
      phase: "IDEATION",
      execution: "SKIP",
      status: "not-started",
      unparseable: "unknown-execution: PONDERING",
    });
    expect(value.gate).toBe("not-started");
  });

  it("maps all six G-3 marks", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 7",
      "## Stage Progress",
      "### IDEATION PHASE",
      "- [ ] a — EXECUTE",
      "- [-] b — EXECUTE",
      "- [?] c — EXECUTE",
      "- [R] d — EXECUTE",
      "- [x] e — EXECUTE",
      "- [S] f — EXECUTE",
    ].join("\n");
    const { value } = expectOk(parseState(text));
    expect(value.stages.map((s) => s.status)).toEqual([
      "not-started",
      "in-progress",
      "awaiting-approval",
      "revising",
      "completed",
      "skipped",
    ]);
  });

  it("reports an open gate through the current stage's mark", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 7",
      "## Stage Progress",
      "### INCEPTION PHASE",
      "- [?] user-stories — EXECUTE",
      "## Current Status",
      "- **Lifecycle Phase**: INCEPTION",
      "- **Current Stage**: user-stories",
    ].join("\r\n"); // CRLF: the parser must be newline-agnostic (NFR-4)
    const { value } = expectOk(parseState(text));
    expect(value.gate).toBe("awaiting-approval");
    expect(value.currentStage).toBe("user-stories");
  });

  it("ignores checkbox rows outside the Stage Progress section", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 7",
      "## Notes",
      "### IDEATION PHASE",
      "- [x] not-a-stage — EXECUTE",
    ].join("\n");
    const { value } = expectOk(parseState(text));
    expect(value.stages).toHaveLength(0);
  });

  it("ignores stage rows that appear before any phase heading", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 7",
      "## Stage Progress",
      "- [x] orphan — EXECUTE",
    ].join("\n");
    const { value } = expectOk(parseState(text));
    expect(value.stages).toHaveLength(0);
  });

  it("treats an empty field value as absent", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 7",
      "- **Project**:",
      "## Current Status",
      "- **Current Stage**:",
    ].join("\n");
    const { value } = expectOk(parseState(text));
    expect(value.project).toBe("");
    expect(value.unparseable?.project).toBe("missing field: Project Information → Project");
    expect(value.currentStage).toBeNull();
  });
});

describe("G-6 — total sourcing", () => {
  it("prefers the field and warns when it disagrees with the EXECUTE tally", async () => {
    const { value, warnings } = expectOk(await readState(fixture("total-mismatch")));

    expect(value.total).toBe(99);
    expect(warnings).toEqual(["Total Stages field (99) disagrees with the EXECUTE row count (2)"]);
    expect(value.done).toBe(1);
  });

  it("stays silent when the field agrees with the tally", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 7",
      "## Execution Plan Summary",
      "- **Total Stages**: 1",
      "## Stage Progress",
      "### IDEATION PHASE",
      "- [x] a — EXECUTE",
      "- [ ] b — SKIP",
    ].join("\n");
    const result = parseState(text);
    expect(expectOk(result).warnings).toBeUndefined();
    expect(expectOk(result).value.total).toBe(1);
  });

  it("falls back to the tally when the field is unparseable", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 7",
      "## Execution Plan Summary",
      "- **Total Stages**: many",
      "## Stage Progress",
      "### IDEATION PHASE",
      "- [x] a — EXECUTE",
    ].join("\n");
    const { value, warnings } = expectOk(parseState(text));
    expect(value.total).toBe(1);
    expect(warnings).toBeUndefined();
  });
});
