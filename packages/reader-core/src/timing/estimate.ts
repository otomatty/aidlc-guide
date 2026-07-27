import type {
  Phase,
  RemainingEstimate,
  StageEstimate,
  StageTiming,
  WorkflowModel,
} from "@aidlc-guide/shared-types";

/**
 * L3 — estimation. Pure: no filesystem, no clock. Every duration here is
 * `activeMs`, never wall clock (see the spec: wall clock measures when the
 * human sat down, not how much work a stage takes).
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
 * The run backing "current stage" elapsed/remaining. Prefers the open run;
 * falls back to the most recently closed run for the slug (a finished stage's
 * measured duration is real and should be shown, not hidden behind a 0
 * sentinel). `null` only when the slug has no run at all — scoped to the
 * active record's own runs, never the space-wide sample pool, so a foreign
 * intent's open run for the same slug can never be picked up here (findings
 * 1/2, whole-branch review 2026-07-27).
 */
function resolveCurrentRun(
  activeRuns: readonly StageTiming[],
  stageSlug: string,
): StageTiming | null {
  let open: StageTiming | null = null;
  let latestClosed: StageTiming | null = null;
  for (const run of activeRuns) {
    if (run.stage !== stageSlug) continue;
    if (run.endedAt === null) {
      open = run;
      continue;
    }
    if (
      latestClosed === null ||
      Date.parse(run.endedAt) > Date.parse(latestClosed.endedAt as string)
    ) {
      latestClosed = run;
    }
  }
  return open ?? latestClosed;
}

export function estimateRemaining(
  samples: readonly StageTiming[],
  workflow: WorkflowModel,
  /** The active record's own runs — scopes the current-stage lookup (finding 2). */
  activeRuns: readonly StageTiming[],
): RemainingEstimate {
  const phaseOf = new Map<string, Phase>(workflow.stages.map((s) => [s.slug, s.phase]));

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

  const estimate = (stage: string): StageEstimate => {
    const own = byStage.get(stage);
    if (own !== undefined && own.length > 0) return estimateFrom(stage, own, "stage");
    const phase = phaseOf.get(stage);
    const inPhase = phase === undefined ? undefined : byPhase.get(phase);
    if (inPhase !== undefined && inPhase.length > 0) return estimateFrom(stage, inPhase, "phase");
    if (global.length > 0) return estimateFrom(stage, global, "global");
    return { stage, estimateMs: null, sampleCount: 0, basis: "none" };
  };

  const pendingStages = workflow.stages
    .filter(
      (s) =>
        s.execution === "EXECUTE" &&
        s.status !== "completed" &&
        s.status !== "skipped" &&
        s.slug !== workflow.currentStage,
    )
    .map((s) => estimate(s.slug));

  const currentEstimate = workflow.currentStage === null ? null : estimate(workflow.currentStage);
  const currentRun =
    workflow.currentStage === null ? null : resolveCurrentRun(activeRuns, workflow.currentStage);
  const elapsedActiveMs = currentRun === null ? null : currentRun.activeMs;
  const currentRemaining =
    currentRun === null
      ? null // no run at all for this stage — nothing measured, nothing to subtract from
      : currentRun.endedAt !== null
        ? 0 // the run is closed — this stage is finished, no work left in it
        : currentEstimate === null || currentEstimate.estimateMs === null
          ? null
          : Math.max(0, currentEstimate.estimateMs - (elapsedActiveMs as number));

  const currentStage =
    workflow.currentStage === null
      ? null
      : { stage: workflow.currentStage, elapsedActiveMs, remainingMs: currentRemaining };

  const parts = [
    ...(currentRemaining === null ? [] : [currentRemaining]),
    ...pendingStages.flatMap((s) => (s.estimateMs === null ? [] : [s.estimateMs])),
  ];

  const rungs = [...(currentEstimate === null ? [] : [currentEstimate]), ...pendingStages];

  return {
    currentStage,
    pendingStages,
    totalRemainingMs: parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0),
    lowConfidence: rungs.some((s) => s.basis !== "stage" || s.sampleCount < 2),
  };
}
