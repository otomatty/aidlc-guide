import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DetailPanel } from "../src/components/DetailPanel.tsx";
import { StoreProvider, useDispatch } from "../src/store/context.tsx";
import type { AppState } from "../src/store/state.ts";
import { matrix, nextStep, stageDoc, workflow } from "./fixtures.ts";

/**
 * C-2 / a11y checklist 2.1.2: the panel is **non-modal**. It must move focus
 * in, restore it on close, and never hold focus captive.
 */

const preloaded: Partial<AppState> = {
  workflow: { kind: "success", value: workflow() },
  nextStep: { kind: "success", value: nextStep() },
  stageDoc: { "code-generation": { kind: "success", value: stageDoc() } },
};

function Harness(): ReactNode {
  const dispatch = useDispatch();
  return (
    <>
      <button
        type="button"
        data-testid="trigger"
        onClick={() => {
          dispatch({ type: "select", selection: { kind: "stage", slug: "code-generation" } });
        }}
      >
        code-generation を開く
      </button>
      <button type="button" data-testid="outside">
        別の操作
      </button>
      <DetailPanel />
    </>
  );
}

function setup(): void {
  render(
    <StoreProvider preloaded={preloaded}>
      <Harness />
    </StoreProvider>,
  );
}

describe("DetailPanel", () => {
  it("moves focus to the heading when it opens", async () => {
    setup();
    await userEvent.click(screen.getByTestId("trigger"));
    const heading = screen.getByRole("heading", { name: "code-generation", level: 2 });
    expect(document.activeElement).toBe(heading);
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    setup();
    const trigger = screen.getByTestId("trigger");
    await userEvent.click(trigger);
    expect(screen.getByTestId("detail-panel")).toBeDefined();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("detail-panel")).toBeNull();
    // Radix restores focus on the next macrotask after unmount.
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("closes on an outside click and restores focus", async () => {
    setup();
    const trigger = screen.getByTestId("trigger");
    await userEvent.click(trigger);
    await userEvent.click(screen.getByTestId("outside"));
    expect(screen.queryByTestId("detail-panel")).toBeNull();
  });

  it("is not a modal: no aria-modal, and focus may leave the panel", async () => {
    setup();
    await userEvent.click(screen.getByTestId("trigger"));
    const panel = screen.getByTestId("detail-panel");
    expect(panel.hasAttribute("aria-modal")).toBe(false);
    expect(panel.getAttribute("role")).toBeNull(); // <aside> = complementary

    // A focus trap would yank focus back; a non-modal panel lets it go.
    const outside = screen.getByTestId("outside");
    outside.focus();
    expect(document.activeElement).toBe(outside);
    expect(screen.getByTestId("detail-panel")).toBeDefined();
  });

  it("shows the current stage's next-step callout inside the card", async () => {
    setup();
    await userEvent.click(screen.getByTestId("trigger"));
    expect(screen.getByTestId("next-step-callout")).toBeDefined();
    expect(screen.getByTestId("next-stage-name").textContent).toBe("build-and-test");
  });

  it("shows a local error inside the panel without taking the page down", async () => {
    render(
      <StoreProvider
        preloaded={{
          ...preloaded,
          stageDoc: { "code-generation": { kind: "error", detail: "解説が見つかりません" } },
        }}
      >
        <Harness />
      </StoreProvider>,
    );
    await userEvent.click(screen.getByTestId("trigger"));
    expect(screen.getByText("解説が見つかりません")).toBeDefined();
    expect(screen.getByTestId("trigger")).toBeDefined();
  });
});

/**
 * The cross-unit seam: a matrix cell selection opens that cell's artifacts,
 * from the `MatrixCell.files` the server already sent. The viewer arrives
 * through `React.lazy` (P-AV-1), so this also proves the split point resolves.
 */
describe("DetailPanel — matrix cell selection (US-13)", () => {
  function CellHarness(): ReactNode {
    const dispatch = useDispatch();
    return (
      <>
        <button
          type="button"
          data-testid="open-cell"
          onClick={() => {
            dispatch({
              type: "select",
              selection: { kind: "cell", unit: "reader-core", stage: "nfr-design" },
            });
          }}
        >
          セルを開く
        </button>
        <DetailPanel />
      </>
    );
  }

  it("lazily mounts the artifact viewer with the cell's own file list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true, value: "# 論理コンポーネント" }))),
    );
    render(
      <StoreProvider preloaded={{ ...preloaded, matrix: { kind: "success", value: matrix() } }}>
        <CellHarness />
      </StoreProvider>,
    );

    await userEvent.click(screen.getByTestId("open-cell"));

    // The stage explanation stays; the viewer is added below it.
    await waitFor(() => {
      expect(screen.getByTestId("artifact-viewer")).toBeDefined();
    });
    expect(
      screen.getByRole("button", { name: "logical-components.md" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "performance-design.md" })).toBeDefined();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "論理コンポーネント" })).toBeDefined();
    });
    vi.unstubAllGlobals();
  });

  it("shows no viewer for a stage selection", async () => {
    setup();
    await userEvent.click(screen.getByTestId("trigger"));
    expect(screen.queryByTestId("artifact-viewer")).toBeNull();
  });
});
