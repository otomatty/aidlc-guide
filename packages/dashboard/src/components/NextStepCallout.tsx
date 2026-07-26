import type { NextStep } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import { formatStageLabel } from "../data/stage-numbers.ts";

/**
 * US-02 / FR-4.6 — the *second* element of S-1 reachability. This is a
 * separate region from the stage's own explanation (US-03): different data
 * source (next-stage resolution), different question ("what comes next?"),
 * so it is a separate component and never folded into StageCard's fields.
 *
 * Rendered **only** by the current stage's card; the caller enforces that and
 * this component asserts nothing about it, so the rule lives in one place.
 */
export function NextStepCallout({
  nextStep,
  onOpenNext,
}: {
  nextStep: NextStep;
  onOpenNext: (slug: string) => void;
}): ReactNode {
  const { nextStage, requirement } = nextStep;

  return (
    <section
      className="callout"
      aria-labelledby="next-step-heading"
      data-testid="next-step-callout"
    >
      <h3 id="next-step-heading" className="callout__heading">
        次に進むと
      </h3>
      {nextStage === null ? (
        <p className="callout__end">次はワークフロー完了です（残りの in-scope ステージなし）。</p>
      ) : (
        <>
          <p className="callout__stage">
            <span className="callout__label">次のステージ</span>
            <span data-testid="next-stage-name">{formatStageLabel(nextStage)}</span>
          </p>
          <p className="callout__requirement">
            <span className="callout__label">そこで求められること</span>
            <span>{requirement}</span>
          </p>
          <button
            type="button"
            className="button"
            onClick={() => {
              onOpenNext(nextStage);
            }}
          >
            その解説を見る →
          </button>
        </>
      )}
    </section>
  );
}
