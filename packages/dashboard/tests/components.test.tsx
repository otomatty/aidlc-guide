import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NextStepCallout } from "../src/components/NextStepCallout.tsx";
import { StageCard } from "../src/components/StageCard.tsx";
import { StageRail } from "../src/components/StageRail.tsx";
import { CHIP_STATUSES, STATUS_PRESENTATION, StatusChip } from "../src/components/StatusChip.tsx";
import { UnitStageMatrix } from "../src/components/UnitStageMatrix.tsx";
import { matrix, nextStep, stageDoc, workflow } from "./fixtures.ts";

const noop = (): void => {};

describe("StatusChip (US-18 / BR-UI-2)", () => {
  it("covers exactly the seven rows of the design-system triple-representation table", () => {
    expect(CHIP_STATUSES).toEqual([
      "completed",
      "in-progress",
      "awaiting-approval",
      "revising",
      "not-started",
      "skipped",
      "unparseable",
    ]);
  });

  it.each(CHIP_STATUSES)("renders colour token, symbol and label for %s", (status) => {
    const { container } = render(<StatusChip status={status} />);
    const chip = container.querySelector(".chip");
    const expected = STATUS_PRESENTATION[status];

    // Colour: the token is in the DOM, both as the applied custom property and
    // as an attribute, so greyscale review and tests see the same thing.
    expect(chip?.getAttribute("style")).toContain(expected.token);
    expect(chip?.getAttribute("data-token")).toBe(expected.token);
    // Symbol and text label are both present — never colour alone.
    expect(chip?.querySelector(".chip__symbol")?.textContent).toBe(expected.symbol);
    expect(chip?.querySelector(".chip__label")?.textContent).toBe(expected.label);
  });

  it("gives revising its own purple token and ◑ symbol", () => {
    expect(STATUS_PRESENTATION.revising).toEqual({
      token: "--color-status-revising",
      symbol: "◑",
      label: "revising",
    });
  });
});

describe("NextStepCallout (US-02 / FR-4.6)", () => {
  it("shows the next stage name and what is asked of the human", () => {
    render(<NextStepCallout nextStep={nextStep()} onOpenNext={noop} />);
    expect(screen.getByTestId("next-stage-name").textContent).toBe("build-and-test");
    expect(screen.getByText("コードとテストの承認")).toBeDefined();
  });

  it("says the workflow is finished when there is no next stage", () => {
    render(<NextStepCallout nextStep={nextStep({ nextStage: null })} onOpenNext={noop} />);
    expect(screen.queryByTestId("next-stage-name")).toBeNull();
    expect(screen.getByText(/ワークフロー完了/)).toBeDefined();
  });

  it("renders inside the current stage's card only", () => {
    const { rerender } = render(
      <StageCard doc={stageDoc()} isCurrent nextStep={nextStep()} onOpenStage={noop} />,
    );
    expect(screen.getByTestId("next-step-callout")).toBeDefined();

    rerender(
      <StageCard doc={stageDoc()} isCurrent={false} nextStep={nextStep()} onOpenStage={noop} />,
    );
    expect(screen.queryByTestId("next-step-callout")).toBeNull();
  });
});

describe("StageCard (US-03 / FR-4.4)", () => {
  it("renders all four mandatory fields plus the docs deep link", () => {
    render(<StageCard doc={stageDoc()} isCurrent={false} onOpenStage={noop} />);
    expect(screen.getByText("目的")).toBeDefined();
    expect(screen.getByText("入力")).toBeDefined();
    expect(screen.getByText("出力")).toBeDefined();
    expect(screen.getByText("担当エージェント")).toBeDefined();
    expect(screen.getByText("ゲート要求")).toBeDefined();

    const link = screen.getByRole("link", { name: "docs を開く" });
    expect(link.getAttribute("href")).toBe("docs/guide/03-construction.md#code-generation");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("drops a deep link whose target is not a plain path or http(s) URL (S-UI-4)", () => {
    const doc = stageDoc({ deepLink: { docPath: "javascript:alert(1)", docAnchor: "x" } });
    render(<StageCard doc={doc} isCurrent={false} onOpenStage={noop} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("UnitStageMatrix (FR-4.3)", () => {
  const renderMatrix = (): void => {
    render(
      <UnitStageMatrix
        state={{ kind: "success", value: matrix() }}
        onSelectCell={noop}
        onRetry={noop}
      />,
    );
  };

  it("draws a present cell with no files as empty (·), not as out-of-scope", () => {
    renderMatrix();
    const cell = screen.getByTestId("matrix-cell-mcp-server-functional-design");
    expect(cell.getAttribute("data-kind")).toBe("empty");
    expect(cell.textContent).toContain("·");
    expect(within(cell).getByText("空（成果物 0 件）")).toBeDefined();
  });

  it("draws a missing intersection as out-of-scope (—)", () => {
    renderMatrix();
    const cell = screen.getByTestId("matrix-cell-mcp-server-nfr-design");
    expect(cell.getAttribute("data-kind")).toBe("out-of-scope");
    expect(cell.textContent).toContain("—");
    expect(within(cell).getByText("対象外")).toBeDefined();
  });

  it("prints the server's file count and verdict verbatim (BR-UI-3)", () => {
    renderMatrix();
    const cell = screen.getByTestId("matrix-cell-reader-core-functional-design");
    expect(cell.textContent).toContain("4 件");
    expect(cell.textContent).toContain("READY");
  });

  it("surfaces a cell-level error instead of showing the cell as empty", () => {
    const degraded = matrix();
    degraded.cells.push({
      unit: "mcp-server",
      stage: "nfr-design",
      files: [],
      verdict: null,
      error: "読めません",
    });
    render(
      <UnitStageMatrix
        state={{ kind: "partial", value: degraded, notes: ["mcp-server / nfr-design: 読めません"] }}
        onSelectCell={noop}
        onRetry={noop}
      />,
    );
    const cell = screen.getByTestId("matrix-cell-mcp-server-nfr-design");
    expect(cell.getAttribute("data-kind")).toBe("error");
    expect(cell.textContent).toContain("読めません");
  });

  it("reports the row and column headers as a real table", () => {
    renderMatrix();
    expect(screen.getByRole("rowheader", { name: "reader-core" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "nfr-design" })).toBeDefined();
  });
});

describe("StageRail (FR-4.2 / FR-4.5)", () => {
  const state = { kind: "success", value: workflow() } as const;

  it("collapses the SKIP run behind a details element that states the reason", async () => {
    render(<StageRail state={state} onSelect={noop} onRetry={noop} />);
    const group = screen.getByTestId("skip-group");
    expect(group.hasAttribute("open")).toBe(false);
    expect(within(group).getByText("SKIP (2)")).toBeDefined();

    await userEvent.click(within(group).getByText("SKIP (2)"));
    expect(within(group).getByText(/スコープ由来の SKIP/)).toBeDefined();
    expect(within(group).getByText("market-research")).toBeDefined();
  });

  it("keeps exactly one item in the tab order and moves focus with the arrows", async () => {
    render(<StageRail state={state} onSelect={noop} onRetry={noop} />);
    const items = screen.getAllByRole("button").filter((el) => el.className === "rail__button");
    expect(items.filter((el) => el.tabIndex === 0)).toHaveLength(1);

    const first = screen.getByTestId("stage-rail-item-intent-capture");
    first.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByTestId("stage-rail-item-functional-design"));

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
    expect(screen.getByText("unknown mark [~]")).toBeDefined();
  });
});
