import type { ReadResult, TimingsPayload } from "@aidlc-guide/shared-types";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App.tsx";
import { refetchAll } from "../src/services/api.ts";
import type { Action } from "../src/store/reducer.ts";
import { reducer } from "../src/store/reducer.ts";
import { initialState } from "../src/store/state.ts";
import { matrix, payload as workflowPayload } from "./fixtures.ts";

const payload: TimingsPayload = {
  timings: [
    {
      stage: "code-generation",
      startedAt: "2026-07-25T05:41:30Z",
      endedAt: null,
      wallMs: 7_800_000,
      activeMs: 7_200_000,
      eventCount: 1201,
    },
  ],
  remaining: {
    currentStage: { stage: "code-generation", elapsedActiveMs: 7_200_000, remainingMs: 2_700_000 },
    pendingStages: [
      {
        stage: "build-and-test",
        estimateMs: 960_000,
        rangeMs: null,
        sampleCount: 1,
        basis: "stage",
      },
    ],
    totalRemainingMs: 3_660_000,
    lowConfidence: true,
  },
};

describe("timings slice", () => {
  it("starts as loading", () => {
    expect(initialState.timings).toEqual({ kind: "loading" });
  });

  it("stores a successful payload", () => {
    const result: ReadResult<TimingsPayload> = { ok: true, value: payload };
    const next = reducer(initialState, { type: "timings", result });
    expect(next.timings).toEqual({ kind: "success", value: payload });
  });

  it("surfaces a read failure as an error view state", () => {
    const result: ReadResult<TimingsPayload> = { error: true, reason: "state-missing" };
    const next = reducer(initialState, { type: "timings", result });
    expect(next.timings.kind).toBe("error");
  });

  it("keeps warnings as a partial view state", () => {
    const result: ReadResult<TimingsPayload> = {
      ok: true,
      value: payload,
      warnings: ["intent skipped: broken"],
    };
    const next = reducer(initialState, { type: "timings", result });
    expect(next.timings).toEqual({
      kind: "partial",
      value: payload,
      notes: ["intent skipped: broken"],
    });
  });
});

/**
 * ADR-03: the three startup slices fetch in parallel and `/api/timings` must
 * never join that batch (a full audit parse does not belong on the
 * first-paint critical path). Pinned directly against `refetchAll` rather
 * than through App's effect timing, which is not a reliable place to observe
 * "did NOT happen".
 */
describe("refetchAll (ADR-03 startup batch)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches exactly the three startup slices, never /api/timings", async () => {
    const fetchMock = vi.fn(async (input: string) =>
      input.includes("/api/matrix")
        ? new Response(JSON.stringify({ ok: true, value: matrix() }))
        : new Response(JSON.stringify(workflowPayload())),
    );
    vi.stubGlobal("fetch", fetchMock);

    const actions: Action[] = [];
    await refetchAll((action) => actions.push(action));

    const paths = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(paths).toEqual(["/api/workflow", "/api/matrix", "/api/intents"]);
    expect(actions.map((action) => action.type)).toEqual(["workflow", "matrix", "intents"]);
  });
});

/** Captures every `new WebSocket(...)` App's live layer opens, so a test can
 * hand-drive `onmessage` the way a real change push would arrive. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;

  constructor() {
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }
}

function stubAppApi(): { fetchMock: ReturnType<typeof vi.fn>; sockets: FakeWebSocket[] } {
  const fetchMock = vi.fn(async (input: string) => {
    if (input.includes("/api/matrix"))
      return new Response(JSON.stringify({ ok: true, value: matrix() }));
    if (input.includes("/api/links")) return new Response(JSON.stringify({ ok: true, value: [] }));
    if (input.includes("/api/guides")) return new Response(JSON.stringify({ ok: true, value: [] }));
    if (input.includes("/api/timings"))
      return new Response(JSON.stringify({ ok: true, value: payload }));
    return new Response(JSON.stringify(workflowPayload()));
  });
  vi.stubGlobal("fetch", fetchMock);

  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  return { fetchMock, sockets: FakeWebSocket.instances };
}

function timingsCallCount(fetchMock: ReturnType<typeof vi.fn>): number {
  return fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/timings")).length;
}

describe("timings refresh effect (App.tsx)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches /api/timings once after mount", async () => {
    const { fetchMock } = stubAppApi();
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);

    await waitFor(() => {
      expect(timingsCallCount(fetchMock)).toBe(1);
    });
  });

  it("refetches when a change push advances lastChangeAt", async () => {
    const { fetchMock, sockets } = stubAppApi();
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);
    await waitFor(() => {
      expect(timingsCallCount(fetchMock)).toBe(1);
    });

    act(() => {
      sockets[0]?.onmessage?.({
        data: JSON.stringify({ type: "change", scope: "audit", events: [] }),
      } as MessageEvent);
    });

    await waitFor(() => {
      expect(timingsCallCount(fetchMock)).toBe(2);
    });
  });

  it("does not refetch on an unrelated re-render", async () => {
    const { fetchMock } = stubAppApi();
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);
    await waitFor(() => {
      expect(timingsCallCount(fetchMock)).toBe(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId("guides-open")).toBeDefined();
    });
    await userEvent.click(screen.getByTestId("guides-open"));
    expect(await screen.findByTestId("guides-panel")).toBeDefined();

    expect(timingsCallCount(fetchMock)).toBe(1);
  });
});
