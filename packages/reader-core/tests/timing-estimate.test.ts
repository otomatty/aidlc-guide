import type {
  Phase,
  StageInfo,
  StageTiming,
  StageView,
  WorkflowModel,
} from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { createStageEstimator, estimateRemaining } from "../src/timing/estimate.ts";
import { resolveStageViews } from "../src/timing/stage-view.ts";

/**
 * Issue #9 split this file in two. The arithmetic — the fallback ladder and
 * the roll-up — stays here; every rule about which run belongs to which
 * attempt moved to `timing-stage-view.test.ts`, because it moved out of this
 * module. The roll-up cases below therefore go through `resolveStageViews`
 * rather than hand-building views: what is being asserted is that a workflow
 * shape produces a given total, and the reconciliation is part of that path.
 */

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

function run(stageName: string, activeMs: number, open = false, at = "01"): StageTiming {
  return {
    stage: stageName,
    startedAt: `2026-07-20T${at}:00:00Z`,
    endedAt: open ? null : `2026-07-20T${at}:30:00Z`,
    wallMs: activeMs * 2,
    activeMs,
    eventCount: 50,
  };
}

/** Shorthand for the common case: one pool serving both roles. */
function views(over: Partial<WorkflowModel>, pool: readonly StageTiming[]): StageView[] {
  return resolveStageViews(workflow(over), pool, pool);
}

describe("createStageEstimator", () => {
  const phases = new Map<string, Phase>([
    ["a", "CONSTRUCTION"],
    ["b", "CONSTRUCTION"],
    ["c", "CONSTRUCTION"],
    ["z", "OPERATION"],
  ]);

  it("takes the median, and averages the two middles when even", () => {
    const odd = createStageEstimator([run("a", 100), run("a", 500), run("a", 900)], phases);
    expect(odd("a").estimateMs).toBe(500);

    const even = createStageEstimator(
      [run("a", 100), run("a", 200), run("a", 400), run("a", 900)],
      phases,
    );
    expect(even("a").estimateMs).toBe(300);
  });

  it("climbs stage → phase → global → none", () => {
    const estimate = createStageEstimator([run("a", 100), run("b", 300)], phases);
    expect(estimate("a")).toEqual({
      stage: "a",
      estimateMs: 100,
      sampleCount: 1,
      basis: "stage",
    });
    // No history of its own, but two same-phase runs to borrow from.
    expect(createStageEstimator([run("a", 100), run("b", 300)], phases)("c")).toMatchObject({
      estimateMs: 200,
      basis: "phase",
    });
    // A different phase entirely — only the workspace-wide median is left.
    expect(estimate("z")).toMatchObject({ estimateMs: 200, basis: "global" });
    expect(createStageEstimator([], phases)("a")).toEqual({
      stage: "a",
      estimateMs: null,
      sampleCount: 0,
      basis: "none",
    });
  });

  it("ignores open runs — a run in progress is not evidence of how long a stage takes", () => {
    expect(createStageEstimator([run("a", 999_999, true)], phases)("a").basis).toBe("none");
  });

  it("skips the phase rung for a slug the workflow does not place in a phase", () => {
    // A run whose slug has no state-file row (a stage removed from the scope,
    // a foreign intent's) contributes to the global pool but belongs to no
    // phase bucket — it must not be borrowed as a phase median for anyone.
    const estimate = createStageEstimator([run("a", 100), run("stranger", 900)], phases);
    expect(estimate("stranger")).toMatchObject({ estimateMs: 900, basis: "stage" });
    // Asked about a slug with neither its own history nor a phase, the ladder
    // drops straight to the workspace median instead of borrowing someone's.
    expect(estimate("ghost")).toMatchObject({ estimateMs: 500, basis: "global" });
  });
});

describe("estimateRemaining", () => {
  it("sums the counted views' remainders", () => {
    // a: current, 100k into a 600k median → 500k left.
    // b: pending with its own 300k history.
    // c: no history of its own → phase median of (600k, 300k) = 450k.
    const result = estimateRemaining(
      views(
        {
          currentStage: "a",
          stages: [stage("a", { status: "in-progress" }), stage("b"), stage("c")],
        },
        [run("a", 600_000), run("b", 300_000), run("a", 100_000, true, "02")],
      ),
    );
    expect(result.totalRemainingMs).toBe(1_250_000);
  });

  it("charges a concurrently-open pending stage only what is left of it", () => {
    // Unit-major iteration opens several design stages at once, so a stage
    // that is not `currentStage` can still be part-way through its own run.
    const result = estimateRemaining(
      views({ currentStage: null, stages: [stage("d", { status: "in-progress" })] }, [
        run("d", 600_000),
        run("d", 100_000, true, "02"),
      ]),
    );
    expect(result.totalRemainingMs).toBe(500_000);
  });

  it("counts an unstarted current stage in full rather than dropping it", () => {
    const result = estimateRemaining(
      views({ currentStage: "a", stages: [stage("a"), stage("b", { status: "completed" })] }, [
        run("b", 600_000),
      ]),
    );
    expect(result.totalRemainingMs).toBe(600_000);
  });

  it("reports 0 for a workflow parked on its finished final stage", () => {
    const result = estimateRemaining(
      views({ currentStage: "a", stages: [stage("a", { status: "completed" })] }, [
        run("a", 1_144_000),
      ]),
    );
    expect(result.totalRemainingMs).toBe(0);
  });

  it("reports null, not 0, when nothing at all could be counted", () => {
    // A finished workflow whose `Current Stage: none` normalised to null: no
    // view counts, so the answer is "nothing to estimate" — not a confident
    // zero, and emphatically not the workflow's own just-finished median.
    const result = estimateRemaining(
      views(
        {
          currentStage: null,
          stages: [stage("a", { status: "completed" }), stage("b", { status: "completed" })],
        },
        [run("a", 600_000), run("b", 900_000)],
      ),
    );
    expect(result.totalRemainingMs).toBeNull();
  });

  it("reports null when the counted views have no estimate to offer", () => {
    expect(estimateRemaining(views({ stages: [stage("a")] }, [])).totalRemainingMs).toBeNull();
  });

  it("flags low confidence from a fallback rung or a single sample, and only from counted views", () => {
    expect(estimateRemaining(views({ stages: [stage("a")] }, [run("a", 100)])).lowConfidence).toBe(
      true,
    );
    expect(
      estimateRemaining(views({ stages: [stage("a")] }, [run("a", 100), run("a", 200)]))
        .lowConfidence,
    ).toBe(false);
    // "b" rests on a single sample, but it is already completed — a finished
    // stage's confidence says nothing about the work that is left.
    expect(
      estimateRemaining(
        views(
          {
            stages: [stage("a"), stage("b", { phase: "OPERATION", status: "completed" })],
          },
          [run("a", 100), run("a", 200), run("b", 900)],
        ),
      ).lowConfidence,
    ).toBe(false);
  });
});
