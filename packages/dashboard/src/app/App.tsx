import type { ReadResult } from "@aidlc-guide/shared-types";
import { lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AgentPanel } from "../components/AgentPanel";
import { AreaBoundary } from "../components/AreaBoundary.tsx";
import { Skeleton } from "../components/atoms.tsx";
import { DetailPanel } from "../components/DetailPanel.tsx";
import { DocsShell } from "../components/DocsShell.tsx";
import { GuidesPanel } from "../components/GuidesPanel.tsx";
import { Header } from "../components/Header.tsx";
import { IntentPicker } from "../components/IntentPicker.tsx";
import { NowStrip } from "../components/NowStrip.tsx";
import { StageRail } from "../components/StageRail.tsx";
import { fetchIntents, fetchMatrix, fetchTimings, refetchAll } from "../services/api.ts";
import { usePrefetchStageDocs, useStageDoc, useStagePurposes } from "../services/docs.ts";
import { useLiveConnection } from "../services/live.ts";
import { StoreProvider, useAppState, useDispatch } from "../store/context.tsx";
import { selectCurrentTiming, selectTimingNotes } from "../store/select-timing.ts";
import { viewValue, type WorkflowPayload } from "../store/state.ts";
import "../styles/globals.css";
import "../styles/app.css";

const UnitStageMatrix = lazy(async () => await import("../components/UnitStageMatrix.tsx"));

/** See the refresh effect below: unconditional, and measured from each response. */
const TIMINGS_POLL_MS = 30_000;

/**
 * Wait for `work`, but never longer than `ms`, and never throw.
 *
 * The poll below waits for each response before scheduling the next request,
 * which is what keeps it single-flight — so anything that fails to settle
 * would stop it dead (Codex review on PR #18).
 *
 * The real fix for that is one layer down, where the request can actually be
 * cancelled: `GET_TIMEOUT_MS` bounds every read in both transports, at 20s,
 * under this poll's period. This is the backstop, not the mechanism — it costs
 * a few lines to make "the poll can only ever be delayed, never stopped" a
 * property of this effect rather than an inference about its callee, and it
 * also absorbs a rejection, which would otherwise end the cycle just as
 * permanently.
 */
async function settledOrAfter(work: Promise<unknown>, ms: number): Promise<void> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const elapsed = new Promise<void>((resolve) => {
    deadline = setTimeout(resolve, ms);
  });
  try {
    await Promise.race([
      work.then(
        () => undefined,
        () => undefined,
      ),
      elapsed,
    ]);
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
  }
}

export interface AppProps {
  bootstrap: Promise<ReadResult<WorkflowPayload>>;
}

function Dashboard({ bootstrap }: AppProps): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();
  const homeRef = useRef<HTMLDivElement>(null);
  // Monotonic id shared by every /api/timings call site (the change-push
  // effect below and `retry`'s extra fetch) so a slow, stale response can
  // never overwrite a fresher one that resolved first — only the request that
  // is still the latest one in flight is allowed to dispatch its result.
  const timingsRequestId = useRef(0);
  const requestTimings = useCallback(async () => {
    const requestId = ++timingsRequestId.current;
    const result = await fetchTimings();
    if (requestId === timingsRequestId.current) dispatch({ type: "timings", result });
  }, [dispatch]);

  useEffect(() => {
    let live = true;
    void bootstrap.then((result) => {
      if (live) dispatch({ type: "workflow", result });
    });
    return () => {
      live = false;
    };
  }, [bootstrap, dispatch]);

  useEffect(() => {
    void fetchMatrix().then((result) => {
      dispatch({ type: "matrix", result });
    });
    void fetchIntents().then((result) => {
      dispatch({ type: "intents", result });
    });
  }, [dispatch]);

  // Off the first-paint path: fires after the three startup slices, again on
  // every change push, and on a 30s poll in between. `lastChangeAt` advances
  // on any scope, not just audit — a ~15ms full parse is cheaper than a scope
  // filter — and re-running the effect restarts the poll, so a push both
  // refreshes immediately and defers the next tick.
  //
  // The poll is unconditional while the dashboard is on screen. It used to
  // fire only "while a run is open", a condition that cost three bugs across
  // PR #4's review (polling stops for good after one failed request / never
  // starts if the first request fails / never discovers a run that starts
  // after an idle period) and the state machine — a sticky `hasOpenRun`, a
  // `hasEverSucceeded` companion, a retry disjunction — built to prove it
  // could restart. What it bought was one 90ms request per 30s against
  // localhost (docs/perf/2026-07-27-timing-parse.md: warm p50 90.5ms) while
  // nothing is running. Issue #10 traded it back: a silent generation emits no
  // events, so this poll is the only thing that keeps `activeMs` moving, and
  // it can no longer fail to be running.
  //
  // The 30s is measured from each *response*, not from each request (Codex
  // review on PR #18). A fixed `setInterval` would start the next request
  // while a slow one was still in flight, and since `requestTimings` claims
  // the latest id when it starts, the in-flight response would then be thrown
  // away as stale: an endpoint slower than the interval would starve itself,
  // never landing a payload however long it ran. Waiting for the settle makes
  // the poll single-flight by construction. A change push does still supersede
  // an in-flight request — which is what the id check is for, since that
  // response really is stale.
  //
  // Which leaves "what if a response never comes at all". The transports bound
  // and cancel every read at `GET_TIMEOUT_MS` (20s, under this period), so a
  // stranded request settles as unreachable before the next one goes out —
  // nothing accumulates, and the single-flight property is real rather than
  // nominal. `settledOrAfter` is this effect's own backstop on top of that:
  // whatever the transport does, the poll can be delayed but not stopped.
  //
  // 30s matches the VS Code status bar's own cadence (status-bar.ts) so both
  // surfaces move in the same rhythm. No backoff on repeated failures, by
  // choice: a local tool hitting its own server, one lazy request per 30s.
  // Revisit if this ever talks to something less local than `localhost`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastChangeAt is a re-run trigger, not read in the body
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cycle = async (): Promise<void> => {
      await settledOrAfter(requestTimings(), TIMINGS_POLL_MS);
      if (!live) return;
      timer = setTimeout(() => void cycle(), TIMINGS_POLL_MS);
    };
    void cycle();
    return () => {
      live = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [requestTimings, state.live.lastChangeAt]);

  useLiveConnection(dispatch);
  useStageDoc();

  const stageSlugs = useMemo(() => {
    const workflow = viewValue(state.workflow);
    return workflow?.stages.map((stage) => stage.slug) ?? [];
  }, [state.workflow]);
  usePrefetchStageDocs(stageSlugs);

  const stagePurposes = useStagePurposes();

  const retry = useCallback(() => {
    dispatch({ type: "reloading" });
    void refetchAll(dispatch);
    // Outside refetchAll's parallel three on purpose (ADR-03): /api/timings
    // stays off the first-paint critical path, but a manual retry after an
    // outage should not leave durations stale until the next change push,
    // which may never arrive.
    void requestTimings();
  }, [dispatch, requestTimings]);

  const selectStage = useCallback(
    (slug: string) => {
      dispatch({ type: "select", selection: { kind: "stage", slug } });
    },
    [dispatch],
  );

  const selectCell = useCallback(
    (unit: string, stage: string) => {
      dispatch({ type: "select", selection: { kind: "cell", unit, stage } });
    },
    [dispatch],
  );

  // In-webview routing: park home content under the shared header. Header stays
  // mounted so stage detail / guides / docs shell keep the same chrome.
  const routeOpen =
    state.selected !== null ||
    state.guidesOpen ||
    state.docsShellOpen ||
    state.agentOpen !== null;

  useEffect(() => {
    const home = homeRef.current;
    if (home === null) return;
    if (routeOpen) home.setAttribute("inert", "");
    else home.removeAttribute("inert");
  }, [routeOpen]);

  // One freshness gate for the whole app (issue #10) — NowStrip and Header
  // take the resolved values and never compare stage names themselves.
  const currentTiming = selectCurrentTiming(state);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header remaining={currentTiming.remaining} />
      <div className="relative min-h-0 flex-auto">
        {/* `app-home` carries no style — it is the handle the parking tests
            reach for. `data-parked` hides the home content while a child route
            is open; the node stays mounted so focus can be restored to it. */}
        <div
          ref={homeRef}
          className="app-home data-[parked]:hidden"
          data-parked={routeOpen ? "" : undefined}
          aria-hidden={routeOpen}
        >
          <AreaBoundary name="now-strip">
            <NowStrip
              state={state.workflow}
              onRetry={retry}
              intentPicker={<IntentPicker />}
              current={currentTiming.view}
              // Timing notes are about the timing data as a whole, not any
              // one stage — NowStrip is the single surface that renders them
              // (finding 2, Codex round 13); Header and StageRail stay as-is.
              timingsNotes={selectTimingNotes(state)}
            />
          </AreaBoundary>
          <main className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 p-4">
            <AreaBoundary name="stage-rail">
              <StageRail
                state={state.workflow}
                onSelect={selectStage}
                onRetry={retry}
                purposes={stagePurposes}
                timings={viewValue(state.timings)}
              />
            </AreaBoundary>
            <AreaBoundary name="matrix">
              <Suspense fallback={<Skeleton lines={4} label="成果物マトリクス" />}>
                <UnitStageMatrix state={state.matrix} onSelectCell={selectCell} onRetry={retry} />
              </Suspense>
            </AreaBoundary>
          </main>
        </div>
        <AreaBoundary name="detail-panel">
          <DetailPanel />
        </AreaBoundary>
        <AreaBoundary name="guides-panel">
          <GuidesPanel />
        </AreaBoundary>
        <AreaBoundary name="docs-shell">
          <DocsShell />
        </AreaBoundary>
        <AreaBoundary name="agent-panel">
          <AgentPanel />
        </AreaBoundary>
      </div>
    </div>
  );
}

export function App({ bootstrap }: AppProps): ReactNode {
  return (
    <StoreProvider>
      <TooltipProvider>
        <AreaBoundary name="app">
          <Dashboard bootstrap={bootstrap} />
        </AreaBoundary>
      </TooltipProvider>
    </StoreProvider>
  );
}
