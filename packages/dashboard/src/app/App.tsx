import type { ReadResult } from "@aidlc-guide/shared-types";
import {
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AgentPanel } from "../components/AgentPanel";
import { AreaBoundary } from "../components/AreaBoundary.tsx";
import { Skeleton } from "../components/atoms.tsx";
import { DetailPanel } from "../components/DetailPanel.tsx";
import { GuidesPanel } from "../components/GuidesPanel.tsx";
import { Header } from "../components/Header.tsx";
import { IntentPicker } from "../components/IntentPicker.tsx";
import { NowStrip } from "../components/NowStrip.tsx";
import { StageRail } from "../components/StageRail.tsx";
import { fetchIntents, fetchMatrix, fetchTimings, refetchAll } from "../services/api.ts";
import { usePrefetchStageDocs, useStageDoc } from "../services/docs.ts";
import { useLiveConnection } from "../services/live.ts";
import { StoreProvider, useAppState, useDispatch } from "../store/context.tsx";
import { viewValue, type WorkflowPayload } from "../store/state.ts";
import "../styles/globals.css";
import "../styles/app.css";

const UnitStageMatrix = lazy(async () => await import("../components/UnitStageMatrix.tsx"));

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
  const requestTimings = useCallback(() => {
    const requestId = ++timingsRequestId.current;
    void fetchTimings().then((result) => {
      if (requestId === timingsRequestId.current) dispatch({ type: "timings", result });
    });
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

  // Off the first-paint path: this runs after the three startup slices and
  // again on every change push. `lastChangeAt` advances on any scope, not just
  // audit — a ~15ms full parse is cheaper than a scope filter.
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastChangeAt is a re-run trigger, not read in the body
  useEffect(() => {
    requestTimings();
  }, [requestTimings, state.live.lastChangeAt]);

  // A long, silent generation emits no audit or state events, so the effect
  // above (keyed on `lastChangeAt`) never re-runs and `activeMs` would freeze
  // at whatever the last request happened to see — the exact case this
  // feature exists to surface. Poll while a run is genuinely open, read from
  // `timings` itself (an entry with `endedAt: null`) rather than `StageInfo`:
  // re-entering a stage can leave it open under a status that doesn't say so
  // (e.g. "awaiting-approval", see the StageRail re-entry tests), and a
  // finished workflow has no such entry, so it never polls.
  //
  // Sticky, not reactive to every view-state change (Codex PR #4 finding 1):
  // a transient `error` result (server restart, momentarily unreadable state
  // file) must not clear this and kill the interval — that is exactly the
  // silent-generation window the poll exists to survive, and nothing else
  // would restart it. Only a successful/partial payload updates the sticky
  // value, in either direction: an open run keeps it true, and a payload
  // that proves the run is over sets it false so a finished workflow stops
  // polling for good. An error leaves it untouched either way.
  const [hasOpenRun, setHasOpenRun] = useState(false);
  // Codex round 9, finding 2: `hasOpenRun` only ever gets set by a
  // SUCCESSFUL/partial payload below. Distinct from `hasOpenRun` itself
  // because "no payload has ever landed" and "a payload landed and reported
  // no open run" must be told apart — both currently leave `hasOpenRun`
  // `false`, but only the second one means polling may legitimately stay off.
  const [hasEverSucceeded, setHasEverSucceeded] = useState(false);
  useEffect(() => {
    const value = viewValue(state.timings);
    if (value === null) return; // loading/error: keep the last known sticky value
    setHasEverSucceeded(true);
    setHasOpenRun(value.timings.some((timing) => timing.endedAt === null));
  }, [state.timings]);
  useEffect(() => {
    // Finding 2 (Codex round 9): `hasOpenRun` starts `false`, and the effect
    // above is the only thing that ever sets it — so if the very FIRST
    // /api/timings request fails while a stage is genuinely running, nothing
    // ever flips it, this interval is never created, and no request fires
    // again to give the poll a second chance. Before any payload has
    // succeeded, fall back to polling as long as the workflow — a separate,
    // independently-fetched feed not gated by this same failure — still
    // names a current stage. `currentStage === null` only when the workflow
    // is unstarted or fully complete (now-strip-explain.ts's explainStage),
    // the one case where there is provably no run to ever discover; treat an
    // unloaded workflow (`null` view value) the same as "maybe active" so a
    // slow bootstrap can't suppress the very first retry.
    //
    // Terminates: once any payload succeeds, `hasEverSucceeded` flips true
    // for good and this fallback disjunct is permanently false — `hasOpenRun`
    // alone (the plain sticky rule) decides from then on, including turning
    // polling off for good when that first payload reports no open run.
    // Otherwise it terminates the moment the workflow itself resolves to no
    // current stage. It does NOT terminate on its own if the workflow stays
    // "active" and timings keeps failing forever — same accepted trade-off as
    // the no-backoff choice below, for a local dev tool polling itself.
    //
    // Codex round 12, finding 2: the pre-first-success fallback above only
    // covers the window before `hasEverSucceeded` ever flips true. Once it
    // has — a prior payload reported the workflow idle — `hasOpenRun` is
    // `false` and stays `false` on later errors (sticky, see above), so a
    // freshly-started stage that goes straight into silent generation before
    // its first `/api/timings` request lands gives us nothing to retry on:
    // that request fails, nothing updates either flag, and polling never
    // starts. `state.timings.kind === "error"` is the direct, un-stickied
    // signal for "our most recent attempt to find out failed" — unlike
    // `hasOpenRun`/`hasEverSucceeded` it is NOT sticky, it just reflects the
    // latest dispatched result, so it flips back off the moment any request
    // (poll or change-push) succeeds again. Folding it into the same
    // `mightBeActive` guard as the pre-first-success disjunct means it
    // terminates the same way: the instant a request succeeds while
    // reporting no open run, this disjunct goes false and — since
    // `hasOpenRun` is also false then — `shouldPoll` goes false right along
    // with it, so an idle workflow does not poll forever just because it once
    // saw an error.
    const workflowValue = viewValue(state.workflow);
    const mightBeActive = workflowValue === null || workflowValue.currentStage !== null;
    const timingsRequestFailed = state.timings.kind === "error";
    const shouldPoll = hasOpenRun || (mightBeActive && (!hasEverSucceeded || timingsRequestFailed));
    if (!shouldPoll) return;
    // Matches the VS Code status bar's own cadence (status-bar.ts) so both
    // surfaces move in the same rhythm; a full audit parse measures ~90ms
    // warm, so 30s is nowhere near "hammering the endpoint" for a value that
    // only changes on the scale of minutes (IDLE_THRESHOLD_MS is 10).
    //
    // No backoff on repeated failures, by choice: this is a local dev tool
    // hitting its own dashboard server, the interval is already a lazy 30s,
    // and the sticky state above means persistent failures cost one no-op
    // fetch per interval, not an escalating problem. Revisit if this ever
    // talks to something less local than `localhost`.
    const OPEN_RUN_POLL_MS = 30_000;
    const id = setInterval(requestTimings, OPEN_RUN_POLL_MS);
    return () => clearInterval(id);
  }, [hasOpenRun, hasEverSucceeded, requestTimings, state.workflow, state.timings.kind]);

  useLiveConnection(dispatch);
  useStageDoc();

  const stageSlugs = useMemo(() => {
    const workflow = viewValue(state.workflow);
    return workflow?.stages.map((stage) => stage.slug) ?? [];
  }, [state.workflow]);
  usePrefetchStageDocs(stageSlugs);

  const stagePurposes = useMemo(() => {
    const purposes: Record<string, string> = {};
    for (const [slug, doc] of Object.entries(state.stageDoc)) {
      if (doc.kind === "success" || doc.kind === "partial") {
        purposes[slug] = doc.value.purpose;
      }
    }
    return purposes;
  }, [state.stageDoc]);

  const retry = useCallback(() => {
    dispatch({ type: "reloading" });
    void refetchAll(dispatch);
    // Outside refetchAll's parallel three on purpose (ADR-03): /api/timings
    // stays off the first-paint critical path, but a manual retry after an
    // outage should not leave durations stale until the next change push,
    // which may never arrive.
    requestTimings();
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
  // mounted so stage detail / guides keep the same chrome.
  const routeOpen = state.selected !== null || state.guidesOpen || state.agentOpen !== null;

  useEffect(() => {
    const home = homeRef.current;
    if (home === null) return;
    if (routeOpen) home.setAttribute("inert", "");
    else home.removeAttribute("inert");
  }, [routeOpen]);

  return (
    <div className="app-shell">
      <Header timings={viewValue(state.timings)} workflow={viewValue(state.workflow)} />
      <div className="app-main">
        <div
          ref={homeRef}
          className="app-home"
          data-parked={routeOpen ? "" : undefined}
          aria-hidden={routeOpen}
        >
          <AreaBoundary name="now-strip">
            <NowStrip
              state={state.workflow}
              onRetry={retry}
              intentPicker={<IntentPicker />}
              timings={viewValue(state.timings)}
              // Timing notes are about the timing data as a whole, not any
              // one stage — NowStrip is the single surface that renders them
              // (finding 2, Codex round 13); Header and StageRail stay as-is.
              timingsNotes={state.timings.kind === "partial" ? state.timings.notes : []}
            />
          </AreaBoundary>
          <main className="layout">
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
