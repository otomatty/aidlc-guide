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
 * inferred `activeMs`, never wall clock. Every production sample has been
 * recalculated using the same policy as the selected attempt.
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

interface SamplePool {
  values: number[];
  excluded: number;
  limited: number;
}

function pool(): SamplePool {
  return { values: [], excluded: 0, limited: 0 };
}

function bucket(into: Map<string, SamplePool>, key: string): SamplePool {
  let result = into.get(key);
  if (result === undefined) {
    result = pool();
    into.set(key, result);
  }
  return result;
}

function collect(into: SamplePool, sample: StageTiming): void {
  if (
    sample.activeMs === null ||
    !Number.isFinite(sample.activeMs) ||
    sample.activeMs < 0 ||
    sample.quality?.sampleEligible === false ||
    sample.quality?.status === "incomplete"
  ) {
    into.excluded += 1;
    return;
  }
  into.values.push(sample.activeMs);
  if (sample.quality?.status === "limited") into.limited += 1;
}

function estimateFrom(
  stage: string,
  samples: SamplePool,
  basis: StageEstimate["basis"],
): StageEstimate {
  return {
    stage,
    estimateMs: median(samples.values),
    sampleCount: samples.values.length,
    sampleExcludedCount: samples.excluded,
    limitedSampleCount: samples.limited,
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
  const byStage = new Map<string, SamplePool>();
  const byPhase = new Map<string, SamplePool>();
  const global = pool();

  for (const sample of samples) {
    // Open runs are in progress, not evidence of how long the stage takes.
    if (sample.endedAt === null) continue;
    collect(global, sample);
    const phase = phaseOf.get(sample.stage);
    if (phase !== undefined) {
      collect(bucket(byStage, sample.stage), sample);
      collect(bucket(byPhase, phase), sample);
    }
  }

  return (stage) => {
    const own = byStage.get(stage);
    if (own !== undefined && own.values.length > 0) return estimateFrom(stage, own, "stage");
    const phase = phaseOf.get(stage);
    const inPhase = phase === undefined ? undefined : byPhase.get(phase);
    if (inPhase !== undefined && inPhase.values.length > 0)
      return estimateFrom(stage, inPhase, "phase");
    if (global.values.length > 0) return estimateFrom(stage, global, "global");
    return {
      stage,
      estimateMs: null,
      sampleCount: 0,
      sampleExcludedCount: global.excluded,
      limitedSampleCount: 0,
      basis: "none",
    };
  };
}

/**
 * The workflow-level roll-up. A plain sum plus a plain `some` over the views
 * that {@link StageView.countsTowardRemaining} marks — there is deliberately
 * no arithmetic here that a stage row could disagree with, because every
 * number being added was already decided in `stage-view.ts`.
 *
 * Unknown stages are counted explicitly. No unfinished stages means zero;
 * unfinished stages without any usable remainder means unknown.
 */
export function estimateRemaining(views: readonly StageView[]): RemainingEstimate {
  const counted = views.filter((view) => view.countsTowardRemaining);
  const parts = counted.flatMap((view) => (view.remainingMs === null ? [] : [view.remainingMs]));

  return {
    totalRemainingMs:
      counted.length === 0 ? 0 : parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0),
    lowConfidence: counted.some(isLowConfidenceEstimate),
    estimateCoverage: { known: parts.length, unknown: counted.length - parts.length },
  };
}
