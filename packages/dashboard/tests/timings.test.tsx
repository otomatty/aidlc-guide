import type { ReadResult, TimingsPayload } from "@aidlc-guide/shared-types";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App.tsx";
import { Header } from "../src/components/Header.tsx";
import { NowStrip } from "../src/components/NowStrip.tsx";
import { StageRail } from "../src/components/StageRail.tsx";
import { formatDuration } from "../src/lib/format-duration.ts";
import { refetchAll } from "../src/services/api.ts";
import { StoreProvider } from "../src/store/context.tsx";
import type { Action } from "../src/store/reducer.ts";
import { reducer } from "../src/store/reducer.ts";
import { initialState } from "../src/store/state.ts";
import {
  matrix,
  stage,
  workflow as workflowFixture,
  payload as workflowPayload,
} from "./fixtures.ts";

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
        sampleCount: 1,
        basis: "stage",
      },
    ],
    totalRemainingMs: 3_660_000,
    lowConfidence: true,
  },
};

describe("formatDuration", () => {
  it("renders minutes below an hour", () => {
    expect(formatDuration(45 * 60_000)).toBe("45m");
  });

  it("renders hours and zero-padded minutes at or above an hour", () => {
    expect(formatDuration(60 * 60_000)).toBe("1h00m");
    expect(formatDuration(2 * 60 * 60_000 + 10 * 60_000)).toBe("2h10m");
  });

  it("rounds to the nearest minute", () => {
    expect(formatDuration(89_000)).toBe("1m");
    expect(formatDuration(91_000)).toBe("2m");
  });

  it("renders under a minute as a floor rather than 0m", () => {
    expect(formatDuration(5_000)).toBe("<1m");
    expect(formatDuration(0)).toBe("<1m");
  });

  it("renders an em dash for an absent duration", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

const nowStripWorkflow = {
  project: "p",
  scope: "feature",
  depth: "practical",
  stateVersion: 7 as const,
  phase: "CONSTRUCTION" as const,
  currentStage: "code-generation",
  nextStage: "build-and-test",
  gate: null,
  stages: [],
  done: 18,
  total: 21,
};

describe("NowStrip timing fields", () => {
  it("shows elapsed and remaining, marking the estimate with ≈ and text", () => {
    render(
      <NowStrip
        state={{ kind: "success", value: nowStripWorkflow }}
        onRetry={() => {}}
        timings={payload}
      />,
    );
    expect(screen.getByTestId("now-elapsed").textContent).toBe("2h00m");
    const remaining = screen.getByTestId("now-remaining");
    expect(remaining.textContent).toContain("≈45m");
    expect(remaining.textContent).toContain("推定");
  });

  it("shows an em dash when no timing data has arrived", () => {
    render(
      <NowStrip
        state={{ kind: "success", value: nowStripWorkflow }}
        onRetry={() => {}}
        timings={null}
      />,
    );
    expect(screen.getByTestId("now-elapsed").textContent).toBe("—");
  });

  /**
   * Finding 2 (Codex PR #4 review): `workflow` and `timings` are two
   * independent fetches. When a change push advances the current stage,
   * `workflow` re-renders immediately while `timings` may still describe the
   * stage that was current a moment ago — the strip must not show that stale
   * stage's numbers under the new stage's name. Same guard as
   * status-bar.ts's refreshStatusBar.
   */
  it("shows an em dash for elapsed and remaining when timings still names the previous stage", () => {
    render(
      <NowStrip
        state={{
          kind: "success",
          value: { ...nowStripWorkflow, currentStage: "build-and-test" },
        }}
        onRetry={() => {}}
        timings={payload}
      />,
    );
    expect(screen.getByTestId("now-elapsed").textContent).toBe("—");
    expect(screen.getByTestId("now-remaining").textContent).toBe("—");
  });
});

const noop = (): void => {};

/**
 * A stage that has both a finished measured run (`timings`, `endedAt` set)
 * and a pending estimate (`remaining.pendingStages`) for the same slug —
 * exercises the "actuals win over estimates" precedence — plus a second
 * stage with an estimate only, to confirm the ≈/推定 markers still show up
 * when there is no actual to prefer.
 */
const stageRailTimings: TimingsPayload = {
  timings: [
    {
      stage: "code-generation",
      startedAt: "2026-07-25T05:41:30Z",
      endedAt: "2026-07-25T07:41:30Z",
      wallMs: 7_800_000,
      activeMs: 7_200_000,
      eventCount: 1201,
    },
  ],
  remaining: {
    currentStage: null,
    pendingStages: [
      {
        stage: "code-generation",
        estimateMs: 500_000,
        sampleCount: 1,
        basis: "stage",
      },
      {
        stage: "build-and-test",
        estimateMs: 960_000,
        sampleCount: 1,
        basis: "stage",
      },
    ],
    totalRemainingMs: 1_460_000,
    lowConfidence: false,
  },
};

describe("StageRail duration precedence (actual over estimate)", () => {
  it("shows the actual, with no ≈ and no 推定, for a stage measured AND pending", () => {
    render(
      <StageRail
        state={{ kind: "success", value: workflowFixture() }}
        onSelect={noop}
        onRetry={noop}
        timings={stageRailTimings}
      />,
    );
    const actual = screen.getByTestId("rail-duration-code-generation");
    expect(actual.textContent).toBe("2h00m");
    expect(actual.textContent).not.toContain("≈");
    expect(actual.textContent).not.toContain("推定");
  });

  it("shows the estimate with both the ≈ symbol and the 推定 text for a stage with no actual", () => {
    render(
      <StageRail
        state={{ kind: "success", value: workflowFixture() }}
        onSelect={noop}
        onRetry={noop}
        timings={stageRailTimings}
      />,
    );
    const estimate = screen.getByTestId("rail-duration-build-and-test");
    expect(estimate.textContent).toContain("≈16m");
    expect(estimate.textContent).toContain("推定");
  });

  it("renders no duration marker when timings has not arrived yet", () => {
    render(
      <StageRail
        state={{ kind: "success", value: workflowFixture() }}
        onSelect={noop}
        onRetry={noop}
      />,
    );
    expect(screen.queryByTestId("rail-duration-code-generation")).toBeNull();
  });
});

/**
 * Finding 2 (Codex PR #4 review): re-entering a stage emits a new
 * STAGE_STARTED, so `timings` carries both the earlier attempt's closed run
 * (2h00m, matching `stageRailTimings` above so the contrast is obvious) and
 * a new open run for the current attempt. Openness must be read from the
 * timings data itself (an open run for this slug exists here), not inferred
 * from `StageInfo.status` — the two tests below exercise this against both
 * "in-progress" and "awaiting-approval", because STAGE_COMPLETED fires only
 * after GATE_APPROVED, so a stage sitting at "awaiting-approval" still has
 * an open run too. Either way the closed run must not render as this run's
 * actual.
 */
const reEntryTimings: TimingsPayload = {
  timings: [
    {
      stage: "code-generation",
      startedAt: "2026-07-24T05:41:30Z",
      endedAt: "2026-07-24T07:41:30Z",
      wallMs: 7_200_000,
      activeMs: 7_200_000,
      eventCount: 1201,
    },
    {
      stage: "code-generation",
      startedAt: "2026-07-25T05:41:30Z",
      endedAt: null,
      wallMs: 300_000,
      activeMs: 300_000,
      eventCount: 5,
    },
  ],
  remaining: {
    currentStage: { stage: "code-generation", elapsedActiveMs: 300_000, remainingMs: 300_000 },
    pendingStages: [
      { stage: "code-generation", estimateMs: 300_000, sampleCount: 1, basis: "stage" },
    ],
    totalRemainingMs: 300_000,
    lowConfidence: false,
  },
};

describe("StageRail duration precedence — re-entry", () => {
  it("does not show a previous attempt's closed-run duration as the actual while the stage is in-progress again", () => {
    render(
      <StageRail
        state={{
          kind: "success",
          value: workflowFixture({ stages: [stage("code-generation", { status: "in-progress" })] }),
        }}
        onSelect={noop}
        onRetry={noop}
        timings={reEntryTimings}
      />,
    );
    const row = screen.getByTestId("rail-duration-code-generation");
    expect(row.textContent).not.toBe("2h00m");
    expect(row.textContent).toContain("≈5m");
    expect(row.textContent).toContain("推定");
  });

  /**
   * Same closed+open pair, but the row's status is "awaiting-approval" — the
   * gate is open, work already re-finished, STAGE_COMPLETED not yet fired.
   * A status-based allowlist that trusted "awaiting-approval" as finished
   * would render the stale 2h00m here; deriving openness from the data
   * itself must not.
   */
  it("does not show a previous attempt's closed-run duration as the actual while the stage is awaiting-approval again", () => {
    render(
      <StageRail
        state={{
          kind: "success",
          value: workflowFixture({
            stages: [stage("code-generation", { status: "awaiting-approval" })],
          }),
        }}
        onSelect={noop}
        onRetry={noop}
        timings={reEntryTimings}
      />,
    );
    const row = screen.getByTestId("rail-duration-code-generation");
    expect(row.textContent).not.toBe("2h00m");
    expect(row.textContent).toContain("≈5m");
    expect(row.textContent).toContain("推定");
  });
});

/**
 * Finding 3 (Codex round 9 review): a backward jump resets a downstream
 * completed stage's status back to `not-started` (checkboxes un-ticked) while
 * its old closed run stays in the audit log untouched. `runningStages`/
 * `actualByStage` above excluded a stage's closed run only when it ALSO had
 * an open run — a reset stage has neither, so the pre-jump closed run
 * (`stageRailTimings`, 2h00m) rendered as if it were the current attempt's
 * actual instead of the rerun estimate it should show.
 */
describe("StageRail duration precedence — reset stage (Codex round 9 finding 3)", () => {
  it("shows the rerun estimate, not the pre-jump closed run, for a stage reset to not-started", () => {
    render(
      <StageRail
        state={{
          kind: "success",
          value: workflowFixture({
            stages: [stage("code-generation", { status: "not-started" })],
          }),
        }}
        onSelect={noop}
        onRetry={noop}
        timings={stageRailTimings}
      />,
    );
    const row = screen.getByTestId("rail-duration-code-generation");
    expect(row.textContent).not.toBe("2h00m");
    expect(row.textContent).toContain("≈8m");
    expect(row.textContent).toContain("推定");
  });
});

/**
 * Codex round 12, finding 1: `remaining.pendingStages` deliberately never
 * contains the current stage (it's represented by `remaining.currentStage`
 * instead). When the current stage hasn't started yet, `remainingMs` there is
 * a full estimate exactly like a pendingStages entry and must render with the
 * same ≈/推定 markers. When the current stage IS running, `remainingMs` is
 * only a partial remainder — rendering that next to other rows' full
 * durations would be misleading, so a running current row stays blank,
 * unchanged from today.
 */
const unstartedCurrentTimings: TimingsPayload = {
  timings: [],
  remaining: {
    currentStage: { stage: "build-and-test", elapsedActiveMs: null, remainingMs: 960_000 },
    pendingStages: [],
    totalRemainingMs: 960_000,
    lowConfidence: false,
  },
};

const runningCurrentTimings: TimingsPayload = {
  timings: [
    {
      stage: "build-and-test",
      startedAt: "2026-07-25T05:41:30Z",
      endedAt: null,
      wallMs: 300_000,
      activeMs: 300_000,
      eventCount: 3,
    },
  ],
  remaining: {
    currentStage: { stage: "build-and-test", elapsedActiveMs: 300_000, remainingMs: 660_000 },
    pendingStages: [],
    totalRemainingMs: 660_000,
    lowConfidence: false,
  },
};

describe("StageRail duration — unstarted current stage (Codex round 12, finding 1)", () => {
  it("shows the estimate with ≈ and 推定 for an unstarted current stage", () => {
    render(
      <StageRail
        state={{
          kind: "success",
          value: workflowFixture({ currentStage: "build-and-test" }),
        }}
        onSelect={noop}
        onRetry={noop}
        timings={unstartedCurrentTimings}
      />,
    );
    const row = screen.getByTestId("rail-duration-build-and-test");
    expect(row.textContent).toContain("≈16m");
    expect(row.textContent).toContain("推定");
  });

  it("renders no duration for a running current stage (unchanged behavior)", () => {
    render(
      <StageRail
        state={{
          kind: "success",
          value: workflowFixture({
            currentStage: "build-and-test",
            stages: [
              stage("code-generation", { status: "completed" }),
              stage("build-and-test", { status: "in-progress" }),
            ],
          }),
        }}
        onSelect={noop}
        onRetry={noop}
        timings={runningCurrentTimings}
      />,
    );
    expect(screen.queryByTestId("rail-duration-build-and-test")).toBeNull();
  });
});

/**
 * Codex round 13, finding 3: `estimateByStage` used to keep only
 * `estimateMs`, discarding `basis`/`sampleCount` — a fallback estimate
 * (phase/global median, or a single sample) rendered identically to one
 * measured from the stage's own, better-attested history. NowStrip's
 * fixture stage list only carries "build-and-test" as a pending row, so
 * these tests supply their own two-pending-stage workflow.
 */
const lowConfidenceRailWorkflow = workflowFixture({
  currentStage: null,
  stages: [
    stage("code-generation", { status: "completed" }),
    stage("build-and-test", { status: "not-started" }),
    stage("ci-pipeline", { status: "not-started" }),
  ],
});

const lowConfidenceRailTimings: TimingsPayload = {
  timings: [],
  remaining: {
    currentStage: null,
    pendingStages: [
      // Fell back to the phase median — low confidence.
      { stage: "build-and-test", estimateMs: 960_000, sampleCount: 1, basis: "phase" },
      // Its own history, two-plus samples — solid.
      { stage: "ci-pipeline", estimateMs: 500_000, sampleCount: 2, basis: "stage" },
    ],
    totalRemainingMs: 1_460_000,
    lowConfidence: true,
  },
};

describe("StageRail low-confidence indicator (Codex round 13, finding 3)", () => {
  it("shows the low-confidence marker for a row whose estimate fell back to the phase median", () => {
    render(
      <StageRail
        state={{ kind: "success", value: lowConfidenceRailWorkflow }}
        onSelect={noop}
        onRetry={noop}
        timings={lowConfidenceRailTimings}
      />,
    );
    const row = screen.getByTestId("rail-duration-build-and-test");
    expect(row.textContent).toContain("≈16m");
    expect(row.textContent).toContain("推定");
    expect(row.textContent).toContain("（参考値）");
  });

  it("shows the low-confidence marker for a row with only a single sample, even on its own history", () => {
    const singleSampleTimings: TimingsPayload = {
      ...lowConfidenceRailTimings,
      remaining: {
        ...lowConfidenceRailTimings.remaining,
        pendingStages: [
          { stage: "build-and-test", estimateMs: 960_000, sampleCount: 1, basis: "stage" },
          { stage: "ci-pipeline", estimateMs: 500_000, sampleCount: 2, basis: "stage" },
        ],
      },
    };
    render(
      <StageRail
        state={{ kind: "success", value: lowConfidenceRailWorkflow }}
        onSelect={noop}
        onRetry={noop}
        timings={singleSampleTimings}
      />,
    );
    expect(screen.getByTestId("rail-duration-build-and-test").textContent).toContain("（参考値）");
  });

  it("does not show the low-confidence marker for a row estimated from its own history with two-plus samples", () => {
    render(
      <StageRail
        state={{ kind: "success", value: lowConfidenceRailWorkflow }}
        onSelect={noop}
        onRetry={noop}
        timings={lowConfidenceRailTimings}
      />,
    );
    const row = screen.getByTestId("rail-duration-ci-pipeline");
    expect(row.textContent).toContain("≈8m");
    expect(row.textContent).toContain("推定");
    expect(row.textContent).not.toContain("（参考値）");
  });
});

describe("Header total remaining", () => {
  it("shows the total as a work amount, never a completion time", () => {
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflowFixture() } }}>
        <Header timings={payload} workflow={workflowFixture()} />
      </StoreProvider>,
    );
    const total = screen.getByTestId("header-total-remaining");
    expect(total.textContent).toContain("残り実作業 ≈1h01m");
    expect(total.textContent).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("renders nothing when the total cannot be estimated", () => {
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflowFixture() } }}>
        <Header
          timings={{ ...payload, remaining: { ...payload.remaining, totalRemainingMs: null } }}
          workflow={workflowFixture()}
        />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("header-total-remaining")).toBeNull();
  });

  /**
   * Finding 2 (Codex PR #4 review): `workflow` and `timings` are two
   * independent fetches. A change push can advance `workflow.currentStage`
   * before `/api/timings` catches up, so `payload.remaining.currentStage`
   * still names the stage that just finished — `totalRemainingMs` in that
   * snapshot still includes that stage's remainder. Suppress the total until
   * the two agree again, the same guard NowStrip uses for its own fields.
   */
  it("shows no total while timings still names the previous stage, and shows it again once they match", () => {
    const { rerender } = render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflowFixture() } }}>
        <Header timings={payload} workflow={workflowFixture({ currentStage: "build-and-test" })} />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("header-total-remaining")).toBeNull();

    rerender(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflowFixture() } }}>
        <Header timings={payload} workflow={workflowFixture()} />
      </StoreProvider>,
    );
    expect(screen.getByTestId("header-total-remaining")).toBeDefined();
  });
});

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

  /**
   * Finding 4 (whole-branch review 2026-07-27): `reloading` resets workflow /
   * matrix / intents but not timings, so a manual retry after an outage left
   * durations stale. This does not exercise refetchAll's own parallel three
   * (that stays pinned to workflow/matrix/intents, see the ADR-03 describe
   * block above) — the retry path fires a separate timings fetch alongside it.
   */
  it("a manual retry after an outage also refreshes timings", async () => {
    const { fetchMock } = stubAppApi();
    render(
      <App
        bootstrap={Promise.resolve({ error: true as const, reason: "server-unreachable" as const })}
      />,
    );

    await waitFor(() => {
      expect(timingsCallCount(fetchMock)).toBe(1); // initial mount fetch
    });

    const retryButtons = await screen.findAllByTestId("retry");
    fetchMock.mockClear();
    await userEvent.click(retryButtons[0] as HTMLElement);

    await waitFor(() => {
      expect(timingsCallCount(fetchMock)).toBe(1);
    });
  });
});

/**
 * Finding 3 (Codex round 2 review): the effect above only re-runs on a change
 * push (`lastChangeAt`). A long, silent generation emits none, so it never
 * re-fires and `activeMs` freezes at the mount-time value for the whole
 * interval — exactly the case the timing feature exists to surface. Isolated
 * in its own describe block with fake timers installed for the whole test
 * (not switched on mid-test) because RTL's `waitFor` polls via a real
 * `setTimeout` that fake timers would otherwise starve — every wait here goes
 * through `vi.advanceTimersByTimeAsync` instead, which also flushes the
 * pending fetch/dispatch microtasks.
 */
describe("timings refresh effect — open-run polling (App.tsx, finding 3)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("polls /api/timings on a 30s interval while a run is open, and stops once it closes", async () => {
    vi.useFakeTimers();
    const { fetchMock } = stubAppApi(); // /api/timings responds with `payload`, an open run

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1); // mount fetch

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(2); // the run is still open — polled again

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(3);

    // The stage finishes: the next poll's response reports the run closed.
    const closedPayload: TimingsPayload = {
      ...payload,
      timings: [
        {
          ...(payload.timings[0] as TimingsPayload["timings"][0]),
          endedAt: "2026-07-25T08:00:00Z",
        },
      ],
    };
    fetchMock.mockImplementation(async (input: string) => {
      if (input.includes("/api/timings"))
        return new Response(JSON.stringify({ ok: true, value: closedPayload }));
      if (input.includes("/api/matrix"))
        return new Response(JSON.stringify({ ok: true, value: matrix() }));
      if (input.includes("/api/links"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      if (input.includes("/api/guides"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      return new Response(JSON.stringify(workflowPayload()));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(4); // this poll is the one that discovers the close

    // No open run left: further elapsed time must not produce more polls.
    fetchMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(0);
  });
});

/**
 * Codex PR #4 finding 1: the open-run poll used to derive `hasOpenRun`
 * straight from the latest `/api/timings` view state. A single failed poll
 * (server restart, momentarily unreadable state file) flips that view state
 * to `error`, `viewValue` returns `null` for it, `hasOpenRun` goes `false`,
 * and the interval is cleared — permanently, since nothing but this same
 * interval would ever fire another request. That is exactly the
 * silent-generation window the poll exists to survive. The fix makes
 * `hasOpenRun` sticky: only a successful/partial payload may change it,
 * in either direction.
 */
describe("timings refresh effect — polling survives errors (App.tsx, finding 1)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps polling after a poll returns an error", async () => {
    vi.useFakeTimers();
    const { fetchMock } = stubAppApi(); // /api/timings responds with `payload`, an open run

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1); // mount fetch establishes the open run

    // Every subsequent /api/timings call fails from here on.
    fetchMock.mockImplementation(async (input: string) => {
      if (input.includes("/api/timings"))
        return new Response(JSON.stringify({ error: true, reason: "server-unreachable" }));
      if (input.includes("/api/matrix"))
        return new Response(JSON.stringify({ ok: true, value: matrix() }));
      if (input.includes("/api/links"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      if (input.includes("/api/guides"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      return new Response(JSON.stringify(workflowPayload()));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(2); // the poll that fails

    // The interval must not have been cleared by that failure: it fires again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(3);
  });

  /**
   * Finding 2 (Codex round 9 review): the sticky fix above only preserves a
   * PREVIOUSLY DISCOVERED open run across later errors — `hasOpenRun` still
   * starts `false`, and nothing ever sets it if the very first request fails.
   * The workflow fixture (`workflowPayload()`) names a non-null
   * `currentStage`, so the pre-first-success fallback must keep polling on
   * the same cadence even though `/api/timings` has never once succeeded.
   */
  it("retries on the same cadence when the very first request fails while the workflow is active", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/api/timings"))
        return new Response(JSON.stringify({ error: true, reason: "server-unreachable" }));
      if (input.includes("/api/matrix"))
        return new Response(JSON.stringify({ ok: true, value: matrix() }));
      if (input.includes("/api/links"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      if (input.includes("/api/guides"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      return new Response(JSON.stringify(workflowPayload()));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("WebSocket", FakeWebSocket);

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1); // the mount fetch, which fails

    // No success has ever landed, but the workflow names a current stage —
    // must retry, not go silent forever.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(3);

    // The next poll finally succeeds and reports no open run — must still
    // stop polling for good, exactly like the plain sticky case.
    fetchMock.mockImplementation(async (input: string) => {
      if (input.includes("/api/timings"))
        return new Response(JSON.stringify({ ok: true, value: { ...payload, timings: [] } }));
      if (input.includes("/api/matrix"))
        return new Response(JSON.stringify({ ok: true, value: matrix() }));
      if (input.includes("/api/links"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      if (input.includes("/api/guides"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      return new Response(JSON.stringify(workflowPayload()));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(4); // the poll that finally succeeds

    fetchMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(0);
  });

  it("still stops for good once a successful payload reports no open run, even after an earlier error", async () => {
    vi.useFakeTimers();
    const { fetchMock } = stubAppApi(); // /api/timings responds with `payload`, an open run

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1);

    // One poll errors...
    fetchMock.mockImplementation(async (input: string) => {
      if (input.includes("/api/timings"))
        return new Response(JSON.stringify({ error: true, reason: "server-unreachable" }));
      if (input.includes("/api/matrix"))
        return new Response(JSON.stringify({ ok: true, value: matrix() }));
      if (input.includes("/api/links"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      if (input.includes("/api/guides"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      return new Response(JSON.stringify(workflowPayload()));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(2);

    // ...then the next poll succeeds and reports the run closed.
    const closedPayload: TimingsPayload = {
      ...payload,
      timings: [
        {
          ...(payload.timings[0] as TimingsPayload["timings"][0]),
          endedAt: "2026-07-25T08:00:00Z",
        },
      ],
    };
    fetchMock.mockImplementation(async (input: string) => {
      if (input.includes("/api/timings"))
        return new Response(JSON.stringify({ ok: true, value: closedPayload }));
      if (input.includes("/api/matrix"))
        return new Response(JSON.stringify({ ok: true, value: matrix() }));
      if (input.includes("/api/links"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      if (input.includes("/api/guides"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      return new Response(JSON.stringify(workflowPayload()));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(3); // the poll that discovers the close

    // No open run left: further elapsed time must not produce more polls.
    fetchMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(0);
  });

  /**
   * Codex round 12, finding 2: the sticky fix above (and the pre-first-success
   * fallback) only cover the window before the FIRST success. Once a payload
   * has already reported the workflow idle (`hasEverSucceeded` true,
   * `hasOpenRun` false), polling is off. If a newly-started stage then goes
   * straight into silent generation, the request that would have discovered
   * it can itself fail — and since nothing but a successful/partial payload
   * ever touches `hasOpenRun`/`hasEverSucceeded`, that failure alone must
   * still be enough to resume polling.
   */
  it("resumes polling after a failed request following a prior idle success, and stops once a request succeeds idle again", async () => {
    vi.useFakeTimers();
    const idlePayload: TimingsPayload = { ...payload, timings: [] };
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/api/timings"))
        return new Response(JSON.stringify({ ok: true, value: idlePayload }));
      if (input.includes("/api/matrix"))
        return new Response(JSON.stringify({ ok: true, value: matrix() }));
      if (input.includes("/api/links"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      if (input.includes("/api/guides"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      return new Response(JSON.stringify(workflowPayload()));
    });
    vi.stubGlobal("fetch", fetchMock);
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1); // mount: idle, no open run

    // Idle: no poll interval should be running yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(1);

    // A new stage starts and goes into silent generation. The change push
    // fires a timings request (independent of polling), and it fails.
    fetchMock.mockImplementation(async (input: string) => {
      if (input.includes("/api/timings"))
        return new Response(JSON.stringify({ error: true, reason: "server-unreachable" }));
      if (input.includes("/api/matrix"))
        return new Response(JSON.stringify({ ok: true, value: matrix() }));
      if (input.includes("/api/links"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      if (input.includes("/api/guides"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      return new Response(JSON.stringify(workflowPayload()));
    });
    const sockets = FakeWebSocket.instances;
    await act(async () => {
      sockets[0]?.onmessage?.({
        data: JSON.stringify({ type: "change", scope: "audit", events: [] }),
      } as MessageEvent);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(2); // the failed request

    // Polling must resume from here: 30s later, another request fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(3);

    // That poll succeeds and reports idle again — must stop for good.
    fetchMock.mockImplementation(async (input: string) => {
      if (input.includes("/api/timings"))
        return new Response(JSON.stringify({ ok: true, value: idlePayload }));
      if (input.includes("/api/matrix"))
        return new Response(JSON.stringify({ ok: true, value: matrix() }));
      if (input.includes("/api/links"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      if (input.includes("/api/guides"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      return new Response(JSON.stringify(workflowPayload()));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(4);

    fetchMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(0);
  });
});

/**
 * Codex round 13, finding 2: `/api/timings` can succeed *with* warnings (an
 * unreadable audit shard, a malformed timestamp, an intent skipped during
 * the space sweep). The reducer keeps those as a `partial` view state with
 * `notes`, but every consumer unwrapped via `viewValue()`, which drops
 * `notes` — so the dashboard rendered missing/partial estimates with no
 * indication anything degraded. NowStrip is the chosen surface (it already
 * renders workflow-partial notes through `UnparseableBadge`, and it's the
 * one place elapsed/remaining render right next to an explanation of why
 * they might look off) — Header and StageRail are left unchanged.
 */
describe("timing notes surface on NowStrip (Codex round 13, finding 2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the /api/timings warning as a note when the payload is partial", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/api/timings"))
        return new Response(
          JSON.stringify({
            ok: true,
            value: payload,
            warnings: ["audit shard unreadable: 2026-07-20.jsonl"],
          }),
        );
      if (input.includes("/api/matrix"))
        return new Response(JSON.stringify({ ok: true, value: matrix() }));
      if (input.includes("/api/links"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      if (input.includes("/api/guides"))
        return new Response(JSON.stringify({ ok: true, value: [] }));
      return new Response(JSON.stringify(workflowPayload()));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("WebSocket", FakeWebSocket);

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);

    expect(await screen.findByText(/audit shard unreadable: 2026-07-20\.jsonl/)).toBeDefined();
  });

  it("renders no timing note when the /api/timings payload is a plain success", async () => {
    const { fetchMock } = stubAppApi(); // /api/timings responds with `payload`, no warnings
    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);

    await waitFor(() => {
      expect(timingsCallCount(fetchMock)).toBe(1);
    });
    expect(screen.queryByText(/解析不可/)).toBeNull();
  });
});
