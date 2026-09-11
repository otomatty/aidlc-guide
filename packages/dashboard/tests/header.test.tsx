import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "../src/components/Header.tsx";
import { NextStepCallout } from "../src/components/NextStepCallout.tsx";
import { StoreProvider } from "../src/store/context.tsx";
import { nextStep, workflow } from "./fixtures.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubLinks(value: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, value })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
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

    const external = await screen.findByRole("link", { name: "リポジトリ" });
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer");

    const local = screen.getByRole("link", { name: "設計" });
    expect(local.getAttribute("target")).toBeNull();
    // S-UI-4: a non-http(s) scheme never becomes a link.
    expect(screen.queryByRole("link", { name: "危険" })).toBeNull();
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

  it("explains the document and settings icons on hover", async () => {
    stubLinks([]);
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflow() } }}>
        <Header />
      </StoreProvider>,
    );
    const user = userEvent.setup();
    const docs = screen.getByRole("button", { name: "ドキュメント" });
    const settings = screen.getByRole("button", { name: "設定" });
    expect(docs.textContent).toBe("");
    expect(settings.textContent).toBe("");
    expect(screen.queryByTestId("guides-open")).toBeNull();
    await user.hover(docs);
    expect(await screen.findByText("ドキュメント：使い方・AI-DLC公式文書")).toBeTruthy();
    await user.unhover(docs);
    await user.hover(settings);
    expect(await screen.findByText("設定：インストール・更新")).toBeTruthy();
  });

  it("runs the existing IDE update flow only from settings and restores keyboard focus", async () => {
    stubLinks([]);
    const postMessage = vi.fn();
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
    render(
      <StoreProvider>
        <Header />
      </StoreProvider>,
    );
    const user = userEvent.setup();
    const settings = screen.getByRole("button", { name: "設定" });
    expect(screen.queryByTestId("check-update")).toBeNull();
    settings.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", { name: "設定" });
    expect(
      within(screen.getByRole("banner", { hidden: true })).queryByTestId("check-update"),
    ).toBeNull();
    expect(postMessage).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "更新を確認" }));
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: "check-update" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(settings));
  });

  it("explains where browser users can update without offering an inert action", async () => {
    stubLinks([]);
    render(
      <StoreProvider>
        <Header />
      </StoreProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "設定" }));
    const dialog = await screen.findByRole("dialog", { name: "設定" });
    expect(dialog.textContent).toContain("IDEでAIDLC Guideを開き");
    expect(within(dialog).queryByTestId("check-update")).toBeNull();
    expect(dialog.textContent).toContain("IDEで対象のプロジェクトを開き");
    expect(within(dialog).queryByRole("button", { name: "インストール画面を開く" })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens workflows installation from settings without starting installation", async () => {
    stubLinks([]);
    const postMessage = vi.fn();
    vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
    render(
      <StoreProvider>
        <Header />
      </StoreProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "設定" }));
    const dialog = await screen.findByRole("dialog", { name: "設定" });
    expect(dialog.textContent).toContain("使うツールを複数選んで");
    expect(postMessage).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "インストール画面を開く" }));
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
