import type { ReadResult } from "@aidlc-guide/shared-types";
import { lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef } from "react";
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
    let cancelled = false;
    void fetchTimings().then((result) => {
      if (!cancelled) dispatch({ type: "timings", result });
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, state.live.lastChangeAt]);

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
    void fetchTimings().then((result) => {
      dispatch({ type: "timings", result });
    });
  }, [dispatch]);

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
      <Header timings={viewValue(state.timings)} />
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
