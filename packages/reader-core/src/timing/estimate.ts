import {
  isLowConfidenceEstimate,
  type Phase,
  type RemainingEstimate,
  type StageEstimate,
  type StageStatus,
  type StageTiming,
  type WorkflowModel,
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

/**
 * Estimate minus work already done, clamped at zero. Shared by the current
 * stage's open-run branch and by pending stages that have their own
 * concurrently-open run (unit-major iteration lets several design stages be
 * open at once — see stage-protocol.md's "Unit-major iteration" section) —
 * without this, a pending stage that is already partway through its run
 * still gets billed its full historical estimate, overstating
 * `totalRemainingMs` by up to nearly a full estimate per concurrently-open
 * stage.
 */
function remainingAfterActive(estimateMs: number, activeMs: number): number {
  return Math.max(0, estimateMs - activeMs);
}

/**
 * Statuses under which a closed run for the current stage is genuinely the
 * current attempt (finding 3). A backward jump (`aidlc-jump.ts`) resets a
 * later stage's status back to `not-started` (and downstream checkboxes to
 * `[ ]`) without touching its old audit rows — the pre-jump STAGE_STARTED/
 * STAGE_COMPLETED pair is still sitting there. `aidlc-state.ts finalize` can
 * then point `Current Stage` at that reset stage before a new STAGE_STARTED
 * is emitted for the rerun. `resolveCurrentRun`'s closed-run fallback has no
 * way to tell "this closed run IS the current attempt, already finished"
 * apart from "this closed run PREDATES a reset the current attempt hasn't
 * repeated yet" — both look identical there ("closed run for this slug, no
 * open run"). The stage's own status is what tells them apart: only when it
 * says the attempt actually finished (`completed`) or is sitting at its own
 * gate (`awaiting-approval`) does the closed run belong to now. Anything
 * else (`not-started`, `in-progress`, `revising`, `skipped`) means the
 * closed run is history, not the current attempt.
 */
const CURRENT_ATTEMPT_STATUSES: ReadonlySet<StageStatus> = new Set([
  "completed",
  "awaiting-approval",
]);

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
  const resolvedCurrentRun =
    workflow.currentStage === null ? null : resolveCurrentRun(activeRuns, workflow.currentStage);
  const currentStageInfo = workflow.stages.find((s) => s.slug === workflow.currentStage);
  // Finding 3: a CLOSED run only counts as the current attempt when the
  // stage's own status agrees the attempt finished — see
  // CURRENT_ATTEMPT_STATUSES above. An open run is always trusted as-is (a
  // reset stage has no open run until its rerun actually starts, so this
  // never hides a real in-flight run). Falling through to `null` here reuses
  // the existing "no run yet" branch below rather than adding a fourth state.
  const currentRun =
    resolvedCurrentRun !== null &&
    resolvedCurrentRun.endedAt !== null &&
    (currentStageInfo === undefined || !CURRENT_ATTEMPT_STATUSES.has(currentStageInfo.status))
      ? null
      : resolvedCurrentRun;
  const elapsedActiveMs = currentRun === null ? null : currentRun.activeMs;
  // Four states for the current stage, kept distinct:
  //  - skipped    → 0: `aidlc-state.ts`'s skip path (~2172-2177) sets
  //    workflow Status to "Completed" but leaves `Current Stage` pointing at
  //    the skipped slug when it was the final stage — and a skipped run is
  //    discarded upstream, so `currentRun` reads as null here exactly like an
  //    unstarted stage. Without this check that "no run" branch below hands
  //    a finished workflow the skipped stage's full estimate as remaining
  //    work. Checked ahead of (and independent of) `currentRun`: a skipped
  //    stage has nothing left regardless of any stray run data for the slug.
  //  - open run   → max(0, estimate - elapsed): part of the estimate is done.
  //  - closed run → 0: the stage already finished, nothing left in it.
  //  - no run     → the full estimate: `Current Stage` can advance before a
  //    STAGE_STARTED is emitted (aidlc-state.ts finalize), so "no run yet"
  //    does not mean "no work left" — none of the stage's work is done, so
  //    the remainder is the whole thing, not an omission from the total.
  //    ("completed" can't reach this branch via the engine's own paths: the
  //    normal advance always moves `Current Stage` to the *next* stage, and
  //    the only path that leaves it on the just-finished slug is the
  //    final-stage skip above, which sets the stage's own status to
  //    "skipped", not "completed" — that's the case above, not this one.)
  const currentRemaining =
    currentStageInfo?.status === "skipped"
      ? 0
      : currentRun === null
        ? (currentEstimate?.estimateMs ?? null)
        : currentRun.endedAt !== null
          ? 0
          : currentEstimate === null || currentEstimate.estimateMs === null
            ? null
            : remainingAfterActive(currentEstimate.estimateMs, elapsedActiveMs as number);

  const currentStage =
    workflow.currentStage === null
      ? null
      : { stage: workflow.currentStage, elapsedActiveMs, remainingMs: currentRemaining };

  // `pendingStages` (returned as-is below) keeps StageEstimate.estimateMs as
  // the stage's full historical total — that field's doc comment promises
  // the total, not a remainder. The reduction for a concurrently-open
  // pending stage (finding: unit-major) is applied only here, in what
  // totalRemainingMs sums, so the two meanings don't collide on one field.
  const pendingRemaining = (s: StageEstimate): number | null => {
    if (s.estimateMs === null) return null;
    const open = activeRuns.find((r) => r.stage === s.stage && r.endedAt === null);
    return open === undefined ? s.estimateMs : remainingAfterActive(s.estimateMs, open.activeMs);
  };

  const parts = [
    ...(currentRemaining === null ? [] : [currentRemaining]),
    ...pendingStages.flatMap((s) => {
      const remaining = pendingRemaining(s);
      return remaining === null ? [] : [remaining];
    }),
  ];

  const rungs = [...(currentEstimate === null ? [] : [currentEstimate]), ...pendingStages];

  return {
    currentStage,
    pendingStages,
    totalRemainingMs: parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0),
    lowConfidence: rungs.some(isLowConfidenceEstimate),
  };
}
