import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextStepCallout } from "@/features/stage/components/NextStepCallout.tsx";
import { StageCard } from "@/features/stage/components/StageCard.tsx";
import { StoreProvider } from "@/store/context.tsx";
import { nextStep, stageDoc } from "@tests/fixtures.ts";

const noop = (): void => {};

describe("NextStepCallout (US-02 / FR-4.6)", () => {
  it("shows the next stage name and what is asked of the human", () => {
    render(<NextStepCallout nextStep={nextStep()} onOpenNext={noop} />);
    expect(screen.getByTestId("next-stage-name").textContent).toBe("3.6 build-and-test");
    expect(screen.getByText("コードとテストの承認")).toBeDefined();
  });

  it("says the workflow is finished when there is no next stage", () => {
    render(<NextStepCallout nextStep={nextStep({ nextStage: null })} onOpenNext={noop} />);
    expect(screen.queryByTestId("next-stage-name")).toBeNull();
    expect(screen.getByText(/ワークフロー完了/)).toBeDefined();
  });

  it("renders inside the current stage's card only", () => {
    const { rerender } = render(
      <StoreProvider>
        <StageCard doc={stageDoc()} isCurrent nextStep={nextStep()} onOpenStage={noop} />
      </StoreProvider>,
    );
    expect(screen.getByTestId("next-step-callout")).toBeDefined();

    rerender(
      <StoreProvider>
        <StageCard doc={stageDoc()} isCurrent={false} nextStep={nextStep()} onOpenStage={noop} />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("next-step-callout")).toBeNull();
  });
});
