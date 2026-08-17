import { describe, expect, it } from "vitest";
import { LEGACY_STATE_WARNING } from "@aidlc-guide/shared-types";
import { parseState, readState, SUPPORTED_STATE_VERSION } from "../src/parse/state.ts";
import { expectOk, fixture, REAL_RECORD } from "./paths.ts";

describe("readState — golden snapshot (pinned copy of a State Version 8 file)", () => {
  it("parses every section of the real format", async () => {
    const { value, warnings } = expectOk(await readState(fixture("golden")));

    expect(value.stateVersion).toBe(SUPPORTED_STATE_VERSION);
    expect(value.schemaCompatibility).toBe("current");
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

    // 33 checkbox rows across the five phase headings.
    expect(value.stages).toHaveLength(33);
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

describe("readState — live record (this workspace runs the 2.6.2 engine)", () => {
  it("parses the repository's own State Version 8 record", async () => {
    const { value } = expectOk(await readState(REAL_RECORD));
    expect(value.stateVersion).toBe(SUPPORTED_STATE_VERSION);
    expect(value.scope).toBe("prd-implementation");
    expect(value.phase).toBe("OPERATION");
    expect(value.currentStage).toBe("performance-validation");
    expect(value.stages).toHaveLength(33);
    expect(value.stages.find((s) => s.slug === "domain-design")?.status).toBe("completed");
    expect(value.stages.find((s) => s.slug === "contract-design")).toEqual({
      slug: "contract-design",
      phase: "INCEPTION",
      execution: "SKIP",
      status: "skipped",
    });
  });
});

describe("readState — State Version 7 browse compatibility", () => {
  it("parses a v7 file, keeps disk slugs, and does not invent contract-design", async () => {
    const { value, warnings } = expectOk(await readState(fixture("golden-v7")));

    expect(value.stateVersion).toBe(7);
    expect(value.schemaCompatibility).toBe("legacy");
    expect(warnings).toEqual([LEGACY_STATE_WARNING]);
    expect(value.stages).toHaveLength(32);
    expect(value.stages.find((s) => s.slug === "application-design")).toEqual({
      slug: "application-design",
      phase: "INCEPTION",
      execution: "EXECUTE",
      status: "completed",
    });
    expect(value.stages.find((s) => s.slug === "domain-design")).toBeUndefined();
    expect(value.stages.find((s) => s.slug === "contract-design")).toBeUndefined();
    expect(value.currentStage).toBe("code-generation");
  });
});

describe("G-2 — version gate", () => {
  it("refuses a newer State Version without attempting a parse", async () => {
    expect(await readState(fixture("unsupported-version"))).toEqual({
      unsupported: true,
      version: "9",
    });
  });

  it("refuses State Version 6 without attempting a parse", () => {
    const text = "## Project Information\n- **State Version**: 6\n";
    expect(parseState(text)).toEqual({ unsupported: true, version: "6" });
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
    const text = "## Runtime State\n- **State Version**: 8\n";
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
      "- **State Version**: 8",
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

  it("never reads a degraded row as skipped", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 8",
      "## Stage Progress",
      "### IDEATION PHASE",
      // Unknown execution: degrades to SKIP so it cannot inflate the G-6
      // EXECUTE tally — a counting guard, not a statement about the checkbox.
      "- [ ] a — PONDERING",
      // Unknown mark: falls back to not-started so the row stays countable —
      // not evidence that the box was blank.
      "- [@] b — SKIP",
      // A readable mark keeps its own meaning through the same degradation.
      "- [x] c — PONDERING",
      "- [-] d — PONDERING",
      "## Current Status",
      "- **Current Stage**: b",
    ].join("\n");
    const { value } = expectOk(parseState(text));
    expect(value.stages).toEqual([
      {
        slug: "a",
        phase: "IDEATION",
        execution: "SKIP",
        status: "not-started",
        unparseable: "unknown-execution: PONDERING",
      },
      {
        slug: "b",
        phase: "IDEATION",
        execution: "SKIP",
        status: "not-started",
        unparseable: 'unknown-mark: "@"',
      },
      {
        slug: "c",
        phase: "IDEATION",
        execution: "SKIP",
        status: "completed",
        unparseable: "unknown-execution: PONDERING",
      },
      {
        slug: "d",
        phase: "IDEATION",
        execution: "SKIP",
        status: "in-progress",
        unparseable: "unknown-execution: PONDERING",
      },
    ]);
    // The gate must not report a skip neither row actually states.
    expect(value.gate).toBe("not-started");
  });

  it("maps all six G-3 marks", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 8",
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
      "- **State Version**: 8",
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
      "- **State Version**: 8",
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
      "- **State Version**: 8",
      "## Stage Progress",
      "- [x] orphan — EXECUTE",
    ].join("\n");
    const { value } = expectOk(parseState(text));
    expect(value.stages).toHaveLength(0);
  });

  it("treats an empty field value as absent", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 8",
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

describe("Current Stage / Next Stage 'none' sentinel (Codex PR #4 finding 1)", () => {
  it("normalizes the engine's completed-workflow sentinel to null for both fields", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 8",
      "## Current Status",
      "- **Lifecycle Phase**: CONSTRUCTION",
      "- **Status**: Completed",
      "- **Current Stage**: none",
      "- **Next Stage**: none",
      "## Stage Progress",
      "### CONSTRUCTION PHASE",
      "- [x] a — EXECUTE",
      "- [x] b — EXECUTE",
    ].join("\n");
    const { value } = expectOk(parseState(text));
    expect(value.currentStage).toBeNull();
    expect(value.nextStage).toBeNull();
    // No stage is ever slugged "none", so the gate lookup already resolves
    // to null on its own — confirms the sentinel doesn't leak into `gate`.
    expect(value.gate).toBeNull();
  });

  it("still parses a real slug that happens to contain 'none' as a substring", () => {
    const text = [
      "## Project Information",
      "- **State Version**: 8",
      "## Current Status",
      "- **Current Stage**: nonexistent-stage-name",
      "## Stage Progress",
      "### IDEATION PHASE",
      "- [-] nonexistent-stage-name — EXECUTE",
    ].join("\n");
    const { value } = expectOk(parseState(text));
    expect(value.currentStage).toBe("nonexistent-stage-name");
    expect(value.gate).toBe("in-progress");
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
      "- **State Version**: 8",
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
      "- **State Version**: 8",
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
