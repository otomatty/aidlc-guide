import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "../src/components/Header.tsx";
import { NextStepCallout } from "../src/components/NextStepCallout.tsx";
import { SettingsPage } from "../src/components/SettingsPage.tsx";
import { StoreProvider, useAppState } from "../src/store/context.tsx";
import { nextStep, workflow } from "./fixtures.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubLinks(value: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, value })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

function SettingsRoute() {
  return useAppState().settingsOpen ? <SettingsPage /> : null;
}

async function openSettings() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "メニュー" }));
  await user.click(await screen.findByRole("menuitem", { name: "設定" }));
  return screen.findByRole("main", { name: "設定" });
}

describe("Header (BLM step 7)", () => {
  it("fetches project links after first paint and renders the safe ones", async () => {
    const fetchMock = stubLinks([
      { label: "リポジトリ", target: "https://example.com/repo" },
      { label: "設計", target: "docs/design.md" },
      { label: "危険", target: "javascript:alert(1)" },
    ]);

    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflow() } }}>
        <Header />
      </StoreProvider>,
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/links", expect.anything());
    });

    expect(screen.queryByText("AIDLC Guide")).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "メニュー" }));
    const external = await screen.findByRole("menuitem", { name: "リポジトリ" });
    expect(external.tagName).toBe("A");
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer");

    const local = screen.getByRole("menuitem", { name: "設計" });
    expect(local.getAttribute("target")).toBeNull();
    // S-UI-4: a non-http(s) scheme never becomes a link.
    expect(screen.queryByRole("menuitem", { name: "危険" })).toBeNull();
  });

  it("shows the read-only badge only in --host mode", () => {
    stubLinks([]);
    const { unmount } = render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflow() } }}>
        <Header />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("read-only-badge")).toBeNull();
    unmount();

    render(
      <StoreProvider
        preloaded={{ workflow: { kind: "success", value: workflow() }, hostMode: true }}
      >
        <Header />
      </StoreProvider>,
    );
    expect(screen.getByTestId("read-only-badge").getAttribute("role")).toBe("status");
  });

  it("names the selected intent in the picker", () => {
    stubLinks([]);
    render(
      <StoreProvider
        preloaded={{
          workflow: { kind: "success", value: workflow() },
          intents: {
            kind: "success",
            value: {
              space: "default",
              active: "aidlc-guide",
              all: ["aidlc-guide"],
              selected: "aidlc-guide",
            },
          },
        }}
      >
        <Header />
      </StoreProvider>,
    );
    expect(screen.getByTestId("intent-picker").textContent).toContain("aidlc-guide");
  });

  it("opens a labelled menu and dismisses it with Escape or an outside click", async () => {
    stubLinks([]);
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflow() } }}>
        <Header />
      </StoreProvider>,
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "メニュー" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("official-docs-open")).toBeNull();
    trigger.focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu", { name: "メニュー" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["ステージ一覧", "効果測定", "ドキュメント", "設定"]);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    await screen.findByRole("menu");
    await user.click(screen.getByTestId("live-status"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("returns to the stage list from the persistent button and the menu", async () => {
    stubLinks([]);
    render(
      <StoreProvider>
        <Header />
        <SettingsRoute />
      </StoreProvider>,
    );
    const home = screen.getByRole("button", { name: "ステージ一覧" });
    expect(home).toBe(screen.getByTestId("header-home-button"));
    expect(home.getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("menu")).toBeNull();

    await openSettings();
    expect(home.getAttribute("aria-current")).toBeNull();
    await userEvent.click(home);
    await waitFor(() => expect(screen.queryByRole("main", { name: "設定" })).toBeNull());
    expect(home.getAttribute("aria-current")).toBe("page");

    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: "メニュー" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "ステージ一覧" }));
    await waitFor(() => expect(screen.queryByRole("main", { name: "設定" })).toBeNull());
    expect(home.getAttribute("aria-current")).toBe("page");
  });

  it("runs the existing IDE update flow only from settings and restores keyboard focus", async () => {
    stubLinks([]);
    const postMessage = vi.fn();
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
    render(
      <StoreProvider>
        <Header />
        <SettingsRoute />
      </StoreProvider>,
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "メニュー" });
    expect(screen.queryByTestId("check-update")).toBeNull();
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{End}{Enter}");
    const page = await screen.findByRole("main", { name: "設定" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(within(page).getByRole("heading", { level: 1 })),
    );
    expect(
      within(screen.getByRole("banner", { hidden: true })).queryByTestId("check-update"),
    ).toBeNull();
    expect(postMessage).not.toHaveBeenCalled();
    await user.click(within(page).getByRole("button", { name: "更新を確認" }));
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: "check-update" });
    await user.click(within(page).getByRole("button", { name: "ステージ一覧に戻る" }));
    await waitFor(() => expect(screen.queryByRole("main", { name: "設定" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("explains where browser users can update without offering an inert action", async () => {
    stubLinks([]);
    render(
      <StoreProvider>
        <Header />
        <SettingsRoute />
      </StoreProvider>,
    );
    const page = await openSettings();
    expect(page.textContent).toContain("IDEでAIDLC Guideを開き");
    expect(within(page).queryByTestId("check-update")).toBeNull();
    expect(page.textContent).toContain("IDEで対象のプロジェクトを開き");
    expect(within(page).queryByRole("button", { name: "インストール画面を開く" })).toBeNull();
    await userEvent.click(within(page).getByRole("button", { name: "ステージ一覧に戻る" }));
    await waitFor(() => expect(screen.queryByRole("main", { name: "設定" })).toBeNull());
  });

  it("opens workflows installation from settings without starting installation", async () => {
    stubLinks([]);
    const postMessage = vi.fn();
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
    render(
      <StoreProvider>
        <Header />
        <SettingsRoute />
      </StoreProvider>,
    );
    const user = userEvent.setup();
    const page = await openSettings();
    expect(page.textContent).toContain("使うツールを複数選んで一括設定できます");
    expect(page.textContent).toContain("設定済みのプロジェクトにも、別のツールを追加できます");
    expect(postMessage).not.toHaveBeenCalled();
    await user.click(within(page).getByRole("button", { name: "インストール画面を開く" }));
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: "open-workflows-install" });
  });
});

describe("NextStepCallout navigation", () => {
  it("hands the next slug back to the caller", async () => {
    const onOpenNext = vi.fn();
    render(<NextStepCallout nextStep={nextStep()} onOpenNext={onOpenNext} />);
    await userEvent.click(screen.getByRole("button", { name: /その解説を見る/ }));
    expect(onOpenNext).toHaveBeenCalledWith("build-and-test");
  });
});
