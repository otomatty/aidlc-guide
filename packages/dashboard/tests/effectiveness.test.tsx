import type {
  EffectivenessPayload,
  IntentEffectiveness,
  ReadResult,
} from "@aidlc-guide/shared-types";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import EffectivenessPanel from "../src/components/EffectivenessPanel.tsx";
import { summarizeEffectiveness } from "../src/components/effectiveness-summary.ts";
import { Header } from "../src/components/Header.tsx";
import { TooltipProvider } from "../src/components/ui/tooltip.tsx";
import { StoreProvider, useDispatch } from "../src/store/context.tsx";
import { reducer } from "../src/store/reducer.ts";
import { initialState } from "../src/store/state.ts";

afterEach(() => vi.unstubAllGlobals());

function intent(name: string, overrides: Partial<IntentEffectiveness> = {}): IntentEffectiveness {
  return {
    dirName: name,
    id: name,
    name,
    scope: "mvp",
    depth: "standard",
    status: "Completed",
    startedAt: "2026-09-10T00:00:00Z",
    completedAt: "2026-09-10T02:00:00Z",
    completionMs: 7_200_000,
    elapsedMs: 7_200_000,
    auditEventCount: 20,
    approvalWait: {
      completedMs: 300_000,
      pendingMs: 0,
      completedIntervals: 1,
      pendingIntervals: 0,
      excludedIntervals: 0,
    },
    rejections: 0,
    revisions: 0,
    humanTurns: 3,
    reviews: {
      completed: 2,
      ready: 2,
      notReady: 0,
      firstPassReady: 1,
      firstPassTotal: 2,
      firstPassRate: 0.5,
      unmatched: 0,
    },
    sensors: { verifiedPassed: 3, failed: 1, skipped: 2, incomplete: 1, findings: 4 },
    usage: null,
    warnings: [],
    ...overrides,
  };
}

function payload(rows = [intent("完成案件")], space = "default"): EffectivenessPayload {
  return { space, generatedAt: "2026-09-11T00:00:00Z", intents: rows, warnings: [] };
}

function Controls() {
  const dispatch = useDispatch();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "intents",
            result: {
              ok: true,
              value: {
                space: "other",
                active: "次の案件",
                selected: "次の案件",
                all: ["次の案件"],
              },
            },
          })
        }
      >
        別のスペース
      </button>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "ws",
            message: { type: "change", scope: "audit", events: [] },
            receivedAt: new Date().toISOString(),
          })
        }
      >
        変更通知
      </button>
    </>
  );
}

function Harness({
  open = false,
  selected = "完成案件",
}: {
  open?: boolean;
  selected?: string | null;
}) {
  return (
    <StoreProvider
      preloaded={{
        effectivenessOpen: open,
        intents: {
          kind: "success",
          value: { space: "default", selected, active: "完成案件", all: ["完成案件"] },
        },
      }}
    >
      <TooltipProvider>
        <Header />
        <Controls />
        <EffectivenessPanel />
      </TooltipProvider>
    </StoreProvider>
  );
}

function stubMetrics(
  load: () => ReadResult<EffectivenessPayload> | Promise<ReadResult<EffectivenessPayload>>,
) {
  const metrics = vi.fn(load);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const result =
        String(input) === "/api/effectiveness" ? await metrics() : { ok: true, value: [] };
      return new Response(JSON.stringify(result));
    }),
  );
  return metrics;
}

describe("effectiveness observations", () => {
  it("opens directly from the picker without selecting an intent", async () => {
    const calls = stubMetrics(() => ({ ok: true, value: payload() }));
    render(<Harness selected={null} />);
    expect(screen.getByTestId("intent-dialog")).toBeTruthy();
    expect(calls).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "効果測定を見る" }));
    expect(await screen.findByTestId("effectiveness-row-完成案件")).toBeTruthy();
    expect(screen.queryByTestId("intent-dialog")).toBeNull();
    await userEvent.click(screen.getByText("変更通知"));
    await screen.findByTestId("effectiveness-row-完成案件");
    expect(screen.queryByTestId("intent-dialog")).toBeNull();
  });

  it("renders zero minutes distinctly and keeps long descriptions compact", async () => {
    const longName = "とても長い案件の説明".repeat(40);
    stubMetrics(() => ({
      ok: true,
      value: payload([
        intent("stable-id", {
          name: longName,
          completionMs: 0,
          approvalWait: {
            completedMs: 0,
            pendingMs: 0,
            completedIntervals: 1,
            pendingIntervals: 0,
            excludedIntervals: 0,
          },
        }),
      ]),
    }));
    render(<Harness open />);
    const row = await screen.findByTestId("effectiveness-row-stable-id");
    expect(within(row).getAllByText("0分")).toHaveLength(2);
    expect(row.textContent).not.toContain("<1m");
    expect(within(row).getByText("stable-id")).toBeTruthy();
    expect(within(row).getByTitle(longName).className).toContain("line-clamp-2");
  });
  it("loads only while open and stops responding to audit pushes after close", async () => {
    const calls = stubMetrics(() => ({ ok: true, value: payload() }));
    render(<Harness />);
    expect(calls).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("effectiveness-open"));
    expect(await screen.findByTestId("effectiveness-row-完成案件")).toBeTruthy();
    expect(calls).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("effectiveness-open").getAttribute("aria-current")).toBe("page");
    await userEvent.click(screen.getByTestId("effectiveness-close"));
    await userEvent.click(screen.getByText("変更通知"));
    expect(calls).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("effectiveness-panel")).toBeNull();
  });

  it("separates zero, missing data, pending wait, and unfinished lead time", async () => {
    stubMetrics(() => ({
      ok: true,
      value: payload([
        intent("完成案件"),
        intent("進行案件", {
          status: "Active",
          completedAt: null,
          completionMs: null,
          elapsedMs: 600_000,
          rejections: null,
          sensors: null,
          reviews: null,
          approvalWait: {
            completedMs: 0,
            pendingMs: 120_000,
            completedIntervals: 0,
            pendingIntervals: 1,
            excludedIntervals: 0,
          },
        }),
        intent("完了日時不明", {
          completedAt: null,
          completionMs: null,
          elapsedMs: 999_000,
          reviews: {
            completed: 0,
            ready: 0,
            notReady: 0,
            firstPassReady: 0,
            firstPassTotal: 0,
            firstPassRate: null,
            unmatched: 0,
          },
        }),
      ]),
    }));
    render(<Harness open />);
    const complete = within(await screen.findByTestId("effectiveness-row-完成案件"));
    expect(complete.getByText("0 件")).toBeTruthy();
    expect(complete.getByText("50%")).toBeTruthy();
    const active = within(screen.getByTestId("effectiveness-row-進行案件"));
    expect(active.getByText("進行中の経過")).toBeTruthy();
    expect(active.getAllByText("未記録").length).toBe(4);
    expect(active.getByText(/確定分.*待機中/)).toBeTruthy();
    const unknown = within(screen.getByTestId("effectiveness-row-完了日時不明"));
    expect(unknown.queryByText("進行中の経過")).toBeNull();
    expect(unknown.getByText("対象なし")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "比較対象の集計" })).getByText(
        /完了の記録あり 1 \/ 3 件/,
      ),
    ).toBeTruthy();
  });

  it("retains scope/depth filters across manual and push refreshes", async () => {
    const calls = stubMetrics(() => ({
      ok: true,
      value: payload([
        intent("対象"),
        intent("別scope", { scope: "fix" }),
        intent("別depth", { depth: "minimal" }),
      ]),
    }));
    render(<Harness open />);
    await screen.findByTestId("effectiveness-row-対象");
    await userEvent.selectOptions(
      screen.getByLabelText("Scope（対象範囲）"),
      JSON.stringify("mvp"),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Depth（進め方の深さ）"),
      JSON.stringify("standard"),
    );
    expect(screen.queryByTestId("effectiveness-row-別scope")).toBeNull();
    expect(screen.queryByTestId("effectiveness-row-別depth")).toBeNull();
    await userEvent.click(screen.getByTestId("effectiveness-refresh"));
    await screen.findByTestId("effectiveness-row-対象");
    await userEvent.click(screen.getByText("変更通知"));
    await screen.findByTestId("effectiveness-row-対象");
    expect(calls).toHaveBeenCalledTimes(3);
    expect(screen.queryByTestId("effectiveness-row-別depth")).toBeNull();
    expect(screen.getByText("表示 1 / 3 件")).toBeTruthy();
  });

  it("exposes partial data and Claude cost caveats without showing diagnostic bodies upfront", async () => {
    stubMetrics(() => ({
      ok: true,
      warnings: ["unreadable shard"],
      value: {
        ...payload([
          intent("利用記録", {
            warnings: ["missing review pair"],
            usage: {
              source: "claude-ledger",
              inputTokens: 100,
              outputTokens: 20,
              cacheReadTokens: 30,
              cacheWriteTokens: 4,
              estimatedUsd: 0.25,
              partial: true,
              unknownModels: ["unknown-model"],
            },
          }),
        ]),
        warnings: ["unreadable shard"],
      },
    }));
    render(<Harness open />);
    const row = await screen.findByTestId("effectiveness-row-利用記録");
    expect(screen.getByText("一部の記録を集計できません")).toBeTruthy();
    expect(screen.getByText("集計の注意 1 件").closest("details")?.open).toBe(false);
    expect(within(row).getByText("$0.25")).toBeTruthy();
    expect(within(row).getByText(/一部の記録・推定/)).toBeTruthy();
    await userEvent.click(within(row).getByText(/記録の内訳/));
    expect(within(row).getByText(/省略と証跡不足は合格に含めません/)).toBeTruthy();
    expect(within(row).getByText(/キャッシュ読取 30/)).toBeTruthy();
    expect(within(row).getByText(/単価不明のモデル: unknown-model/)).toBeTruthy();
    expect(screen.getByText(/Cursor を含む全ツールの総費用ではありません/)).toBeTruthy();
  });

  it("discards a previous space's delayed response", async () => {
    let resolveOld: (value: ReadResult<EffectivenessPayload>) => void = () => {};
    const old = new Promise<ReadResult<EffectivenessPayload>>((resolve) => {
      resolveOld = resolve;
    });
    let count = 0;
    stubMetrics(() =>
      ++count === 1 ? old : { ok: true, value: payload([intent("次の案件")], "other") },
    );
    render(<Harness open />);
    await userEvent.click(screen.getByText("別のスペース"));
    await screen.findByTestId("effectiveness-row-次の案件");
    await act(async () => {
      resolveOld({ ok: true, value: payload([intent("古い案件")]) });
    });
    expect(screen.queryByTestId("effectiveness-row-古い案件")).toBeNull();
    expect(screen.getByTestId("effectiveness-row-次の案件")).toBeTruthy();
  });

  it("keeps the newer push response when the first request finishes late", async () => {
    let resolveOld: (value: ReadResult<EffectivenessPayload>) => void = () => {};
    const old = new Promise<ReadResult<EffectivenessPayload>>((resolve) => {
      resolveOld = resolve;
    });
    let count = 0;
    stubMetrics(() => (++count === 1 ? old : { ok: true, value: payload([intent("新しい集計")]) }));
    render(<Harness open />);
    await userEvent.click(screen.getByText("変更通知"));
    await screen.findByTestId("effectiveness-row-新しい集計");
    await act(async () => {
      resolveOld({ ok: true, value: payload([intent("古い集計")]) });
    });
    expect(screen.queryByTestId("effectiveness-row-古い集計")).toBeNull();
  });

  it("recovers from an unavailable endpoint and shows an empty space", async () => {
    let count = 0;
    stubMetrics(() =>
      ++count === 1
        ? { error: true, reason: "server-unreachable" }
        : { ok: true, value: payload([]) },
    );
    render(<Harness open />);
    expect(await screen.findByText("読み込みエラー")).toBeTruthy();
    await userEvent.click(screen.getByTestId("effectiveness-refresh"));
    expect(await screen.findByText("計測対象の案件がありません")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("does not merge completed and ongoing durations or treat missing amounts as zero", () => {
    const total = summarizeEffectiveness([
      intent("a", { completionMs: 60_000 }),
      intent("b", { completionMs: 180_000 }),
      intent("c", {
        completionMs: null,
        elapsedMs: 99_000_000,
        rejections: null,
        approvalWait: null,
        reviews: null,
        sensors: null,
      }),
    ]);
    expect(total.completed).toEqual({ median: 120_000, count: 2 });
    expect(total.rejections).toEqual({ total: 0, count: 2 });
    expect(total.usage).toMatchObject({ usd: null, count: 0, priced: 0 });
  });

  it("opens a route exclusive of the other panels and closes on home/stage/docs navigation", () => {
    const open = reducer(
      { ...initialState, guidesOpen: true, selected: { kind: "stage", slug: "code-generation" } },
      { type: "effectiveness", open: true },
    );
    expect(open).toMatchObject({
      effectivenessOpen: true,
      guidesOpen: false,
      selected: null,
      docsShellOpen: false,
      agentOpen: null,
    });
    expect(reducer(open, { type: "home" }).effectivenessOpen).toBe(false);
    expect(
      reducer(open, { type: "select", selection: { kind: "stage", slug: "code-generation" } })
        .effectivenessOpen,
    ).toBe(false);
    expect(reducer(open, { type: "docs-shell", open: true }).effectivenessOpen).toBe(false);
  });
});
