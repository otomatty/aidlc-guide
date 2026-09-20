import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StageRail } from "@/features/home/components/StageRail.tsx";
import { workflow } from "@tests/fixtures.ts";

const noop = (): void => {};

describe("StageRail (FR-4.2 / FR-4.5)", () => {
  const state = { kind: "success", value: workflow() } as const;

  it("keeps SKIP stages inline in server order with stage numbers", () => {
    render(<StageRail state={state} onSelect={noop} onRetry={noop} />);
    expect(screen.queryByTestId("skip-group")).toBeNull();

    const ideation = screen.getByLabelText("IDEATION");
    const labels = within(ideation)
      .getAllByRole("button")
      .map((el) => el.textContent ?? "");
    expect(labels[0]).toContain("1.1 intent-capture");
    expect(labels[1]).toContain("1.2 market-research");
    expect(labels[2]).toContain("1.3 feasibility");
    expect(
      within(screen.getByTestId("stage-rail-item-market-research")).getByText("skipped"),
    ).toBeDefined();
  });

  it("keeps exactly one item in the tab order and moves focus with the arrows", async () => {
    render(<StageRail state={state} onSelect={noop} onRetry={noop} />);
    const items = screen
      .getAllByRole("button")
      .filter((el) => el.getAttribute("data-testid")?.startsWith("stage-rail-item-") === true);
    expect(items.filter((el) => el.tabIndex === 0)).toHaveLength(1);

    const first = screen.getByTestId("stage-rail-item-intent-capture");
    first.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByTestId("stage-rail-item-market-research"));

    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(first);
    // Still exactly one tabbable item after moving.
    expect(items.filter((el) => el.tabIndex === 0)).toHaveLength(1);
  });

  it("does not move past the ends of the rail", async () => {
    render(<StageRail state={state} onSelect={noop} onRetry={noop} />);
    const first = screen.getByTestId("stage-rail-item-intent-capture");
    first.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(first);

    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByTestId("stage-rail-item-build-and-test"));
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByTestId("stage-rail-item-build-and-test"));
  });

  it("selects with the mouse and marks the current stage", async () => {
    const onSelect = vi.fn();
    render(<StageRail state={state} onSelect={onSelect} onRetry={noop} />);
    await userEvent.click(screen.getByTestId("stage-rail-item-code-generation"));
    expect(onSelect).toHaveBeenCalledWith("code-generation");
    expect(screen.getByTestId("stage-rail-item-code-generation").getAttribute("aria-current")).toBe(
      "step",
    );
  });

  it("shows an unparseable stage as unparseable rather than dropping it", () => {
    const degraded = workflow();
    const target = degraded.stages.find((stage) => stage.slug === "build-and-test");
    if (target === undefined) throw new Error("fixture changed");
    target.unparseable = "unknown mark [~]";
    render(
      <StageRail
        state={{ kind: "partial", value: degraded, notes: [] }}
        onSelect={noop}
        onRetry={noop}
      />,
    );
    const item = screen.getByTestId("stage-rail-item-build-and-test");
    expect(within(item).getByText("unparseable")).toBeDefined();
    expect(screen.queryByText(/unknown mark \[~\]/)).toBeNull();
  });

  it("renders stage purposes when supplied (visible from 48rem via CSS)", () => {
    render(
      <StageRail
        state={state}
        onSelect={noop}
        onRetry={noop}
        purposes={{ "code-generation": "ユニット仕様に沿って実装を書く。" }}
      />,
    );
    expect(screen.getByTestId("stage-rail-purpose-code-generation").textContent).toBe(
      "ユニット仕様に沿って実装を書く。",
    );
    expect(screen.queryByTestId("stage-rail-purpose-intent-capture")).toBeNull();
  });
});
