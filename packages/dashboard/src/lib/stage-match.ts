import type { StageInfo, StageView } from "@aidlc-guide/shared-types";

/**
 * `workflow.currentStage` and the timings payload's current {@link StageView}
 * come from two independent fetches (Codex PR #4 finding 2): a change push
 * updates the workflow instantly, but `/api/timings` can still describe the
 * stage that was current a moment ago. Any surface that pairs the two
 * (NowStrip, Header's total) must gate on this match so it never renders one
 * stage's numbers under another stage's name.
 *
 * This is freshness only — *which* view is current was already decided in
 * reader-core (issue #9), so there is no reconciliation left to get wrong
 * here.
 *
 * Both `null` (no current stage on either side) counts as a match — there is
 * nothing to compare. Exactly one `null`, or two different stage names, is a
 * mismatch (stale).
 */
export function currentStageMatches(
  workflowCurrentStage: string | null,
  timingsCurrentStage: Pick<StageView, "stage"> | null,
): boolean {
  return workflowCurrentStage === null
    ? timingsCurrentStage === null
    : timingsCurrentStage?.stage === workflowCurrentStage;
}

/**
 * The per-row counterpart of {@link currentStageMatches}: does this view still
 * describe the row being drawn?
 *
 * Which run belongs to the attempt in play depends on the stage's `status`
 * (see reader-core's `resolveStageViews`), so a view built from a state
 * snapshot older than the one the rail is rendering can carry a measurement
 * the fresh state has since disowned — a backward jump resets a downstream
 * row to `not-started` while the in-flight timings response still reports its
 * pre-jump run as finished (Codex review on PR #15). Only the *measurement*
 * is gated on this; a stage's estimate does not depend on its status and
 * stands either way.
 */
export function stageViewMatches(
  stage: Pick<StageInfo, "status">,
  view: Pick<StageView, "status"> | undefined,
): boolean {
  return view !== undefined && view.status === stage.status;
}
