import type { RemainingEstimate, StageView } from "@aidlc-guide/shared-types";
import { currentStageView, timingsMatchStage } from "@aidlc-guide/shared-types";
import { type AppState, viewValue } from "./state.ts";

/**
 * The freshness gate between the two independently-fetched feeds, applied
 * once for the whole app (issue #10).
 *
 * `workflow` and `timings` are separate reads, so a change push can advance
 * the current stage while an in-flight timings response still describes the
 * previous one. NowStrip, Header and the VS Code status bar each used to
 * re-do that comparison — three copies of one rule, and the payload's own
 * notion of "current" was reverse-engineered from `StageView.isCurrent` each
 * time. The payload now carries its `currentStage` snapshot, and the whole
 * comparison happens here; the components below take pre-gated values and
 * hold no opinion about staleness.
 *
 * Not gated on freshness, on purpose: `StageRail`, which renders one row per
 * stage rather than "the current stage". Blanking every row because the
 * current stage moved would be a worse answer than the per-row
 * `stageViewMatches` check it already makes.
 */
export interface CurrentTiming {
  /**
   * The current stage's reconciled view, or `null` when the workflow has no
   * current stage or the payload predates the one on screen.
   */
  view: StageView | null;
  /**
   * The whole-workflow roll-up, or `null` when the payload is stale — a
   * total computed against the previous stage still bills that stage's
   * remainder, so it must not render under the new one.
   */
  remaining: RemainingEstimate | null;
}

export function selectCurrentTiming(state: AppState): CurrentTiming {
  // An unloaded workflow reads as `null`, which matches only a payload that
  // also reports no current stage — the safe direction: never show numbers
  // under a stage name we cannot confirm.
  const stage = viewValue(state.workflow)?.currentStage ?? null;
  const payload = viewValue(state.timings);
  const fresh = timingsMatchStage(stage, payload) ? payload : null;
  return {
    view: currentStageView(stage, fresh),
    remaining: fresh === null ? null : fresh.remaining,
  };
}

/** Degradation notes from a `partial` `/api/timings` response. */
export function selectTimingNotes(state: AppState): string[] {
  return state.timings.kind === "partial" ? state.timings.notes : [];
}
