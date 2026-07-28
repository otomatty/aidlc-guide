import {
  isLowConfidenceEstimate,
  type StageInfo,
  type StageTiming,
  type WorkflowModel,
} from "@aidlc-guide/shared-types";
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
    expect(result.currentStage).toEqual({
      stage: "b",
      elapsedActiveMs: null,
      remainingMs: 600_000,
      sampleCount: 1,
      basis: "phase",
    });
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
    expect(result.currentStage).toEqual({
      stage: "cur",
      elapsedActiveMs: null,
      remainingMs: 100,
      sampleCount: 1,
      basis: "global",
    });
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
      sampleCount: 1,
      basis: "stage",
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
        sampleCount: 1,
        basis: "stage",
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
        sampleCount: 1,
        basis: "phase",
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
      expect(result.currentStage).toEqual({
        stage: "a",
        elapsedActiveMs: null,
        remainingMs: null,
        sampleCount: 0,
        basis: "none",
      });
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
        sampleCount: 1,
        basis: "stage",
      });
    });

    it("treats a closed run as history, not the current attempt, when a backward jump reset the stage's status back to not-started (Codex round 5 finding 3)", () => {
      // aidlc-jump.ts resets a later stage's status to not-started without
      // erasing its pre-jump STAGE_STARTED/STAGE_COMPLETED pair from the
      // audit log, and aidlc-state.ts finalize can point Current Stage back
      // at it before a new STAGE_STARTED lands for the rerun. Before this
      // fix, resolveCurrentRun's closed-run fallback had no way to tell that
      // apart from "this stage genuinely finished" — remainingMs came out 0
      // and the required rerun vanished from the estimate.
      const preJumpRun = run("a", 600_000);
      const result = estimateRemaining(
        [preJumpRun],
        workflow({ currentStage: "a", stages: [stage("a", { status: "not-started" })] }),
        [preJumpRun],
      );
      // Elapsed is unknown for the current (rerun) attempt — no work has
      // been done on it yet — but the stage's own history still sizes the
      // estimate, exactly like the "never run at all" case.
      expect(result.currentStage).toEqual({
        stage: "a",
        elapsedActiveMs: null,
        remainingMs: 600_000,
        sampleCount: 1,
        basis: "stage",
      });
      // The reset stage's full estimate is still counted, not silently
      // dropped because a stale closed run made it look already-finished.
      expect(result.totalRemainingMs).toBe(600_000);
    });

    it("still trusts a closed run as the current attempt when the stage's status says the attempt actually finished", () => {
      // Companion case: `awaiting-approval` (sitting at its own gate) is a
      // finished attempt too, not just `completed` — must not regress to
      // treating every closed run as history.
      const closedRun = run("a", 600_000);
      const result = estimateRemaining(
        [closedRun],
        workflow({ currentStage: "a", stages: [stage("a", { status: "awaiting-approval" })] }),
        [closedRun],
      );
      expect(result.currentStage).toEqual({
        stage: "a",
        elapsedActiveMs: 600_000,
        remainingMs: 0,
        sampleCount: 1,
        basis: "stage",
      });
    });
  });

  describe("pending stage with a concurrently-open run (Codex round 8 finding 1)", () => {
    it("reduces a pending stage's contribution to totalRemainingMs by the work already done on its open run", () => {
      // Unit-major iteration: "d" is a design stage that's open concurrently
      // with whatever the workflow's currentStage actually is — it is NOT
      // the current stage, but it is already 100k of the way through its
      // (600k-median) run.
      const historicalD = run("d", 600_000);
      const openD = run("d", 100_000, true);
      const samples = [historicalD, openD];
      const result = estimateRemaining(
        samples,
        workflow({ currentStage: null, stages: [stage("d", { status: "in-progress" })] }),
        samples,
      );
      const d = result.pendingStages.find((s) => s.stage === "d");
      // StageEstimate.estimateMs stays the stage's full historical total —
      // its doc comment promises the total, not a remainder.
      expect(d?.estimateMs).toBe(600_000);
      // But only 500k is actually left; totalRemainingMs must not charge the
      // full 600k for a stage that's already 100k into its own open run.
      expect(result.totalRemainingMs).toBe(500_000);
    });

    it("keeps a pending stage's full estimate when it has no open run — existing behaviour unchanged", () => {
      const historicalD = run("d", 600_000);
      const samples = [historicalD];
      const result = estimateRemaining(
        samples,
        workflow({ currentStage: null, stages: [stage("d", { status: "not-started" })] }),
        samples,
      );
      expect(result.pendingStages.find((s) => s.stage === "d")?.estimateMs).toBe(600_000);
      expect(result.totalRemainingMs).toBe(600_000);
    });
  });

  describe("skipped current stage (Codex round 13 finding 1)", () => {
    it("reports remainingMs 0, not the fallback estimate, when the current stage was skipped", () => {
      // aidlc-state.ts's final-stage skip path (~2172-2177) sets workflow
      // Status to "Completed" but leaves Current Stage pointing at the
      // skipped slug. The skipped run is discarded upstream, so currentRun
      // reads null here exactly like an unstarted stage — without the status
      // check, a finished workflow reports its skipped stage's full
      // historical estimate as remaining work.
      const historyForOtherStage = [run("earlier", 600_000)];
      const result = estimateRemaining(
        historyForOtherStage,
        workflow({
          currentStage: "last",
          stages: [stage("earlier", { status: "completed" }), stage("last", { status: "skipped" })],
        }),
        [], // no run recorded for the skipped stage
      );
      expect(result.currentStage).toEqual({
        stage: "last",
        elapsedActiveMs: null,
        remainingMs: 0,
        sampleCount: 1,
        basis: "phase",
      });
      // A finished (final stage skipped) workflow reports zero remaining work.
      expect(result.totalRemainingMs).toBe(0);
    });

    it("still reports the full estimate for an unstarted (not skipped) current stage — no regression", () => {
      const historyForOtherStage = [run("earlier", 600_000)];
      const result = estimateRemaining(
        historyForOtherStage,
        workflow({
          currentStage: "last",
          stages: [
            stage("earlier", { status: "completed" }),
            stage("last", { status: "not-started" }),
          ],
        }),
        [],
      );
      expect(result.currentStage).toEqual({
        stage: "last",
        elapsedActiveMs: null,
        remainingMs: 600_000,
        sampleCount: 1,
        basis: "phase",
      });
      expect(result.totalRemainingMs).toBe(600_000);
    });
  });

  describe("completed workflow with no current stage (Codex PR #4 finding 1)", () => {
    it("reports null total remaining, not the just-completed workflow's own median, when currentStage is null", () => {
      // Mirrors what `parse/state.ts` now hands the estimator once it
      // normalizes the engine's `Current Stage: none` completed-workflow
      // sentinel to null (finding 1) — before that fix this reached here as
      // the literal string "none", a stage absent from `workflow.stages`,
      // and fell through the estimator's "unstarted stage" branch straight
      // to the global median of the workflow's own just-finished runs.
      const samples = [run("a", 10 * 60_000), run("b", 15 * 60_000)];
      const result = estimateRemaining(
        samples,
        workflow({
          currentStage: null,
          stages: [stage("a", { status: "completed" }), stage("b", { status: "completed" })],
        }),
        samples,
      );
      expect(result.currentStage).toBeNull();
      // No pending stages (both completed) and no current stage: the
      // existing "nothing to estimate" path — `parts` stays empty — reports
      // `null`, the same as the no-history case above, not a phantom 0.
      expect(result.totalRemainingMs).toBeNull();
    });
  });

  describe("current-stage confidence metadata (PR #4, Codex comment 3661168051)", () => {
    it("populates the current-stage row's sampleCount/basis to match the same stage's own estimate, not a hard-coded value", () => {
      const samples = [run("a", 600_000), run("b", 300_000)];
      // Independently-derived reference: same history, "a" as a pending
      // stage instead of current — pendingStages already carries a real
      // (non-hard-coded) StageEstimate, so comparing against it catches a
      // currentStage payload that's populated with the wrong/stale metadata,
      // not just a payload that's populated with *something*.
      const aAsPending = estimateRemaining(
        samples,
        workflow({ currentStage: "b", stages: [stage("a"), stage("b")] }),
        samples,
      ).pendingStages.find((s) => s.stage === "a");
      const aAsCurrent = estimateRemaining(
        samples,
        workflow({ currentStage: "a", stages: [stage("a"), stage("b")] }),
        samples,
      ).currentStage;
      expect(aAsPending).toBeDefined();
      expect(aAsCurrent?.sampleCount).toBe(aAsPending?.sampleCount);
      expect(aAsCurrent?.basis).toBe(aAsPending?.basis);
      // Concretely: "a" has exactly one sample of its own history.
      expect(aAsCurrent).toMatchObject({ sampleCount: 1, basis: "stage" });
      expect(isLowConfidenceEstimate(aAsCurrent as NonNullable<typeof aAsCurrent>)).toBe(true);
    });

    it("reports high confidence on the current-stage row when its own history has 2+ samples", () => {
      const samples = [run("a", 100), run("a", 200), run("b", 300)];
      const result = estimateRemaining(
        samples,
        workflow({ currentStage: "a", stages: [stage("a"), stage("b")] }),
        samples,
      );
      expect(result.currentStage).toMatchObject({ sampleCount: 2, basis: "stage" });
      expect(
        isLowConfidenceEstimate(result.currentStage as NonNullable<typeof result.currentStage>),
      ).toBe(false);
    });
  });
});
