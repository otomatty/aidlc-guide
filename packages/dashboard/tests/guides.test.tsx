import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GuidesButton } from "../src/components/GuidesButton.tsx";
import { GuidesPanel } from "../src/components/GuidesPanel.tsx";
import { StoreProvider } from "../src/store/context.tsx";
import { reducer } from "../src/store/reducer.ts";
import { initialState } from "../src/store/state.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubGuidesApi(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/api/guides") {
      return new Response(
        JSON.stringify({
          ok: true,
          value: [
            { name: "README.md", title: "Index" },
            { name: "getting-started.md", title: "はじめに" },
          ],
        }),
      );
    }
    if (path.includes("/api/guides/getting-started.md")) {
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            name: "getting-started.md",
            title: "はじめに",
            markdown: "# はじめに\n\nHello.\n",
          },
        }),
      );
    }
    if (path.includes("/api/guides/README.md")) {
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            name: "README.md",
            title: "Index",
            markdown: "# Index\n\nSee [start](./getting-started.md).\n",
          },
        }),
      );
    }
    return new Response(JSON.stringify({ error: true, reason: "unexpected" }), { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

function Harness(): ReactNode {
  return (
    <StoreProvider>
      <TooltipProvider>
        <div className="app-home">
          <GuidesButton />
        </div>
        <GuidesPanel />
      </TooltipProvider>
    </StoreProvider>
  );
}

describe("GuidesButton — in-app usage docs", () => {
  it("opens the panel, lists guides in a left drawer, and loads a guide", async () => {
    stubGuidesApi();
    render(<Harness />);

    await userEvent.click(screen.getByTestId("guides-open"));
    expect(screen.getByTestId("guides-panel")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("guides-body").textContent).toContain("See");
    });

    // List is in the left drawer, not under the header.
    expect(screen.queryByTestId("guide-item-README.md")).toBeNull();
    await userEvent.click(screen.getByTestId("guides-menu"));
    expect(screen.getByTestId("guides-drawer")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("guide-item-README.md")).toBeTruthy();
    });

    await userEvent.click(screen.getByTestId("guide-item-getting-started.md"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "はじめに" })).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId("guides-body").textContent).toContain("Hello");
    });
    // Selecting a guide closes the drawer.
    expect(screen.queryByTestId("guides-drawer")).toBeNull();
  });
});

describe("guides route exclusivity", () => {
  it("clears a stage selection when guides open, and vice versa", () => {
    const withStage = reducer(initialState, {
      type: "select",
      selection: { kind: "stage", slug: "code-generation" },
    });
    expect(withStage.selected?.kind).toBe("stage");

    const guides = reducer(withStage, { type: "guides", open: true });
    expect(guides.guidesOpen).toBe(true);
    expect(guides.selected).toBeNull();

    const backToStage = reducer(guides, {
      type: "select",
      selection: { kind: "stage", slug: "build-and-test" },
    });
    expect(backToStage.selected).toEqual({ kind: "stage", slug: "build-and-test" });
    expect(backToStage.guidesOpen).toBe(false);
  });
});

describe("agent route exclusivity in guides tests", () => {
  it("clears agentOpen when guides open", () => {
    const withAgent = reducer(
      reducer(initialState, {
        type: "select",
        selection: { kind: "stage", slug: "build-and-test" },
      }),
      { type: "open-agent", id: "aidlc-quality-agent" },
    );
    const guides = reducer(withAgent, { type: "guides", open: true });
    expect(guides.agentOpen).toBeNull();
  });
});
