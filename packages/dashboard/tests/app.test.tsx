import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App.tsx";
import { AreaBoundary } from "../src/components/AreaBoundary.tsx";
import { NowStrip } from "../src/components/NowStrip.tsx";
import { applyTheme, nextTheme, ThemeToggle } from "../src/components/ThemeToggle.tsx";
import { StoreProvider } from "../src/store/context.tsx";
import { matrix, payload, stageDoc, workflow } from "./fixtures.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

function stubApi(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: string) => {
    if (input.includes("/api/stage/")) {
      return new Response(
        JSON.stringify({ ok: true, value: stageDoc({ slug: input.split("/").at(-1) }) }),
      );
    }
    if (input.includes("/api/agents/")) {
      return new Response(
        JSON.stringify({
          ok: true,
          value: {
            id: "aidlc-developer-agent",
            displayName: "開発エージェント",
            description: "実装を担当",
            markdown: "実装を担当します。",
            stages: ["code-generation"],
            knowledge: [],
          },
        }),
      );
    }
    if (input.includes("/api/matrix")) {
      return new Response(JSON.stringify({ ok: true, value: matrix() }));
    }
    if (input.includes("/api/links")) return new Response(JSON.stringify({ ok: true, value: [] }));
    if (input.includes("/api/guides")) {
      return new Response(JSON.stringify({ ok: true, value: [] }));
    }
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
      expect(screen.getByTestId("now-current-stage").textContent).toBe("code-generation");
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
    const heading = within(panel).getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("3.5 code-generation");
    expect(within(heading).getByText("awaiting approval")).toBeDefined();
    // Home content is parked; the shared header stays visible.
    expect(document.querySelector(".app-home")?.hasAttribute("data-parked")).toBe(true);
    expect(document.querySelector(".app-home")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getByTestId("header-menu-trigger")).toBeDefined();

    await userEvent.click(screen.getByTestId("panel-close"));
    expect(screen.queryByTestId("detail-panel")).toBeNull();
    expect(document.querySelector(".app-home")?.hasAttribute("data-parked")).toBe(false);
  });

  it("keeps the shared header while the usage guides route is open", async () => {
    stubApi();
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: payload() })} />);
    await userEvent.click(await screen.findByTestId("header-menu-trigger"));
    await userEvent.click(await screen.findByTestId("official-docs-open"));
    await waitFor(() => {
      expect(screen.getByTestId("guides-open")).toBeDefined();
    });

    await userEvent.click(screen.getByTestId("guides-open"));
    expect(await screen.findByTestId("guides-panel")).toBeDefined();
    expect(document.querySelector(".app-home")?.hasAttribute("data-parked")).toBe(true);
    expect(screen.getByRole("banner")).toBeDefined();

    await userEvent.click(screen.getByTestId("header-menu-trigger"));
    await userEvent.click(await screen.findByTestId("header-home"));
    expect(screen.queryByTestId("guides-panel")).toBeNull();
    expect(document.querySelector(".app-home")?.hasAttribute("data-parked")).toBe(false);
  });

  it("opens settings as the main page and returns home with navigation focus", async () => {
    stubApi();
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: payload() })} />);
    await screen.findByTestId("now-toggle");
    const homeMain = screen.getByRole("main");
    const home = homeMain.closest(".app-home");
    const menu = within(screen.getByRole("banner")).getByRole("button", { name: "メニュー" });

    await userEvent.click(menu);
    await userEvent.click(await screen.findByRole("menuitem", { name: "設定" }));
    const settings = await screen.findByRole("main", { name: "設定" });
    expect(settings).toBe(screen.getByTestId("settings-page"));
    expect(screen.queryByRole("dialog")).toBeNull();
    const sharedHeader = within(screen.getByRole("banner"));
    expect(sharedHeader.getByRole("button", { name: "メニュー" })).toBe(menu);
    expect(home?.hasAttribute("data-parked")).toBe(true);
    expect(home?.getAttribute("aria-hidden")).toBe("true");
    expect(home?.hasAttribute("inert")).toBe(true);
    expect(screen.queryByRole("navigation", { name: "ステージ一覧" })).toBeNull();

    await userEvent.click(within(settings).getByRole("button", { name: "ステージ一覧に戻る" }));
    expect(screen.queryByTestId("settings-page")).toBeNull();
    expect(screen.getByRole("main")).toBe(homeMain);
    expect(home?.hasAttribute("data-parked")).toBe(false);
    expect(home?.getAttribute("aria-hidden")).toBe("false");
    expect(home?.hasAttribute("inert")).toBe(false);
    await waitFor(() => {
      expect(document.activeElement).toBe(menu);
    });
  });
});

describe("shared stage progress", () => {
  it("keeps disclosure across stage and agent navigation, and hides it on unrelated pages", async () => {
    stubApi();
    const user = userEvent.setup();
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: payload() })} />);
    const toggle = await screen.findByTestId("now-toggle");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await user.click(screen.getByTestId("stage-rail-item-functional-design"));
    await screen.findByTestId("detail-panel");
    expect(screen.getByTestId("now-current-stage").textContent).toBe("code-generation");
    expect(screen.getByTestId("now-toggle")).toBe(toggle);
    await user.click(await screen.findByTestId("agent-link-aidlc-developer-agent"));
    await screen.findByTestId("agent-panel");
    expect(screen.getByTestId("now-toggle").getAttribute("aria-expanded")).toBe("true");
    await user.click(screen.getByTestId("agent-back"));
    expect(await screen.findByTestId("detail-panel")).toBeDefined();
    for (const page of ["settings-open", "effectiveness-open", "official-docs-open"]) {
      await user.click(screen.getByTestId("header-menu-trigger"));
      await user.click(await screen.findByTestId(page));
      expect(screen.queryByRole("region", { name: "現在地" })).toBeNull();
    }
    await user.click(await screen.findByTestId("guides-open"));
    expect(await screen.findByTestId("guides-panel")).toBeDefined();
    expect(screen.queryByRole("region", { name: "現在地" })).toBeNull();
    await user.click(screen.getByTestId("header-home-button"));
    expect(screen.getByTestId("now-toggle").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("heading", { name: "ステージ一覧", level: 1 })).toBeDefined();
    expect(screen.getByRole("heading", { name: "成果物マトリクス" })).toBeDefined();
  });
});

describe("NowStrip states", () => {
  it("starts collapsed, exposes current stage and status, and opens from the keyboard", async () => {
    render(<NowStrip state={{ kind: "success", value: workflow() }} onRetry={() => {}} />);
    const toggle = screen.getByTestId("now-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("code-generation");
    expect(toggle.textContent).toContain("awaiting approval");
    expect(screen.queryByRole("button", { name: /スコープ/ })).toBeNull();
    toggle.focus();
    await userEvent.keyboard("{Enter}");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(await screen.findByTestId("done-total")).toBeDefined();
  });

  it("does not call a finished or missing current stage in progress", () => {
    const { rerender } = render(
      <NowStrip
        state={{
          kind: "success",
          value: workflow({
            currentStage: null,
            gate: null,
            done: 6,
          }),
        }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByTestId("now-toggle").textContent).toContain("ワークフロー完了");
    expect(screen.getByTestId("now-toggle").textContent).not.toContain("進行中");
    rerender(
      <NowStrip
        state={{ kind: "success", value: workflow({ currentStage: null, gate: null }) }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByTestId("now-toggle").textContent).toContain("現在のステージなし");
  });

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
    expect(screen.getByText("サーバに接続できません")).toBeDefined();
    await userEvent.click(screen.getByTestId("retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows degradation notes next to an otherwise normal strip", () => {
    render(
      <NowStrip
        expanded
        state={{ kind: "partial", value: workflow(), notes: ["gate: unknown mark"] }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByTestId("done-total").textContent).toBe("3 / 6");
    expect(screen.getByTestId("now-scope").textContent).toBe("mvp");
    expect(screen.getByText(/gate: unknown mark/)).toBeDefined();
  });

  it("opens a HoverCard that explains scope (definition + current + bullets)", async () => {
    render(<NowStrip expanded state={{ kind: "success", value: workflow() }} onRetry={() => {}} />);
    await userEvent.hover(screen.getByTestId("now-field-scope"));
    const card = await screen.findByTestId("now-explain-scope");
    expect(within(card).getByText(/EXECUTE \/ SKIP/)).toBeDefined();
    expect(within(card).getByText(/選択中は「mvp」/)).toBeDefined();
    expect(within(card).getByText(/\/aidlc --scope/)).toBeDefined();
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
    expect(root.classList.contains("dark")).toBe(true);
    applyTheme("light", root);
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.classList.contains("dark")).toBe(false);
  });

  it("applies the picked theme to the document on click", async () => {
    render(
      <StoreProvider>
        <ThemeToggle />
      </StoreProvider>,
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    const toggle = screen.getByRole("button", { name: "ダークテーマに切り替え" });
    expect(toggle.getAttribute("data-slot")).toBe("button");
    await userEvent.click(toggle);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await userEvent.click(screen.getByRole("button", { name: "ライトテーマに切り替え" }));
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
