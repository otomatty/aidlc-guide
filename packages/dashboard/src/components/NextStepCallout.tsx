import type { NextStep } from "@aidlc-guide/shared-types";
import { ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatStageLabel } from "../data/stage-numbers.ts";

export function NextStepCallout({
  nextStep,
  onOpenNext,
}: {
  nextStep: NextStep;
  onOpenNext: (slug: string) => void;
}): ReactNode {
  const { nextStage, requirement } = nextStep;

  return (
    <Alert className="w-full" data-testid="next-step-callout">
      <AlertTitle>次に進むと</AlertTitle>
      <AlertDescription>
        {nextStage === null ? (
          <p>次はワークフロー完了です（残りの in-scope ステージなし）。</p>
        ) : (
          <>
            <p>
              次のステージ{" "}
              <span data-testid="next-stage-name">{formatStageLabel(nextStage)}</span>
            </p>
            <p>{requirement}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenNext(nextStage);
              }}
            >
              その解説を見る
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
