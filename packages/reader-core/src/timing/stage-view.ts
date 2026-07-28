import type {
  Phase,
  StageInfo,
  StageStatus,
  StageTiming,
  StageView,
  WorkflowModel,
} from "@aidlc-guide/shared-types";
import { createStageEstimator } from "./estimate.ts";

/**
 * L3 — the single point where the state file (the truth about `status`) and
 * the audit log (the truth about time) are reconciled. Pure: no filesystem,
 * no clock.
 *
 * The two sources disagree in four documented ways, and every consumer used
 * to re-derive its own answer to them (issue #9):
 *
 *  - **backward jump** — `aidlc-jump.ts` resets a downstream stage's status
 *    to `not-started` without erasing its already-closed STAGE_STARTED/
 *    STAGE_COMPLETED pair, so a closed run can be *history*, not the attempt
 *    in play.
 *  - **skip** — a skipped stage emits no STAGE_COMPLETED, and its run is
 *    discarded upstream, so it looks exactly like a stage that never started.
 *  - **`none` sentinel** — the engine writes the literal `none` into
 *    `Current Stage`. `parse/state.ts` normalises it to `null`; this module
 *    is the structural backstop, because a `currentStage` naming no row in
 *    `stages` simply produces no current view at all.
 *  - **`awaiting-approval`** — STAGE_COMPLETED fires *after* GATE_APPROVED,
 *    so a stage at its gate may still have an open run.
 *
 * Getting one of those right in `estimate.ts` and wrong in `StageRail` is
 * exactly what PR #4's R9 and R15 findings were. The rules now exist once,
 * here, and both the estimator and every surface read the result.
 */

/**
 * Statuses under which a *closed* run is genuinely the attempt in play rather
 * than a pre-jump leftover. "Closed run for this slug, no open run" looks
 * identical in the audit log whether the attempt finished or whether a
 * backward jump reset the stage and its rerun has not started yet — the
 * stage's own status is the only thing that tells them apart. `completed`
 * means the attempt finished; `awaiting-approval` means it finished and is
 * sitting at its gate (STAGE_COMPLETED fires after GATE_APPROVED). Anything
 * else — `not-started`, `in-progress`, `revising`, `skipped` — means the
 * closed run is history.
 */
const CURRENT_ATTEMPT_STATUSES: ReadonlySet<StageStatus> = new Set([
  "completed",
  "awaiting-approval",
]);

/** A stage in one of these states has no work left to bill, whatever its runs say. */
function isFinished(stage: StageInfo): boolean {
  return stage.execution === "SKIP" || stage.status === "skipped" || stage.status === "completed";
}

interface Runs {
  open: StageTiming | null;
  closed: StageTiming[];
  latestClosed: StageTiming | null;
}

/**
 * Splits one stage's runs. Openness is read from the data (`endedAt === null`)
 * and never inferred from `status` — see the `awaiting-approval` note above.
 * The last open run wins if the log somehow holds more than one; the closed
 * runs keep audit order, with the newest by `endedAt` singled out.
 *
 * Ties go to the later entry (`>=`, not `>`). Audit timestamps are
 * second-resolution, so two rapid reruns of the same stage can close in the
 * same second — and `getStageTimings` emits closed runs in the order they
 * closed, which makes the later array entry the newer attempt. A strict `>`
 * would keep the first, surfacing the older attempt's duration as the current
 * measurement (Codex review on PR #15).
 */
function runsFor(activeRuns: readonly StageTiming[], slug: string): Runs {
  let open: StageTiming | null = null;
  const closed: StageTiming[] = [];
  let latestClosed: StageTiming | null = null;

  for (const run of activeRuns) {
    if (run.stage !== slug) continue;
    if (run.endedAt === null) {
      open = run;
      continue;
    }
    closed.push(run);
    if (
      latestClosed === null ||
      Date.parse(run.endedAt) >= Date.parse(latestClosed.endedAt as string)
    ) {
      latestClosed = run;
    }
  }
  return { open, closed, latestClosed };
}

/**
 * Reconcile a workflow's stages against the runs derived from its audit log.
 *
 * @param workflow    the parsed state file — the truth about `status`.
 * @param activeRuns  the **active record's own** runs. Never the space-wide
 *                    sample pool: a foreign intent's open run for the same
 *                    slug must not stand in for this record's elapsed time.
 * @param samples     the pool the estimates are measured from — space-wide by
 *                    default in production, so a stage with no history here
 *                    can still be sized from other intents. Defaults to
 *                    `activeRuns` when the caller has only the one pool.
 */
export function resolveStageViews(
  workflow: WorkflowModel,
  activeRuns: readonly StageTiming[],
  samples: readonly StageTiming[] = activeRuns,
): StageView[] {
  const phaseOf = new Map<string, Phase>(workflow.stages.map((s) => [s.slug, s.phase]));
  const estimate = createStageEstimator(samples, phaseOf);

  return workflow.stages.map((stage) => {
    const { open, closed, latestClosed } = runsFor(activeRuns, stage.slug);
    const finishedAttempt =
      latestClosed !== null && CURRENT_ATTEMPT_STATUSES.has(stage.status) ? latestClosed : null;
    const currentAttempt = open ?? finishedAttempt;
    const { estimateMs, sampleCount, basis } = estimate(stage.slug);

    // Four cases, in this order:
    //  - finished / skipped / out of scope → 0, whatever runs exist for the
    //    slug. A skipped stage's run is discarded upstream, so it reads as
    //    "never started" here and would otherwise be billed its full estimate
    //    on an already-finished workflow.
    //  - closed current attempt → 0: the work is done, the gate is what's
    //    left, and a gate is not measured in hands-on minutes.
    //  - open run → the remainder: part of the estimate is already spent.
    //    Clamped at zero, since an overrun is not negative work.
    //  - no attempt → the whole estimate. `Current Stage` can advance before
    //    STAGE_STARTED is emitted, and a jump-reset stage has no open run
    //    until its rerun begins; neither means "no work left".
    const remainingMs = isFinished(stage)
      ? 0
      : currentAttempt !== null && currentAttempt.endedAt !== null
        ? 0
        : open !== null
          ? estimateMs === null
            ? null
            : Math.max(0, estimateMs - open.activeMs)
          : estimateMs;

    return {
      stage: stage.slug,
      phase: stage.phase,
      execution: stage.execution,
      status: stage.status,
      ...(stage.unparseable === undefined ? {} : { unparseable: stage.unparseable }),
      isCurrent: stage.slug === workflow.currentStage,
      running: open !== null,
      currentAttempt,
      history: closed.filter((run) => run !== currentAttempt),
      actualActiveMs:
        currentAttempt !== null && currentAttempt.endedAt !== null ? currentAttempt.activeMs : null,
      elapsedActiveMs: currentAttempt?.activeMs ?? null,
      estimateMs,
      sampleCount,
      basis,
      remainingMs,
      // The current stage always counts, even at 0, so a workflow parked on a
      // finished final stage reports "nothing left" rather than "unknown".
      // Everything else counts only while it still has work: adding a
      // finished stage's 0 would turn a total of `null` ("nothing could be
      // estimated") into a confident zero.
      countsTowardRemaining: stage.slug === workflow.currentStage || !isFinished(stage),
    };
  });
}
