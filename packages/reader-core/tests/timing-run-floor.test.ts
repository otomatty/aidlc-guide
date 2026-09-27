import path from "node:path";
import type { AuditEvent, StageTiming } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { deriveStageTimings } from "../src/timing/derive.ts";
import { getStageTimings } from "../src/timing/read.ts";
import { runFloorCheck } from "../src/timing/run-floor.ts";
import { expectOk, REPO_ROOT } from "./paths.ts";

/**
 * Issue #166: the engine stamps Unit events with a `Run floor` naming the
 * boundary that began the attempt, but never stamps one on STAGE_STARTED.
 * Every fixture here uses that recorded shape — a floor on the Unit event
 * only, spelled exactly as the engine spells it — never a floor on the start.
 */

const BASE = Date.parse("2026-09-24T06:00:00Z");
const MIN = 60_000;
type Row = [event: string, minute: number, stage?: string | null, fields?: Record<string, string>];

/** Engine timestamps have second resolution and no milliseconds. */
function at(minute: number): string {
  return new Date(BASE + minute * MIN).toISOString().replace(".000Z", "Z");
}
function floor(event: string, minute: number, ordinal = 1): string {
  return `${event}:${at(minute)}#${ordinal}`;
}
function unit(runFloor: string, name = "u"): Record<string, string> {
  return { Unit: name, "Run floor": runFloor };
}
/** Ascending, one shard: the sorted stream pairing hands to classification. */
function events(rows: Row[]): AuditEvent[] {
  return rows.map(([event, minute, stage = "alpha", fields = {}], position) => ({
    event,
    timestamp: at(minute),
    stage,
    fields,
    shard: "one.md",
    position,
    workflow: fields.Workflow ?? null,
  }));
}
function derive(rows: Row[], now = 1000): StageTiming[] {
  return deriveStageTimings(events(rows), BASE + now * MIN).timings;
}
function alphaRuns(rows: Row[]): StageTiming[] {
  return derive(rows).filter((run) => run.stage === "alpha");
}
function only(rows: Row[]): StageTiming {
  const runs = alphaRuns(rows);
  expect(runs).toHaveLength(1);
  return runs[0] as StageTiming;
}
function expectSample(run: StageTiming | undefined, workMinutes: number): void {
  expect(run?.activeMs).toBe(workMinutes * MIN);
  expect(run?.quality).toMatchObject({ status: "usable", reasons: [], sampleEligible: true });
}

describe("Run floor attempt identity (issue #166)", () => {
  it("uses a run whose Unit event names the stage's own STAGE_STARTED", () => {
    const run = only([
      ["STAGE_STARTED", 0],
      ["ARTIFACT_CREATED", 3],
      ["UNIT_COMPLETED", 10, "alpha", unit(floor("STAGE_STARTED", 0))],
      ["STAGE_AWAITING_APPROVAL", 12],
      ["GATE_APPROVED", 15],
      ["STAGE_COMPLETED", 15],
    ]);
    expectSample(run, 12);
    expect(run.breakdown?.approvalWaitMs).toBe(3 * MIN);
  });

  it("numbers a rerun like the engine: only this stage's main-workflow starts count", () => {
    const [first, second] = alphaRuns([
      ["STAGE_STARTED", 0],
      ["UNIT_COMPLETED", 5, "alpha", unit(floor("STAGE_STARTED", 0))],
      ["STAGE_COMPLETED", 10],
      ["STAGE_STARTED", 10, "beta"],
      ["STAGE_COMPLETED", 11, "beta"],
      ["STAGE_STARTED", 12, "alpha", { Workflow: "single-stage:alpha" }],
      ["STAGE_COMPLETED", 13, "alpha", { Workflow: "single-stage:alpha" }],
      // A backward jump lands its STAGE_STARTED in the same second.
      ["STAGE_JUMPED", 20, null],
      ["STAGE_STARTED", 20],
      ["UNIT_COMPLETED", 25, "alpha", unit(floor("STAGE_STARTED", 20, 2))],
      ["STAGE_COMPLETED", 30],
    ]);
    expectSample(first, 10);
    expectSample(second, 10);
  });

  it.each([
    ["WORKFLOW_STARTED", floor("WORKFLOW_STARTED", 0)],
    ["STAGE_JUMPED", floor("STAGE_JUMPED", 0)],
  ])("uses a unit-major run whose floor names %s instead of STAGE_STARTED", (boundary, runFloor) => {
    const run = only([
      [boundary, 0, null],
      ["STAGE_STARTED", 1],
      ["UNIT_STARTED", 2, "alpha", unit(runFloor)],
      ["UNIT_COMPLETED", 8, "alpha", unit(runFloor)],
      ["STAGE_COMPLETED", 10],
    ]);
    expectSample(run, 9);
  });

  it("uses a unit-major run recorded before any attempt boundary", () => {
    expectSample(
      only([
        ["STAGE_STARTED", 0],
        ["UNIT_COMPLETED", 6, "alpha", unit("unstarted#0")],
        ["STAGE_COMPLETED", 10],
      ]),
      10,
    );
  });

  it("uses a checkpoint run whose floor skips another Unit's rejection", () => {
    const gate = { Unit: "b", "Gate Stages": "alpha", "Gate Scope": "unit-end" };
    expectSample(
      only([
        ["WORKFLOW_STARTED", 0, null],
        ["STAGE_AWAITING_APPROVAL", 1, "alpha", gate],
        ["GATE_REJECTED", 2, "alpha", gate],
        ["STAGE_STARTED", 3],
        ["UNIT_COMPLETED", 8, "alpha", unit(floor("WORKFLOW_STARTED", 0), "a")],
        ["STAGE_COMPLETED", 10],
      ]),
      7,
    );
  });

  // Each later boundary starts a new engine attempt. A Unit event still naming
  // the earlier attempt must not bridge the current run's long gap.
  it.each<[string, (runFloor: string) => Row[], string, string, number, number]>([
    [
      "a rerun's STAGE_STARTED",
      (runFloor) => [
        ["STAGE_STARTED", 0],
        ["STAGE_COMPLETED", 5],
        ["STAGE_JUMPED", 10, null],
        ["STAGE_STARTED", 10],
        ["UNIT_COMPLETED", 20, "alpha", unit(runFloor)],
        ["STAGE_COMPLETED", 40],
      ],
      floor("STAGE_STARTED", 10, 2),
      floor("STAGE_STARTED", 0),
      30,
      0,
    ],
    [
      "a GATE_REJECTED",
      (runFloor) => [
        ["STAGE_STARTED", 0],
        ["STAGE_AWAITING_APPROVAL", 5],
        ["GATE_REJECTED", 6],
        ["UNIT_COMPLETED", 20, "alpha", unit(runFloor)],
        ["STAGE_COMPLETED", 40],
      ],
      floor("GATE_REJECTED", 6),
      floor("STAGE_STARTED", 0),
      39,
      5,
    ],
    [
      "a STAGE_JUMPED in a unit-major run",
      (runFloor) => [
        ["WORKFLOW_STARTED", 0, null],
        ["STAGE_STARTED", 1],
        ["STAGE_JUMPED", 5, null],
        ["UNIT_COMPLETED", 20, "alpha", unit(runFloor)],
        ["STAGE_COMPLETED", 40],
      ],
      floor("STAGE_JUMPED", 5),
      floor("WORKFLOW_STARTED", 0),
      39,
      0,
    ],
  ])("excludes a floor from before %s", (_, rows, current, stale, currentWork, staleWork) => {
    const [kept, excluded] = [rows(current), rows(stale)].map((row) => alphaRuns(row).at(-1));
    expectSample(kept, currentWork);
    expect(excluded?.activeMs).toBe(staleWork * MIN);
    expect(excluded?.quality).toMatchObject({ status: "incomplete", sampleEligible: false });
    expect(excluded?.quality?.reasons).toContain("observation-scope-mismatch");
  });

  it("scopes an approval wait by the same floor rule", () => {
    const rows = (runFloor: string): Row[] => [
      ["STAGE_STARTED", 0],
      ["STAGE_COMPLETED", 2],
      ["STAGE_JUMPED", 5, null],
      ["STAGE_STARTED", 5],
      ["STAGE_AWAITING_APPROVAL", 10, "alpha", { "Run floor": runFloor }],
      ["GATE_APPROVED", 50, "alpha", { "Run floor": runFloor }],
      ["STAGE_COMPLETED", 60],
    ];
    const current = alphaRuns(rows(floor("STAGE_STARTED", 5, 2))).at(-1);
    expectSample(current, 15);
    expect(current?.breakdown?.approvalWaitMs).toBe(40 * MIN);
    const stale = alphaRuns(rows(floor("STAGE_STARTED", 0))).at(-1);
    expect(stale?.breakdown?.approvalWaitMs).toBe(0);
    expect(stale?.quality).toMatchObject({ status: "incomplete", sampleEligible: false });
    expect(stale?.quality?.reasons).toContain("measurement-scope-mismatch");
  });
});

describe("runFloorCheck", () => {
  function check(rows: Row[], stage = "alpha") {
    const stream = events(rows);
    const matches = runFloorCheck(stream);
    const index = stream.length - 1;
    return matches(stream[index] as AuditEvent, index, stage);
  }

  it("accepts an event that makes no attempt claim", () => {
    expect(check([["STAGE_STARTED", 0], ["ARTIFACT_CREATED", 1]])).toBe(true);
  });

  it("rejects a floor the engine could not have stamped", () => {
    const rows = (runFloor: string): Row[] => [
      ["STAGE_STARTED", 0],
      ["UNIT_COMPLETED", 1, "alpha", unit(runFloor)],
    ];
    expect(check(rows("4"))).toBe(false);
    expect(check(rows(floor("STAGE_STARTED", 0, 2)))).toBe(false);
  });

  it("ignores isolated single-stage starts even when they reach it", () => {
    const rows: Row[] = [
      ["STAGE_STARTED", 0],
      ["STAGE_STARTED", 1, "alpha", { Workflow: "single-stage:alpha" }],
      ["UNIT_COMPLETED", 2, "alpha", unit(floor("STAGE_STARTED", 0))],
    ];
    expect(check(rows)).toBe(true);
  });

  it("counts only boundaries recorded before the event", () => {
    const own = { "Gate Stages": "alpha", "Run floor": floor("STAGE_STARTED", 0) };
    expect(check([["STAGE_STARTED", 0], ["GATE_REJECTED", 1, "alpha", own]])).toBe(true);
  });

  it("counts a rejection only for the stages its gate names", () => {
    const rows = (gateStages: string): Row[] => [
      ["STAGE_STARTED", 0],
      ["STAGE_AWAITING_APPROVAL", 1, "alpha", { "Gate Stages": gateStages }],
      ["GATE_REJECTED", 2, "alpha", { "Gate Stages": gateStages }],
      ["UNIT_COMPLETED", 3, "alpha", unit(floor("GATE_REJECTED", 2))],
    ];
    expect(check(rows("beta, alpha"))).toBe(true);
    expect(check(rows("beta"))).toBe(false);
  });

  it("checks a stageless event against its run's stage; a stageless rejection moves nothing", () => {
    const rows: Row[] = [
      ["STAGE_STARTED", 0],
      ["GATE_REJECTED", 1, null],
      ["UNIT_COMPLETED", 2, null, unit(floor("STAGE_STARTED", 0))],
    ];
    expect(check(rows)).toBe(true);
  });

  it("counts a Unit's rejection only toward that Unit's own floor", () => {
    const rows = (eventUnit: string): Row[] => [
      ["WORKFLOW_STARTED", 0, null],
      ["GATE_REJECTED", 1, "alpha", { Unit: "a" }],
      ["UNIT_COMPLETED", 2, "alpha", unit(floor("GATE_REJECTED", 1), eventUnit)],
    ];
    expect(check(rows("a"))).toBe(true);
    expect(check(rows("b"))).toBe(false);
  });

  it("checks a checkpoint gate against the floor of the stage it names", () => {
    const rows: Row[] = [
      ["WORKFLOW_STARTED", 0, null],
      ["GATE_REJECTED", 1, "beta", { Unit: "a" }],
      ["STAGE_AWAITING_APPROVAL", 2, "beta", unit(floor("GATE_REJECTED", 1), "a")],
    ];
    expect(check(rows, "alpha")).toBe(true);
  });
});

describe("recorded workflow 260923-docs-ask-chat (read only)", () => {
  it("uses every Unit-level Construction run as a sample", async () => {
    const record = path.join(REPO_ROOT, "aidlc", "spaces", "default", "intents", "260923-docs-ask-chat");
    const { value } = expectOk(await getStageTimings(record, Date.parse("2026-09-26T00:00:00Z")));
    const unitStages = [
      "functional-design",
      "nfr-requirements",
      "nfr-design",
      "infrastructure-design",
      "code-generation",
      "code-generation",
    ];
    const runs = value.filter((run) => unitStages.includes(run.stage));
    expect(runs.map((run) => run.stage)).toEqual(unitStages);
    for (const run of runs) {
      expect(run.quality?.reasons).not.toContain("observation-scope-mismatch");
      expect(run.quality).toMatchObject({ status: "limited", sampleEligible: true });
    }
  });
});
