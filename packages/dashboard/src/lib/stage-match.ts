import type { RemainingEstimate } from "@aidlc-guide/shared-types";

/**
 * `workflow.currentStage` and `timings.remaining.currentStage` come from two
 * independent fetches (Codex PR #4 finding 2): a change push updates the
 * workflow instantly, but `/api/timings` can still describe the stage that
 * was current a moment ago. Any surface that pairs the two (NowStrip,
 * Header's total) must gate on this match so it never renders one stage's
 * numbers under another stage's name.
 *
 * Both `null` (no current stage on either side) counts as a match — there is
 * nothing to compare. Exactly one `null`, or two different stage names, is a
 * mismatch (stale).
 */
export function currentStageMatches(
  workflowCurrentStage: string | null,
  timingsCurrentStage: RemainingEstimate["currentStage"],
): boolean {
  return workflowCurrentStage === null
    ? timingsCurrentStage === null
    : timingsCurrentStage?.stage === workflowCurrentStage;
}
