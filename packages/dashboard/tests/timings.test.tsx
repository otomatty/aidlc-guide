import type { ReadResult, TimingsPayload } from "@aidlc-guide/shared-types";
import { formatDuration } from "@aidlc-guide/shared-types";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App.tsx";
import { Header } from "../src/components/Header.tsx";
import { NowStrip } from "../src/components/NowStrip.tsx";
import { StageRail } from "../src/components/StageRail.tsx";
import { refetchAll } from "../src/services/api.ts";
import { StoreProvider } from "../src/store/context.tsx";
import type { Action } from "../src/store/reducer.ts";
import { reducer } from "../src/store/reducer.ts";
import { initialState } from "../src/store/state.ts";
import {
  matrix,
  run,
  stage,
  stageView,
  workflow as workflowFixture,
  payload as workflowPayload,
} from "./fixtures.ts";

/**
 * Issue #9: `/api/timings` now ships one reconciled {@link StageView} per
 * stage, and the dashboard reads it. Which run belongs to which attempt —
 * backward jumps, skips, the `none` sentinel, an `awaiting-approval` stage
 * that still has an open run — is decided once in reader-core and pinned in
 * `reader-core/tests/timing-stage-view.test.ts`. The fixtures below therefore
 * state the view directly; what these tests verify is that each surface
 * renders it faithfully, which is the half that used to be re-derived here
 * (and got it wrong differently from the estimator — PR #4 finding R9).
 */

const openRun = run("code-generation", 7_200_000);

const payload: TimingsPayload = {
  timings: [openRun],
  currentStage: "code-generation",
  stageViews: [
    stageView("code-generation", {
      status: "in-progress",
      isCurrent: true,
      running: true,
      currentAttempt: openRun,
      elapsedActiveMs: 7_200_000,
      estimateMs: 9_900_000,
      sampleCount: 2,
      basis: "stage",
      remainingMs: 2_700_000,
    }),
    stageView("build-and-test", {
      estimateMs: 960_000,
      sampleCount: 1,
      basis: "stage",
      remainingMs: 960_000,
    }),
  ],
  remaining: { totalRemainingMs: 3_660_000, lowConfidence: true },
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
  stateVersion: 8 as const,
  phase: "CONSTRUCTION" as const,
  currentStage: "code-generation",
  nextStage: "build-and-test",
  gate: null,
  stages: [],
  done: 18,
  total: 21,
};

/**
 * The strip takes the current stage's view already gated on freshness — the
 * gate itself is `selectCurrentTiming` and is pinned in
 * `select-timing.test.ts` (issue #10). What is checked here is that the strip
 * renders the value it is handed, and renders an em dash when handed `null`
 * (no payload yet, no current stage, or a stale payload — the strip does not
 * care which).
 */
const currentView = payload.stageViews[0] as (typeof payload.stageViews)[number];

describe("NowStrip timing fields", () => {
  it("shows elapsed and remaining, marking the estimate with ≈ and text", () => {
    render(
      <NowStrip
        state={{ kind: "success", value: nowStripWorkflow }}
        onRetry={() => {}}
        current={currentView}
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
        current={null}
      />,
    );
    expect(screen.getByTestId("now-elapsed").textContent).toBe("—");
  });

  it("shows an em dash for elapsed and remaining when the gate withheld the view", () => {
    render(
      <NowStrip
        state={{
          kind: "success",
          value: { ...nowStripWorkflow, currentStage: "build-and-test" },
        }}
        onRetry={() => {}}
        current={null}
      />,
    );
    expect(screen.getByTestId("now-elapsed").textContent).toBe("—");
    expect(screen.getByTestId("now-remaining").textContent).toBe("—");
  });
});

const noop = (): void => {};

/**
 * A stage whose current attempt has already closed carries a measured
 * `actualActiveMs`; one that has only an estimate carries `estimateMs`. The
 * rail prefers the measurement — a measured run is not a guess.
 */
const stageRailTimings: TimingsPayload = {
  timings: [run("code-generation", 7_200_000, "2026-07-25T07:41:30Z")],
  currentStage: "code-generation",
  stageViews: [
    stageView("code-generation", {
      status: "awaiting-approval",
      isCurrent: true,
      currentAttempt: run("code-generation", 7_200_000, "2026-07-25T07:41:30Z"),
      actualActiveMs: 7_200_000,
      elapsedActiveMs: 7_200_000,
      estimateMs: 500_000,
      sampleCount: 1,
      basis: "stage",
      remainingMs: 0,
    }),
    stageView("build-and-test", {
      estimateMs: 960_000,
      sampleCount: 1,
      basis: "stage",
      remainingMs: 960_000,
    }),
  ],
  remaining: { totalRemainingMs: 960_000, lowConfidence: true },
};

describe("StageRail duration precedence (actual over estimate)", () => {
  it("shows the actual, with no ≈ and no 推定, for a stage whose attempt has finished", () => {
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

  it("renders no duration for a stage the payload has no view for", () => {
    render(
      <StageRail
        state={{ kind: "success", value: workflowFixture() }}
        onSelect={noop}
        onRetry={noop}
        timings={{ ...stageRailTimings, stageViews: [] }}
      />,
    );
    expect(screen.queryByTestId("rail-duration-code-generation")).toBeNull();
  });
});

/**
 * The rail's column means "how long this stage takes" in every row, so a run
 * still in flight renders the stage's expected duration — never the earlier
 * attempt's measurement, and never the *remainder* of the estimate, which is
 * a different number and belongs where it is labelled as such (NowStrip's 残り
 * and the header total).
 *
 * Re-entry (a rejected gate, a re-run) and a backward jump both produce a view
 * with `actualActiveMs: null` and the earlier run parked in `history`. The
 * rail used to have to work that out for itself from the raw run list and
 * `StageInfo.status`, and got it wrong in a way the estimator did not (Codex
 * round 9, finding 3) — that reconciliation now happens once upstream, so
 * what is left to check here is that the estimate is what renders.
 */
const inFlightTimings: TimingsPayload = {
  timings: [
    run("code-generation", 7_200_000, "2026-07-24T07:41:30Z"),
    run("code-generation", 300_000),
  ],
  currentStage: "code-generation",
  stageViews: [
    stageView("code-generation", {
      status: "in-progress",
      isCurrent: true,
      running: true,
      currentAttempt: run("code-generation", 300_000),
      history: [run("code-generation", 7_200_000, "2026-07-24T07:41:30Z")],
      elapsedActiveMs: 300_000,
      estimateMs: 500_000,
      sampleCount: 1,
      basis: "stage",
      remainingMs: 200_000,
    }),
  ],
  remaining: { totalRemainingMs: 200_000, lowConfidence: true },
};

describe("StageRail duration — attempt in flight", () => {
  it("shows the stage's full estimate, not the earlier attempt's measurement and not the remainder", () => {
    render(
      <StageRail
        state={{
          kind: "success",
          value: workflowFixture({ stages: [stage("code-generation", { status: "in-progress" })] }),
        }}
        onSelect={noop}
        onRetry={noop}
        timings={inFlightTimings}
      />,
    );
    const row = screen.getByTestId("rail-duration-code-generation");
    expect(row.textContent).not.toContain("2h00m"); // the previous attempt
    expect(row.textContent).not.toContain("3m"); // the remainder (200_000ms)
    expect(row.textContent).toContain("≈8m");
    expect(row.textContent).toContain("推定");
  });

  it("shows the estimate for a stage reset by a backward jump, not its pre-jump run", () => {
    const resetTimings: TimingsPayload = {
      ...inFlightTimings,
      stageViews: [
        stageView("code-generation", {
          status: "not-started",
          isCurrent: true,
          history: [run("code-generation", 7_200_000, "2026-07-24T07:41:30Z")],
          estimateMs: 500_000,
          sampleCount: 1,
          basis: "stage",
          remainingMs: 500_000,
        }),
      ],
    };
    render(
      <StageRail
        state={{
          kind: "success",
          value: workflowFixture({ stages: [stage("code-generation", { status: "not-started" })] }),
        }}
        onSelect={noop}
        onRetry={noop}
        timings={resetTimings}
      />,
    );
    const row = screen.getByTestId("rail-duration-code-generation");
    expect(row.textContent).not.toContain("2h00m");
    expect(row.textContent).toContain("≈8m");
    expect(row.textContent).toContain("推定");
  });

  /**
   * Codex review on PR #15: `workflow` and `timings` are two independent
   * fetches, so a backward jump lands in `workflow.stages` before the timings
   * response catches up — for that window the payload still reports the
   * pre-jump run as this stage's finished attempt. A measurement renders with
   * no ≈ and no 推定, i.e. as fact, so it must not outlive the state it was
   * reconciled against; the estimate does not depend on `status` and stands.
   */
  it("suppresses a measurement whose view predates the row's current status, keeping the estimate", () => {
    const staleTimings: TimingsPayload = {
      ...inFlightTimings,
      stageViews: [
        stageView("code-generation", {
          status: "completed", // the pre-jump snapshot
          isCurrent: true,
          currentAttempt: run("code-generation", 7_200_000, "2026-07-24T07:41:30Z"),
          actualActiveMs: 7_200_000,
          elapsedActiveMs: 7_200_000,
          estimateMs: 500_000,
          sampleCount: 1,
          basis: "stage",
          remainingMs: 0,
        }),
      ],
    };
    render(
      <StageRail
        state={{
          kind: "success",
          // The jump has already landed here: the row reads `not-started`.
          value: workflowFixture({ stages: [stage("code-generation", { status: "not-started" })] }),
        }}
        onSelect={noop}
        onRetry={noop}
        timings={staleTimings}
      />,
    );
    const row = screen.getByTestId("rail-duration-code-generation");
    expect(row.textContent).not.toContain("2h00m");
    expect(row.textContent).toContain("≈8m");
    expect(row.textContent).toContain("推定");
  });
});

/**
 * Codex round 13, finding 3: a row used to render `estimateMs` alone, so a
 * fallback estimate (phase/global median, or a single sample) was
 * indistinguishable from one measured against the stage's own, better-attested
 * history. Confidence rides on the view itself, read through the app's single
 * `isLowConfidenceEstimate` predicate — including on the current stage's row,
 * which used to be hard-coded to high confidence for want of the metadata.
 */
const lowConfidenceRailWorkflow = workflowFixture({
  currentStage: "code-generation",
  stages: [
    stage("code-generation", { status: "in-progress" }),
    stage("build-and-test", { status: "not-started" }),
    stage("ci-pipeline", { status: "not-started" }),
  ],
});

const lowConfidenceRailTimings: TimingsPayload = {
  timings: [],
  currentStage: "code-generation",
  stageViews: [
    // The current stage, resting on a phase-median fallback — low confidence.
    stageView("code-generation", {
      status: "in-progress",
      isCurrent: true,
      estimateMs: 960_000,
      sampleCount: 1,
      basis: "phase",
      remainingMs: 960_000,
    }),
    // Its own history, but a single run — still low confidence.
    stageView("build-and-test", {
      estimateMs: 960_000,
      sampleCount: 1,
      basis: "stage",
      remainingMs: 960_000,
    }),
    // Its own history, two-plus runs — solid.
    stageView("ci-pipeline", {
      estimateMs: 500_000,
      sampleCount: 2,
      basis: "stage",
      remainingMs: 500_000,
    }),
  ],
  remaining: { totalRemainingMs: 2_420_000, lowConfidence: true },
};

describe("StageRail low-confidence indicator (Codex round 13, finding 3)", () => {
  it("marks a current-stage row whose estimate fell back to the phase median", () => {
    render(
      <StageRail
        state={{ kind: "success", value: lowConfidenceRailWorkflow }}
        onSelect={noop}
        onRetry={noop}
        timings={lowConfidenceRailTimings}
      />,
    );
    const row = screen.getByTestId("rail-duration-code-generation");
    expect(row.textContent).toContain("≈16m");
    expect(row.textContent).toContain("推定");
    expect(row.textContent).toContain("（参考値）");
  });

  it("marks a row with only a single sample, even on its own history", () => {
    render(
      <StageRail
        state={{ kind: "success", value: lowConfidenceRailWorkflow }}
        onSelect={noop}
        onRetry={noop}
        timings={lowConfidenceRailTimings}
      />,
    );
    expect(screen.getByTestId("rail-duration-build-and-test").textContent).toContain("（参考値）");
  });

  it("does not mark a row estimated from its own history with two-plus samples", () => {
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

/**
 * Like NowStrip, the header takes a pre-gated value: `selectCurrentTiming`
 * hands it the roll-up only while the payload still describes the stage on
 * screen (a total computed against the previous stage still bills that
 * stage's remainder). The gate is pinned in `select-timing.test.ts`; what is
 * checked here is the rendering.
 */
describe("Header total remaining", () => {
  it("shows the total as a work amount, never a completion time", () => {
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflowFixture() } }}>
        <Header remaining={payload.remaining} />
      </StoreProvider>,
    );
    const total = screen.getByTestId("header-total-remaining");
    expect(total.textContent).toContain("残り実作業 ≈1h01m");
    expect(total.textContent).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("renders nothing when the total cannot be estimated", () => {
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflowFixture() } }}>
        <Header remaining={{ ...payload.remaining, totalRemainingMs: null }} />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("header-total-remaining")).toBeNull();
  });

  it("renders nothing when the gate withheld the roll-up", () => {
    render(
      <StoreProvider preloaded={{ workflow: { kind: "success", value: workflowFixture() } }}>
        <Header remaining={null} />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("header-total-remaining")).toBeNull();
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

/** Everything but `/api/timings`, which each caller answers for itself. */
async function otherRoutes(input: string): Promise<Response> {
  if (input.includes("/api/matrix"))
    return new Response(JSON.stringify({ ok: true, value: matrix() }));
  if (input.includes("/api/links")) return new Response(JSON.stringify({ ok: true, value: [] }));
  if (input.includes("/api/guides")) return new Response(JSON.stringify({ ok: true, value: [] }));
  return new Response(JSON.stringify(workflowPayload()));
}

/** Drop-in `fetch` implementation where only `/api/timings` fails. */
async function timingsFails(input: string): Promise<Response> {
  if (input.includes("/api/timings"))
    return new Response(JSON.stringify({ error: true, reason: "server-unreachable" }));
  return await otherRoutes(input);
}

function stubAppApi(timings: TimingsPayload = payload): {
  fetchMock: ReturnType<typeof vi.fn>;
  sockets: FakeWebSocket[];
} {
  const fetchMock = vi.fn(async (input: string) => {
    if (input.includes("/api/timings"))
      return new Response(JSON.stringify({ ok: true, value: timings }));
    return await otherRoutes(input);
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
 * Issue #10: the interval used to fire only "while a run is open", guarded by
 * a sticky `hasOpenRun` / `hasEverSucceeded` / retry-disjunction state machine
 * that three rounds of PR #4 review could not make leak-proof — a failed
 * request stopped polling for good (R6), a failed *first* request never
 * started it (R9), and a run beginning after an idle stretch was never
 * discovered when its request failed (R12). The condition saved one 90ms
 * localhost request per 30s. It is gone: while the dashboard is on screen the
 * interval runs, full stop, and the tests below are the whole contract.
 *
 * Fake timers are installed for the whole block (not switched on mid-test)
 * because RTL's `waitFor` polls via a real `setTimeout` that fake timers would
 * otherwise starve — every wait goes through `vi.advanceTimersByTimeAsync`,
 * which also flushes the pending fetch/dispatch microtasks.
 */
describe("timings poll (App.tsx, issue #10)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("polls /api/timings every 30s while displayed, with no open run to justify it", async () => {
    vi.useFakeTimers();
    // An idle payload: no open run, and the old state machine's reason to
    // stop. The interval must keep running anyway — a stage can start at any
    // moment and go straight into a silent generation that emits no push.
    const idlePayload: TimingsPayload = { ...payload, timings: [] };
    const { fetchMock } = stubAppApi(idlePayload);

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1); // mount fetch

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(5); // three more ticks, still idle
  });

  /**
   * The three bugs the state machine bought, as one test: polling has to
   * survive a failed poll (R6), a failed *first* request (R9), and a failure
   * that lands after an earlier success reported the workflow idle (R12).
   * With the condition removed none of these are special cases — which is the
   * point of removing it.
   */
  it("keeps polling when every request fails, including the very first one", async () => {
    vi.useFakeTimers();
    const { fetchMock } = stubAppApi(); // /api/timings fails from the first call
    fetchMock.mockImplementation(timingsFails);

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1); // the mount fetch, which fails

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(3);
  });

  it("resumes on cadence after a failure that follows a successful idle payload", async () => {
    vi.useFakeTimers();
    const idlePayload: TimingsPayload = { ...payload, timings: [] };
    const { fetchMock } = stubAppApi(idlePayload);

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1); // mount: idle, no open run

    // A stage starts and goes into silent generation; the request that would
    // have discovered it fails. Under the old state machine nothing but that
    // request could restart polling, so this was R12.
    fetchMock.mockImplementation(timingsFails);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(3);
  });

  /**
   * Codex review on PR #18: the gap is measured from each response, not from
   * each request. A fixed interval would fire again while a slow request was
   * still in flight, and since `requestTimings` claims the latest id when it
   * *starts*, that in-flight response would then be thrown away as stale — an
   * endpoint slower than the interval would starve itself, never landing a
   * single payload no matter how long it ran.
   */
  it("never overlaps itself, so a response slower than the interval still lands", async () => {
    vi.useFakeTimers();
    let settle: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/api/timings"))
        return await new Promise<Response>((resolve) => {
          settle = resolve;
        });
      return await otherRoutes(input);
    });
    vi.stubGlobal("fetch", fetchMock);
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1); // in flight, and staying that way

    // Longer than one poll period with the request unanswered. A fixed
    // interval would have started another request at 30s, invalidating the
    // response still on the wire.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(1);

    // It finally answers — 45s late, and still accepted.
    await act(async () => {
      settle?.(new Response(JSON.stringify({ ok: true, value: payload })));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("now-elapsed").textContent).toBe("2h00m");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(2);
  });

  /**
   * The other side of waiting for the response (Codex review on PR #18): the
   * wait is bounded, so a request that never settles at all cannot stop the
   * poll. Not hypothetical — the VS Code transport's `getJson` resolves only
   * when the extension host answers, so a host restart strands it forever, and
   * during a silent generation there is no change push to restart the effect.
   */
  it("keeps making attempts when a request never settles at all", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/api/timings")) return await new Promise<Response>(() => {});
      return await otherRoutes(input);
    });
    vi.stubGlobal("fetch", fetchMock);
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);

    render(<App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1); // stranded

    // Still the only request while the wait's deadline runs.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(1);

    // Deadline, then one period: a fresh attempt, though nothing ever answered.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(2);

    // And it goes on making them — one per period, not one and done.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(timingsCallCount(fetchMock)).toBe(3);
  });

  it("stops polling once the dashboard unmounts", async () => {
    vi.useFakeTimers();
    const { fetchMock } = stubAppApi();

    const { unmount } = render(
      <App bootstrap={Promise.resolve({ ok: true as const, value: workflowPayload() })} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(timingsCallCount(fetchMock)).toBe(1);

    unmount();
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
 * they might look off) — StageRail is left unchanged.
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
