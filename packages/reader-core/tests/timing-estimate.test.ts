import type { StageInfo, StageTiming, WorkflowModel } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { estimateRemaining } from "../src/timing/estimate.ts";

function stage(slug: string, over: Partial<StageInfo> = {}): StageInfo {
  return { slug, phase: "CONSTRUCTION", execution: "EXECUTE", status: "not-started", ...over };
}

function workflow(over: Partial<WorkflowModel> = {}): WorkflowModel {
  return {
    project: "p",
    scope: "feature",
    depth: "practical",
    stateVersion: 7,
    phase: "CONSTRUCTION",
    currentStage: null,
    nextStage: null,
    gate: null,
    stages: [],
    done: 0,
    total: 0,
    ...over,
  };
}

function run(stageName: string, activeMs: number, open = false): StageTiming {
  return {
    stage: stageName,
    startedAt: "2026-07-20T00:00:00Z",
    endedAt: open ? null : "2026-07-20T01:00:00Z",
    wallMs: activeMs * 2,
    activeMs,
    eventCount: 50,
  };
}

describe("estimateRemaining", () => {
  it("uses the stage's own history and reports no range for one sample", () => {
    const result = estimateRemaining(
      [run("a", 600_000)],
      workflow({ stages: [stage("a"), stage("b")], currentStage: "b" }),
    );
    const a = result.pendingStages.find((s) => s.stage === "a");
    expect(a).toEqual({
      stage: "a",
      estimateMs: 600_000,
      rangeMs: null,
      sampleCount: 1,
      basis: "stage",
    });
  });

  it("takes the median, and averages the two middles when even", () => {
    const odd = estimateRemaining(
      [run("a", 100), run("a", 500), run("a", 900)],
      workflow({ stages: [stage("a")] }),
    );
    expect(odd.pendingStages[0]?.estimateMs).toBe(500);
    expect(odd.pendingStages[0]?.rangeMs).toEqual([100, 900]);

    const even = estimateRemaining(
      [run("a", 100), run("a", 200), run("a", 400), run("a", 900)],
      workflow({ stages: [stage("a")] }),
    );
    expect(even.pendingStages[0]?.estimateMs).toBe(300);
  });

  it("falls back to the phase median when the stage has no history", () => {
    const result = estimateRemaining(
      [run("a", 100), run("b", 300)],
      workflow({
        stages: [
          stage("a", { status: "completed" }),
          stage("b", { status: "completed" }),
          stage("c"),
        ],
      }),
    );
    expect(result.pendingStages[0]).toMatchObject({ stage: "c", estimateMs: 200, basis: "phase" });
  });

  it("falls back to the global median when the phase has no history either", () => {
    const result = estimateRemaining(
      [run("a", 100), run("a", 300)],
      workflow({
        stages: [
          stage("a", { phase: "IDEATION", status: "completed" }),
          stage("z", { phase: "OPERATION" }),
        ],
      }),
    );
    expect(result.pendingStages[0]).toMatchObject({ stage: "z", estimateMs: 200, basis: "global" });
  });

  it("reports basis none with a null estimate when there is no history at all", () => {
    const result = estimateRemaining([], workflow({ stages: [stage("a")] }));
    expect(result.pendingStages[0]).toEqual({
      stage: "a",
      estimateMs: null,
      rangeMs: null,
      sampleCount: 0,
      basis: "none",
    });
    expect(result.totalRemainingMs).toBeNull();
  });

  it("excludes SKIP, completed, skipped and the current stage from pending", () => {
    const result = estimateRemaining(
      [run("x", 100)],
      workflow({
        currentStage: "cur",
        stages: [
          stage("cur", { status: "in-progress" }),
          stage("skipme", { execution: "SKIP" }),
          stage("done", { status: "completed" }),
          stage("gone", { status: "skipped" }),
          stage("todo"),
        ],
      }),
    );
    expect(result.pendingStages.map((s) => s.stage)).toEqual(["todo"]);
  });

  it("measures the open run's elapsed time and subtracts it from the estimate", () => {
    const result = estimateRemaining(
      [run("a", 600_000), run("a", 400_000, true)],
      workflow({ currentStage: "a", stages: [stage("a", { status: "in-progress" })] }),
    );
    expect(result.currentStage).toEqual({
      stage: "a",
      elapsedActiveMs: 400_000,
      remainingMs: 200_000,
    });
  });

  it("never reports a negative remaining", () => {
    const result = estimateRemaining(
      [run("a", 100_000), run("a", 900_000, true)],
      workflow({ currentStage: "a", stages: [stage("a", { status: "in-progress" })] }),
    );
    expect(result.currentStage?.remainingMs).toBe(0);
  });

  it("sums the current remainder and the pending estimates", () => {
    const result = estimateRemaining(
      [run("a", 600_000), run("b", 300_000), run("a", 100_000, true)],
      workflow({
        currentStage: "a",
        stages: [stage("a", { status: "in-progress" }), stage("b"), stage("c")],
      }),
    );
    // a: 600k - 100k = 500k, b: 300k, c: phase median of (600k, 300k) = 450k
    expect(result.totalRemainingMs).toBe(1_250_000);
  });

  it("flags low confidence on a fallback rung or a single sample", () => {
    const single = estimateRemaining([run("a", 100)], workflow({ stages: [stage("a")] }));
    expect(single.lowConfidence).toBe(true);

    const solid = estimateRemaining(
      [run("a", 100), run("a", 200)],
      workflow({ stages: [stage("a")] }),
    );
    expect(solid.lowConfidence).toBe(false);
  });

  it("reports a null current stage when the workflow names none", () => {
    expect(estimateRemaining([], workflow()).currentStage).toBeNull();
  });

  it("ignores open runs when building the sample pool", () => {
    const result = estimateRemaining([run("a", 999_999, true)], workflow({ stages: [stage("a")] }));
    expect(result.pendingStages[0]?.basis).toBe("none");
  });
});
