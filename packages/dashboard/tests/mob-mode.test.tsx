import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailPanel } from "../src/components/DetailPanel.tsx";
import { Header } from "../src/components/Header.tsx";
import { LiveStatus } from "../src/components/LiveStatus.tsx";
import { ReadOnlyBadge } from "../src/components/ReadOnlyBadge.tsx";
import { StoreProvider, useDispatch } from "../src/store/context.tsx";
import { type LiveStatusView, liveStatusView } from "../src/store/liveStatusView.ts";
import type { LiveSlice } from "../src/store/state.ts";
import { matrix, nextStep, stageDoc, workflow } from "./fixtures.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** mob-mode M2/M3 — the two participant-facing indicators and their view model. */

const CHANGE_AT = "2026-07-25T10:00:00.000Z";

function live(overrides: Partial<LiveSlice> = {}): LiveSlice {
  return { connected: false, degraded: false, everConnected: false, ...overrides };
}

describe("liveStatusView (BLM M3 / R-MM-3)", () => {
  // One row per row of the BLM M3 table — the mapping is the contract.
  it.each<[string, LiveSlice, LiveStatusView]>([
    ["初回接続前", live(), { kind: "connecting" }],
    [
      "接続済み・正常",
      live({ connected: true, everConnected: true, lastChangeAt: CHANGE_AT }),
      { kind: "live", lastChangeAt: CHANGE_AT },
    ],
    ["切断後・再接続待ち", live({ everConnected: true }), { kind: "reconnecting" }],
    [
      "接続済み・縮退",
      live({ connected: true, everConnected: true, degraded: true, reason: "watcher-lost" }),
      { kind: "degraded", reason: "watcher-lost" },
    ],
  ])("derives %s", (_name, slice, expected) => {
    expect(liveStatusView(slice)).toEqual(expected);
  });

  it("never reports live while disconnected, even if the server last said healthy", () => {
    // The degraded flag survives a drop (the reducer only clears it on
    // reconnect); "disconnected" must still win.
    const dropped = live({ everConnected: true, degraded: true, reason: "watcher-lost" });
    expect(liveStatusView(dropped).kind).toBe("reconnecting");

    // And the connected-but-no-change-yet case reports live *without*
    // inventing a 最終更新 time.
    expect(liveStatusView(live({ connected: true, everConnected: true }))).toEqual({
      kind: "live",
      lastChangeAt: null,
    });
  });

  it("degrades with an empty reason when the server sent none", () => {
    expect(liveStatusView(live({ connected: true, everConnected: true, degraded: true }))).toEqual({
      kind: "degraded",
      reason: "",
    });
  });
});

describe("LiveStatus (M3 copy + a11y)", () => {
  it.each<[LiveSlice, string, string]>([
    [live(), "接続中…", "connecting"],
    [live({ everConnected: true }), "切断・再接続中…", "reconnecting"],
    [
      live({ connected: true, everConnected: true, degraded: true, reason: "watcher-lost" }),
      "更新が止まっています（watcher-lost）",
      "degraded",
    ],
    [live({ connected: true, everConnected: true }), "更新中", "live"],
  ])("announces %o politely", (slice, text, state) => {
    render(<LiveStatus live={slice} />);
    const status = screen.getByTestId("live-status");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("data-state")).toBe(state);
    expect(status.textContent).toContain(text);
  });

  it("does not surface a last-change timestamp while live", () => {
    const lastChangeAt = new Date(Date.now() - 120_000).toISOString();
    render(<LiveStatus live={live({ connected: true, everConnected: true, lastChangeAt })} />);
    const text = screen.getByTestId("live-status").textContent ?? "";
    expect(text).toBe("更新中");
    expect(text).not.toContain("最終更新");
  });

  it("omits the parenthesis when the server degraded without a reason", () => {
    render(<LiveStatus live={live({ connected: true, everConnected: true, degraded: true })} />);
    expect(screen.getByTestId("live-status").textContent).toContain("更新が止まっています");
    expect(screen.getByTestId("live-status").textContent).not.toContain("（");
  });
});

describe("ReadOnlyBadge (M2 / US-11)", () => {
  it("states read-only for the participant view", () => {
    render(<ReadOnlyBadge />);
    const badge = screen.getByTestId("read-only-badge");
    expect(badge.getAttribute("role")).toBe("status");
    expect(badge.textContent).toBe("READ-ONLY · 参加者ビュー");
  });

  it("is absent unless the server reports hostMode", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true, value: [] }))),
    );
    const preloaded = { workflow: { kind: "success" as const, value: workflow() } };
    const { unmount } = render(
      <StoreProvider preloaded={preloaded}>
        <Header />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("read-only-badge")).toBeNull();
    // LiveStatus, by contrast, shows for driver and participant alike (M3).
    expect(screen.getByTestId("live-status")).toBeDefined();
    unmount();

    render(
      <StoreProvider preloaded={{ ...preloaded, hostMode: true }}>
        <Header />
      </StoreProvider>,
    );
    expect(screen.getByTestId("read-only-badge").textContent).toBe("READ-ONLY · 参加者ビュー");
    expect(screen.getByTestId("live-status")).toBeDefined();
  });
});

/**
 * The property the mode indicators exist to protect: `hostMode` must survive a
 * failed `/api/workflow`. `refetchAll` re-runs on every WS reconnect, so a
 * transport blip used to flip the client out of participant mode — dropping
 * the badge (S-MM-5) and putting the edit DOM back in front of participants,
 * which is 受入条件「参加者ブラウザの DOM に編集要素が存在しない」.
 */
describe("host mode is sticky against a failed read (S-MM-5 / 受入条件)", () => {
  /** An artifact that *would* produce an editor, so the assertion is not vacuous. */
  const WITH_ANSWER = "# Q\n\n[Answer]: \n";

  /** The editor only exists for `*-questions.md`; point the opened cell at one. */
  function withQuestions(): ReturnType<typeof matrix> {
    const base = matrix();
    return {
      ...base,
      cells: base.cells.map((cell) =>
        cell.unit === "reader-core" && cell.stage === "nfr-design"
          ? { ...cell, files: ["nfr-design-questions.md"] }
          : cell,
      ),
    };
  }

  function CellHarness({ onDispatch }: { onDispatch?: (fail: () => void) => void }): ReactNode {
    const dispatch = useDispatch();
    onDispatch?.(() =>
      dispatch({ type: "workflow", result: { error: true, reason: "state-missing" } }),
    );
    return (
      <>
        <button
          type="button"
          data-testid="open-cell"
          onClick={() =>
            dispatch({
              type: "select",
              selection: { kind: "cell", unit: "reader-core", stage: "nfr-design" },
            })
          }
        >
          セルを開く
        </button>
        <Header />
        <DetailPanel />
      </>
    );
  }

  async function openCell(hostMode: boolean): Promise<() => void> {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        input.includes("/api/links")
          ? new Response(JSON.stringify({ ok: true, value: [] }))
          : new Response(JSON.stringify({ ok: true, value: WITH_ANSWER })),
      ),
    );
    let fail = (): void => {};
    render(
      <StoreProvider
        preloaded={{
          workflow: { kind: "success", value: workflow() },
          nextStep: { kind: "success", value: nextStep() },
          stageDoc: { "code-generation": { kind: "success", value: stageDoc() } },
          matrix: { kind: "success", value: withQuestions() },
          hostMode,
        }}
      >
        <CellHarness
          onDispatch={(f) => {
            fail = f;
          }}
        />
      </StoreProvider>,
    );
    await userEvent.click(screen.getByTestId("open-cell"));
    await waitFor(() => {
      expect(screen.getByTestId("artifact-viewer")).toBeDefined();
    });
    return fail;
  }

  it("positive control: the same artifact does render an editor outside host mode", async () => {
    await openCell(false);
    await waitFor(() => {
      expect(screen.getByTestId("answer-editor")).toBeDefined();
    });
    expect(screen.queryByTestId("read-only-badge")).toBeNull();
  });

  it("keeps the badge and the absent editor across a failed re-read", async () => {
    const failTheRead = await openCell(true);
    expect(screen.queryByTestId("answer-editor")).toBeNull();
    expect(screen.getByTestId("read-only-badge")).toBeDefined();

    // The blip: exactly what a reconnect's refetchAll does when the state file
    // is momentarily unreadable.
    await act(async () => {
      failTheRead();
    });

    expect(screen.queryByTestId("answer-editor")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByTestId("read-only-badge")).toBeDefined();
  });
});
