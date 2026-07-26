import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App.tsx";
import { AreaBoundary } from "../src/components/AreaBoundary.tsx";
import { NowStrip } from "../src/components/NowStrip.tsx";
import { applyTheme, nextTheme, ThemeToggle } from "../src/components/ThemeToggle.tsx";
import { StoreProvider } from "../src/store/context.tsx";
import { matrix, payload, workflow } from "./fixtures.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

function stubApi(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: string) => {
    if (input.includes("/api/matrix")) {
      return new Response(JSON.stringify({ ok: true, value: matrix() }));
    }
    if (input.includes("/api/links")) return new Response(JSON.stringify({ ok: true, value: [] }));
    return new Response(JSON.stringify(payload()));
  });
  vi.stubGlobal("fetch", fetchMock);
  // jsdom has no WebSocket; the live layer must not be what breaks the page.
  vi.stubGlobal(
    "WebSocket",
    class {
      close(): void {}
    },
  );
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

describe("App bootstrap (P-UI-2)", () => {
  it("consumes the pre-mount workflow promise instead of re-requesting it", async () => {
    const fetchMock = stubApi();
    // main.tsx starts this before React exists; here we do the same by hand.
    const bootstrap = Promise.resolve({ ok: true as const, value: payload() });
    render(<App bootstrap={bootstrap} />);

    await waitFor(() => {
      expect(screen.getByTestId("done-total").textContent).toBe("3 / 6");
    });
    const paths = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(paths).not.toContain("/api/workflow");
  });

  it("renders the four landmarks and the current stage marker", async () => {
    stubApi();
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: payload() })} />);

    await waitFor(() => {
      expect(screen.getByRole("banner")).toBeDefined();
    });
    expect(screen.getByRole("navigation", { name: "ステージ一覧" })).toBeDefined();
    expect(screen.getByRole("main")).toBeDefined();
    expect(screen.getByRole("region", { name: "現在地" })).toBeDefined();

    const current = screen.getByTestId("stage-rail-item-code-generation");
    expect(current.getAttribute("aria-current")).toBe("step");

    // The lazily loaded matrix chunk resolves and fills its area.
    await waitFor(() => {
      expect(screen.getByTestId("matrix-cell-reader-core-functional-design")).toBeDefined();
    });
  });

  it("opens the panel from the rail and closes it again", async () => {
    stubApi();
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: payload() })} />);
    await waitFor(() => {
      expect(screen.getByTestId("stage-rail-item-code-generation")).toBeDefined();
    });

    await userEvent.click(screen.getByTestId("stage-rail-item-code-generation"));
    const panel = await screen.findByTestId("detail-panel");
    expect(within(panel).getByRole("heading", { level: 2 }).textContent).toBe(
      "3.5 code-generation",
    );

    await userEvent.click(screen.getByTestId("panel-close"));
    expect(screen.queryByTestId("detail-panel")).toBeNull();
  });
});

describe("NowStrip states", () => {
  it("shows the empty state with the intent picker when there is no active intent", () => {
    render(
      <StoreProvider>
        <NowStrip
          state={{ kind: "empty", hint: "アクティブなインテントがありません" }}
          onRetry={() => {}}
          intentPicker={<button type="button" data-testid="intent-picker" />}
        />
      </StoreProvider>,
    );
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("アクティブなインテントがありません")).toBeDefined();
    expect(screen.getByTestId("intent-picker")).toBeDefined();
  });

  it("offers a retry when the server cannot be reached", async () => {
    const onRetry = vi.fn();
    render(
      <NowStrip state={{ kind: "error", detail: "サーバに接続できません" }} onRetry={onRetry} />,
    );
    expect(screen.getByRole("status").textContent).toContain("サーバに接続できません");
    await userEvent.click(screen.getByTestId("retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows degradation notes next to an otherwise normal strip", () => {
    render(
      <NowStrip
        state={{ kind: "partial", value: workflow(), notes: ["gate: unknown mark"] }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByTestId("done-total").textContent).toBe("3 / 6");
    expect(screen.getByText("gate: unknown mark")).toBeDefined();
  });
});

// LiveStatus moved to its own component with a four-state view model; its
// tests moved with it, to mob-mode.test.tsx.

describe("ThemeToggle", () => {
  it("toggles light ↔ dark and always writes data-theme", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");

    const root = document.documentElement;
    applyTheme("dark", root);
    expect(root.getAttribute("data-theme")).toBe("dark");
    applyTheme("light", root);
    expect(root.getAttribute("data-theme")).toBe("light");
  });

  it("applies the picked theme to the document on click", async () => {
    render(
      <StoreProvider>
        <ThemeToggle />
      </StoreProvider>,
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await userEvent.click(screen.getByTestId("theme-toggle"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await userEvent.click(screen.getByTestId("theme-toggle"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

function Boom(): ReactNode {
  throw new Error("render exploded");
}

describe("AreaBoundary (R-UI-1)", () => {
  it("contains a crash to its own area and offers a remount", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <AreaBoundary name="matrix">
          <Boom />
        </AreaBoundary>
        <AreaBoundary name="now-strip">
          <p>生存している領域</p>
        </AreaBoundary>
      </>,
    );

    expect(screen.getByTestId("area-error-matrix")).toBeDefined();
    expect(screen.getByText("生存している領域")).toBeDefined();
    expect(screen.getByRole("button", { name: "この領域を再読み込み" })).toBeDefined();
    consoleError.mockRestore();
  });
});
