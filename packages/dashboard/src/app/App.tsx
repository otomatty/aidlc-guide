import type { ReadResult } from "@aidlc-guide/shared-types";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AreaBoundary } from "@/chrome/AreaBoundary.tsx";
import { Header } from "@/chrome/Header.tsx";
import { NowStrip } from "@/chrome/NowStrip.tsx";
import { useNowDisclosure } from "@/hooks/useNowDisclosure.ts";
import { HomePage } from "@/features/home/HomePage.tsx";
import {
  fetchIntents,
  fetchMatrix,
  fetchTimings,
  refetchAll,
  snapshotCurrent,
  snapshotToken,
} from "@/services/api.ts";
import { usePrefetchStageDocs, useStageDoc, useStagePurposes } from "@/services/docs.ts";
import { onDocsShellDeepLink, onOfficialDocsLocale } from "@/services/docs-shell-inject.ts";
import { useLiveConnection } from "@/services/live.ts";
import { StoreProvider, useAppState, useDispatch } from "@/store/context.tsx";
import { selectCurrentTiming, selectTimingNotes } from "@/store/select-timing.ts";
import { viewValue, type WorkflowPayload } from "@/store/state.ts";
import { RouteOutlet } from "./RouteOutlet.tsx";
import { isHomeRoute, showsNowStrip } from "./routes.ts";
import "@/styles/globals.css";
import "@/styles/app.css";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const homeScroll = useRef(0);
  const customizationScroll = useRef(0);
  const { expanded, setExpanded } = useNowDisclosure();
  const [customizationVisited, setCustomizationVisited] = useState(false);
  useEffect(() => {
    if (state.route.name === "customization") setCustomizationVisited(true);
  }, [state.route.name]);
  // Monotonic id shared by every /api/timings call site (the change-push
  // effect below and `retry`'s extra fetch) so a slow, stale response can
  // never overwrite a fresher one that resolved first — only the request that
  // is still the latest one in flight is allowed to dispatch its result.
  const timingsRequestId = useRef(0);
  const requestTimings = useCallback(async () => {
    const requestId = ++timingsRequestId.current;
    const token = snapshotToken();
    const result = await fetchTimings();
    if (requestId === timingsRequestId.current && snapshotCurrent(token))
      dispatch({ type: "timings", result });
  }, [dispatch]);

  useEffect(() => {
    let live = true;
    const token = snapshotToken();
    void bootstrap.then((result) => {
      if (live && snapshotCurrent(token)) dispatch({ type: "workflow", result });
    });
    void fetchMatrix().then((result) => {
      if (live && snapshotCurrent(token)) dispatch({ type: "matrix", result });
    });
    void fetchIntents().then((result) => {
      if (live && snapshotCurrent(token)) dispatch({ type: "intents", result });
    });
    return () => {
      live = false;
    };
  }, [bootstrap, dispatch]);

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
  // lastChangeAt is a re-run trigger, not read in the body
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

  // Host inject after open-official-doc (Bolt 3) — open Shell + one-shot deep-link.
  useEffect(() => {
    return onDocsShellDeepLink((deepLink) => {
      dispatch({
        type: "docs-shell",
        open: true,
        locale: deepLink.locale,
        ...(deepLink.path !== undefined ? { path: deepLink.path } : {}),
        ...(deepLink.anchor !== undefined ? { anchor: deepLink.anchor } : {}),
      });
    });
  }, [dispatch]);

  // Host bootstrap of persisted locale on panel ready (Bolt 3).
  useEffect(() => {
    return onOfficialDocsLocale((locale) => {
      dispatch({ type: "official-docs-locale", locale });
    });
  }, [dispatch]);

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
  const parked = !isHomeRoute(state.route);
  const stagePage = showsNowStrip(state.route);
  const customizationOpen = state.route.name === "customization";

  // Preserve the list position when returning home; each detail starts at its top.
  // page identities reset scrolling even when parked stays true
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = customizationOpen
        ? customizationScroll.current
        : parked
          ? 0
          : homeScroll.current;
  }, [parked, customizationOpen, state.route]);

  useEffect(() => {
    const home = homeRef.current;
    if (home === null) return;
    if (parked) home.setAttribute("inert", "");
    else home.removeAttribute("inert");
  }, [parked]);

  // One freshness gate for the stage and whole-workflow timing fields.
  const currentTiming = selectCurrentTiming(state);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden" data-testid="app-shell">
      <Header />
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-testid="app-scroll"
        onScroll={(event) => {
          if (!parked) homeScroll.current = event.currentTarget.scrollTop;
          if (customizationOpen) customizationScroll.current = event.currentTarget.scrollTop;
        }}
      >
        {stagePage ? (
          <AreaBoundary name="now-strip">
            <NowStrip
              state={state.workflow}
              onRetry={retry}
              showStartForm={!parked}
              current={currentTiming.view}
              remaining={currentTiming.remaining}
              estimateCoverage={currentTiming.estimateCoverage}
              timingsNotes={selectTimingNotes(state)}
              expanded={expanded}
              onExpandedChange={setExpanded}
            />
          </AreaBoundary>
        ) : null}
        {/* `app-home` carries no style — it is the handle the parking tests
            reach for. `data-parked` hides the home content while a child route
            is open; the node stays mounted so focus can be restored to it. */}
        <div
          ref={homeRef}
          className="app-home data-parked:hidden"
          data-parked={parked ? "" : undefined}
          aria-hidden={parked}
        >
          <HomePage
            onSelectStage={selectStage}
            onSelectCell={selectCell}
            onRetry={retry}
            purposes={stagePurposes}
          />
        </div>
        <RouteOutlet visitedCustomization={customizationVisited} />
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
