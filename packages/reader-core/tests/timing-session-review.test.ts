import type { AuditEvent, StageTiming } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { deriveStageTimings } from "../src/timing/derive.ts";
import { resolveStageViews } from "../src/timing/stage-view.ts";
import { run as sampleRun, stage, workflow } from "./timing-fixtures.ts";

const BASE = Date.parse("2026-09-15T00:00:00Z");
const MINUTE = 60_000;
type Row = [event: string, minute: number, fields?: Record<string, string>, stage?: string | null];

function derive(rows: Row[], now = 100): StageTiming[] {
  const events: AuditEvent[] = rows.map(
    ([event, minute, fields = {}, stage = "alpha"], position) => ({
      event,
      timestamp: new Date(BASE + minute * MINUTE).toISOString(),
      stage,
      fields,
      workflow: "main",
      shard: "one.md",
      position,
    }),
  );
  return deriveStageTimings(events, BASE + now * MINUTE).timings;
}
function only(rows: Row[], now = 100): StageTiming {
  return derive(rows, now)[0] as StageTiming;
}

describe("session timing scope and control regressions", () => {
  it("does not use an old attempt's activity to shorten a new attempt's long gap", () => {
    const current = { Unit: "a", "Attempt Generation": "2" };
    const run = only([
      ["STAGE_STARTED", 0, current],
      ["ARTIFACT_CREATED", 15, { Unit: "a", "Attempt Generation": "1" }],
      ["STAGE_COMPLETED", 30, current],
    ]);
    expect(run.activeMs ?? 0).toBe(0);
    expect(run.quality).toMatchObject({ status: "incomplete", sampleEligible: false });
  });

  it.each(["Attempt Generation", "Run floor"])(
    "does not apply a matched gate from an old %s to the current run",
    (field) => {
      const current = { [field]: "current" };
      const stale = { [field]: "stale" };
      const run = only([
        ["STAGE_STARTED", 0, current],
        ["STAGE_AWAITING_APPROVAL", 10, stale],
        ["GATE_APPROVED", 50, stale],
        ["STAGE_COMPLETED", 60, current],
      ]);
      expect(run.breakdown?.approvalWaitMs ?? 0).toBe(0);
      expect(run.activeMs ?? 0).toBe(0);
      expect(run.quality).toMatchObject({ status: "incomplete", sampleEligible: false });
    },
  );

  it("keeps a pending old-generation gate out of current-run waiting time", () => {
    const run = only(
      [
        ["STAGE_STARTED", 0, { "Attempt Generation": "2" }],
        ["STAGE_AWAITING_APPROVAL", 10, { "Attempt Generation": "1" }],
      ],
      40,
    );
    expect(run.breakdown?.approvalWaitMs ?? 0).toBe(0);
    expect(run.activeMs ?? 0).toBe(0);
    expect(run.quality).toMatchObject({ status: "incomplete", sampleEligible: false });
  });

  it("does not let observations inside a full gate shorten the gap after approval", () => {
    const rows: Row[] = [
      ["STAGE_STARTED", 0],
      ["STAGE_AWAITING_APPROVAL", 5],
      ["GATE_APPROVED", 45],
      ["STAGE_COMPLETED", 70],
    ];
    const baseline = only(rows);
    const withSensor = only([...rows, ["SENSOR_PASSED", 40]]);
    expect(withSensor.breakdown).toEqual(baseline.breakdown);
    expect(withSensor.breakdown).toMatchObject({
      workMs: 5 * MINUTE,
      approvalWaitMs: 40 * MINUTE,
      excludedGapMs: 25 * MINUTE,
    });
  });

  it("does not let a child's pause/resume endpoints shorten a whole-stage long gap", () => {
    const run = only([
      ["STAGE_STARTED", 0],
      ["UNIT_PAUSED", 10, { Unit: "a" }],
      ["UNIT_RESUMED", 50, { Unit: "a" }],
      ["STAGE_COMPLETED", 60],
    ]);
    expect(run.activeMs ?? 0).toBe(0);
    expect(run.breakdown?.suspendedMs ?? 0).toBe(0);
    expect(run.quality).toMatchObject({ status: "incomplete", sampleEligible: false });
  });

  it("does not use activity from a paused Unit to infer work after its resume", () => {
    const rows: Row[] = [
      ["STAGE_STARTED", 0],
      ["UNIT_PAUSED", 10, { Unit: "a" }],
      ["UNIT_RESUMED", 50, { Unit: "a" }],
      ["STAGE_COMPLETED", 60],
    ];
    const baseline = only(rows);
    const contradictory = only([...rows, ["ARTIFACT_CREATED", 40, { Unit: "a" }]]);
    expect(baseline.activeMs ?? 0).toBe(0);
    expect(contradictory.activeMs ?? 0).toBe(0);
    expect(contradictory.quality).toMatchObject({ status: "incomplete", sampleEligible: false });
  });

  it("keeps a completed prior attempt's gate out of a later run", () => {
    const runs = derive([
      ["STAGE_STARTED", 0],
      ["STAGE_AWAITING_APPROVAL", 5],
      ["GATE_APPROVED", 10],
      ["STAGE_COMPLETED", 15],
      ["STAGE_STARTED", 20],
      ["STAGE_COMPLETED", 50],
    ]);
    expect(runs[0]?.breakdown?.approvalWaitMs).toBe(5 * MINUTE);
    expect(runs[1]?.breakdown).toMatchObject({
      workMs: 0,
      approvalWaitMs: 0,
      excludedGapMs: 30 * MINUTE,
    });
  });

  it("does not turn an unknown gate target into a stage-wide wait", () => {
    const run = only([
      ["STAGE_STARTED", 0],
      ["STAGE_AWAITING_APPROVAL", 10, {}, null],
      ["GATE_APPROVED", 50, {}, null],
      ["STAGE_COMPLETED", 60],
    ]);
    expect(run.breakdown?.approvalWaitMs ?? 0).toBe(0);
    expect(run.activeMs ?? 0).toBe(0);
    expect(run.quality).toMatchObject({ status: "incomplete", sampleEligible: false });
  });
  it("does not report zero remaining from another attempt's terminal receipt", () => {
    const timings = derive([
      ["STAGE_STARTED", 0, { "Attempt Generation": "2" }],
      ["STAGE_COMPLETED", 10, { "Attempt Generation": "1" }],
    ]);
    const views = resolveStageViews(
      workflow({
        currentStage: "alpha",
        stages: [stage("alpha", { status: "awaiting-approval" })],
      }),
      timings,
      [sampleRun("alpha", 15 * MINUTE)],
    );
    expect(timings[0]?.activeMs).toBeNull();
    expect(views[0]?.remainingMs).toBeNull();
  });
});
