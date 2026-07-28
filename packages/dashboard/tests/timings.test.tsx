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
 * A stage whose current attempt has already closed carries a measured
 * `actualActiveMs`; one that has only an estimate carries `estimateMs`. The
 * rail prefers the measurement — a measured run is not a guess.
 */
const stageRailTimings: TimingsPayload = {
  timings: [run("code-generation", 7_200_000, "2026-07-25T07:41:30Z")],
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
   * before `/api/timings` catches up, so the payload's current stage view
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
