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
    const samples = [run("a", 600_000)];
    const result = estimateRemaining(
      samples,
      workflow({ stages: [stage("a"), stage("b")], currentStage: "b" }),
      samples,
    );
    const a = result.pendingStages.find((s) => s.stage === "a");
    expect(a).toEqual({
      stage: "a",
      estimateMs: 600_000,
      sampleCount: 1,
      basis: "stage",
    });
    // "b" is current but has never run in this record — elapsed is unknown
    // (not a 0 sentinel), but remaining is not phantom: nothing has been done
    // yet, so it is the full (here phase-fallback) estimate (finding 2).
    expect(result.currentStage).toEqual({ stage: "b", elapsedActiveMs: null, remainingMs: 600_000 });
  });

  it("takes the median, and averages the two middles when even", () => {
    const oddSamples = [run("a", 100), run("a", 500), run("a", 900)];
    const odd = estimateRemaining(oddSamples, workflow({ stages: [stage("a")] }), oddSamples);
    expect(odd.pendingStages[0]?.estimateMs).toBe(500);

    const evenSamples = [run("a", 100), run("a", 200), run("a", 400), run("a", 900)];
    const even = estimateRemaining(evenSamples, workflow({ stages: [stage("a")] }), evenSamples);
    expect(even.pendingStages[0]?.estimateMs).toBe(300);
  });

  it("falls back to the phase median when the stage has no history", () => {
    const samples = [run("a", 100), run("b", 300)];
    const result = estimateRemaining(
      samples,
      workflow({
        stages: [
          stage("a", { status: "completed" }),
          stage("b", { status: "completed" }),
          stage("c"),
        ],
      }),
      samples,
    );
    expect(result.pendingStages[0]).toMatchObject({ stage: "c", estimateMs: 200, basis: "phase" });
  });

  it("falls back to the global median when the phase has no history either", () => {
    const samples = [run("a", 100), run("a", 300)];
    const result = estimateRemaining(
      samples,
      workflow({
        stages: [
          stage("a", { phase: "IDEATION", status: "completed" }),
          stage("z", { phase: "OPERATION" }),
        ],
      }),
      samples,
    );
    expect(result.pendingStages[0]).toMatchObject({ stage: "z", estimateMs: 200, basis: "global" });
  });

  it("reports basis none with a null estimate when there is no history at all", () => {
    const result = estimateRemaining([], workflow({ stages: [stage("a")] }), []);
    expect(result.pendingStages[0]).toEqual({
      stage: "a",
      estimateMs: null,
      sampleCount: 0,
      basis: "none",
    });
    expect(result.totalRemainingMs).toBeNull();
  });

  it("excludes SKIP, completed, skipped and the current stage from pending", () => {
    const samples = [run("x", 100)];
    const result = estimateRemaining(
      samples,
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
      samples,
    );
    expect(result.pendingStages.map((s) => s.stage)).toEqual(["todo"]);
    // "cur" has never run in this record — elapsed stays unknown, but
    // remaining falls back to the global median ("x" has no phase in common
    // with "cur") rather than vanishing from the total (finding 2).
    expect(result.currentStage).toEqual({ stage: "cur", elapsedActiveMs: null, remainingMs: 100 });
  });

  it("measures the open run's elapsed time and subtracts it from the estimate", () => {
    const samples = [run("a", 600_000), run("a", 400_000, true)];
    const result = estimateRemaining(
      samples,
      workflow({ currentStage: "a", stages: [stage("a", { status: "in-progress" })] }),
      samples,
    );
    expect(result.currentStage).toEqual({
      stage: "a",
      elapsedActiveMs: 400_000,
      remainingMs: 200_000,
    });
  });

  it("never reports a negative remaining", () => {
    const samples = [run("a", 100_000), run("a", 900_000, true)];
    const result = estimateRemaining(
      samples,
      workflow({ currentStage: "a", stages: [stage("a", { status: "in-progress" })] }),
      samples,
    );
    expect(result.currentStage?.remainingMs).toBe(0);
  });

  it("sums the current remainder and the pending estimates", () => {
    const samples = [run("a", 600_000), run("b", 300_000), run("a", 100_000, true)];
    const result = estimateRemaining(
      samples,
      workflow({
        currentStage: "a",
        stages: [stage("a", { status: "in-progress" }), stage("b"), stage("c")],
      }),
      samples,
    );
    // a: 600k - 100k = 500k, b: 300k, c: phase median of (600k, 300k) = 450k
    expect(result.totalRemainingMs).toBe(1_250_000);
  });

  it("flags low confidence on a fallback rung or a single sample", () => {
    const singleSamples = [run("a", 100)];
    const single = estimateRemaining(
      singleSamples,
      workflow({ stages: [stage("a")] }),
      singleSamples,
    );
    expect(single.lowConfidence).toBe(true);

    const solidSamples = [run("a", 100), run("a", 200)];
    const solid = estimateRemaining(solidSamples, workflow({ stages: [stage("a")] }), solidSamples);
    expect(solid.lowConfidence).toBe(false);
  });

  it("reports a null current stage when the workflow names none", () => {
    expect(estimateRemaining([], workflow(), []).currentStage).toBeNull();
  });

  it("ignores open runs when building the sample pool", () => {
    const samples = [run("a", 999_999, true)];
    const result = estimateRemaining(samples, workflow({ stages: [stage("a")] }), samples);
    expect(result.pendingStages[0]?.basis).toBe("none");
  });

  describe("current-stage run resolution (whole-branch review 2026-07-27, findings 1/2)", () => {
    it("falls back to the most recent closed run when no run is open — the stage is finished, not phantom-remaining", () => {
      // This is the live workspace's exact terminal shape: the current stage's
      // only run already closed, and there is nothing left pending.
      const closedRun = run("a", 1_144_000);
      const result = estimateRemaining(
        [closedRun],
        workflow({ currentStage: "a", stages: [stage("a", { status: "completed" })] }),
        [closedRun],
      );
      expect(result.currentStage).toEqual({
        stage: "a",
        elapsedActiveMs: 1_144_000,
        remainingMs: 0,
      });
      // No pending stages and a closed current stage: nothing left to do.
      expect(result.totalRemainingMs).toBe(0);
    });

    it("reports elapsedActiveMs null but remainingMs as the full estimate when the current stage has no run at all (Codex round 2 finding 2)", () => {
      // The engine can advance `Current Stage` before a STAGE_STARTED is
      // emitted (aidlc-state.ts finalize). Elapsed is genuinely unknown, but
      // the stage's remainder is not — none of its work is done, so the
      // remainder is the full estimate, not an omission from the total.
      const historyForOtherStage = [run("b", 600_000)];
      const result = estimateRemaining(
        historyForOtherStage,
        workflow({
          currentStage: "a",
          stages: [stage("a", { status: "not-started" }), stage("b", { status: "completed" })],
        }),
        [], // this record has never opened a run for "a"
      );
      // "a" has no own or phase history (both default phase CONSTRUCTION would
      // apply, but "b" is the only same-phase sample) — falls back to phase.
      expect(result.currentStage).toEqual({
        stage: "a",
        elapsedActiveMs: null,
        remainingMs: 600_000,
      });
      // The no-run current stage must still be counted in the total, not
      // silently dropped for lack of an elapsed measurement.
      expect(result.totalRemainingMs).toBe(600_000);
    });

    it("reports remainingMs null (not 0) when the current stage has no run AND no estimate can be derived at all", () => {
      const result = estimateRemaining(
        [], // no samples anywhere — nothing to estimate from
        workflow({ currentStage: "a", stages: [stage("a", { status: "not-started" })] }),
        [],
      );
      expect(result.currentStage).toEqual({ stage: "a", elapsedActiveMs: null, remainingMs: null });
      expect(result.totalRemainingMs).toBeNull();
    });

    it("does not use an open run from the sample pool that belongs to a different intent (cross-intent scoping)", () => {
      // Sorts before this record's own runs alphabetically in getStageTimingSamples,
      // and shares the current stage's slug — exactly the collision finding 2
      // describes. It must never stand in for this record's own elapsed time.
      const foreignOpenRun = run("a", 999_999_999, true);
      const pool = [foreignOpenRun, run("a", 600_000)];
      const result = estimateRemaining(
        pool,
        workflow({ currentStage: "a", stages: [stage("a", { status: "in-progress" })] }),
        [], // the active record itself has no run for "a" yet
      );
      // elapsedActiveMs must stay null (the foreign open run must not stand in
      // for this record's elapsed time); remainingMs still comes from this
      // stage's own closed-run history in the sample pool (600k, unaffected
      // by the foreign run since open runs are excluded from the sample pool).
      expect(result.currentStage).toEqual({
        stage: "a",
        elapsedActiveMs: null,
        remainingMs: 600_000,
      });
    });
  });
});
