import {
  isLowConfidenceEstimate,
  type Phase,
  type RemainingEstimate,
  type StageEstimate,
  type StageTiming,
  type StageView,
} from "@aidlc-guide/shared-types";

/**
 * L3 — estimation. Pure: no filesystem, no clock. Every duration here is
 * `activeMs`, never wall clock (see the spec: wall clock measures when the
 * human sat down, not how much work a stage takes).
 *
 * This file owns only the *arithmetic*: how long a stage is expected to take,
 * given a pool of past runs, and how the per-stage remainders roll up. It
 * knows nothing about backward jumps, skips, or the `none` sentinel —
 * reconciling the state file against the audit log is `./stage-view.ts`'s
 * single job (issue #9), and this module reads its output rather than the two
 * raw sources.
 */

/** Median, not mean: measured runs span 13 minutes to 8 hours. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  // Non-null assertions are safe: callers only reach here with a non-empty list.
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function push(into: Map<string, number[]>, key: string, value: number): void {
  const bucket = into.get(key);
  if (bucket === undefined) into.set(key, [value]);
  else bucket.push(value);
}

function estimateFrom(
  stage: string,
  values: readonly number[],
  basis: StageEstimate["basis"],
): StageEstimate {
  return {
    stage,
    estimateMs: median(values),
    sampleCount: values.length,
    basis,
  };
}

/**
 * Builds the fallback ladder once for a whole workflow: the stage's own
 * history, else its phase's, else the whole workspace's, else nothing.
 * Returned as a lookup so `stage-view.ts` can size every stage from one pass
 * over the sample pool.
 */
export function createStageEstimator(
  samples: readonly StageTiming[],
  phaseOf: ReadonlyMap<string, Phase>,
): (stage: string) => StageEstimate {
  const byStage = new Map<string, number[]>();
  const byPhase = new Map<string, number[]>();
  const global: number[] = [];

  for (const sample of samples) {
    // Open runs are in progress, not evidence of how long the stage takes.
    if (sample.endedAt === null) continue;
    push(byStage, sample.stage, sample.activeMs);
    global.push(sample.activeMs);
    const phase = phaseOf.get(sample.stage);
    if (phase !== undefined) push(byPhase, phase, sample.activeMs);
  }

  return (stage) => {
    const own = byStage.get(stage);
    if (own !== undefined && own.length > 0) return estimateFrom(stage, own, "stage");
    const phase = phaseOf.get(stage);
    const inPhase = phase === undefined ? undefined : byPhase.get(phase);
    if (inPhase !== undefined && inPhase.length > 0) return estimateFrom(stage, inPhase, "phase");
    if (global.length > 0) return estimateFrom(stage, global, "global");
    return { stage, estimateMs: null, sampleCount: 0, basis: "none" };
  };
}

/**
 * The workflow-level roll-up. A plain sum plus a plain `some` over the views
 * that {@link StageView.countsTowardRemaining} marks — there is deliberately
 * no arithmetic here that a stage row could disagree with, because every
 * number being added was already decided in `stage-view.ts`.
 *
 * `null` rather than `0` when nothing was counted at all: "no estimate could
 * be derived" and "no work is left" are different answers, and a finished
 * workflow reaching the former must not render as a confident zero.
 */
export function estimateRemaining(views: readonly StageView[]): RemainingEstimate {
  const counted = views.filter((view) => view.countsTowardRemaining);
  const parts = counted.flatMap((view) => (view.remainingMs === null ? [] : [view.remainingMs]));

  return {
    totalRemainingMs: parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0),
    lowConfidence: counted.some(isLowConfidenceEstimate),
  };
}
