import type { ReadResult } from "@aidlc-guide/shared-types";
import { lazy, type ReactNode, Suspense, useCallback, useEffect } from "react";
import { AreaBoundary } from "../components/AreaBoundary.tsx";
import { Skeleton } from "../components/atoms.tsx";
import { DetailPanel } from "../components/DetailPanel.tsx";
import { Header } from "../components/Header.tsx";
import { NowStrip } from "../components/NowStrip.tsx";
import { StageRail } from "../components/StageRail.tsx";
import { fetchIntents, fetchMatrix, refetchAll } from "../services/api.ts";
import { useStageDoc } from "../services/docs.ts";
import { useLiveConnection } from "../services/live.ts";
import { StoreProvider, useAppState, useDispatch } from "../store/context.tsx";
import type { WorkflowPayload } from "../store/state.ts";
import "../styles/tokens.css";
import "../styles/app.css";
import { IntentPicker } from "../components/IntentPicker.tsx";

/**
 * P-UI-1: the matrix is the only heavy area, so it is the split point. The
 * first paint downloads Header + NowStrip + StageRail and nothing else.
 */
const UnitStageMatrix = lazy(async () => await import("../components/UnitStageMatrix.tsx"));

export interface AppProps {
  /** Started in main.tsx *before* React mounts (P-UI-2). */
  bootstrap: Promise<ReadResult<WorkflowPayload>>;
}

function Dashboard({ bootstrap }: AppProps): ReactNode {
  const state = useAppState();
  const dispatch = useDispatch();

  // Step 1: consume the in-flight bootstrap fetch — do not issue a second one.
  useEffect(() => {
    let live = true;
    void bootstrap.then((result) => {
      if (live) dispatch({ type: "workflow", result });
    });
    return () => {
      live = false;
    };
  }, [bootstrap, dispatch]);

  // Step 3: the matrix may still be building; `matrix-ready` finishes the job.
  // The intent list is fetched alongside it — one readdir, off the state path.
  useEffect(() => {
    void fetchMatrix().then((result) => {
      dispatch({ type: "matrix", result });
    });
    void fetchIntents().then((result) => {
      dispatch({ type: "intents", result });
    });
  }, [dispatch]);

  // Steps 2/4/5.
  useLiveConnection(dispatch);
  // Steps 6/7.
  useStageDoc();

  const retry = useCallback(() => {
    dispatch({ type: "reloading" });
    void refetchAll(dispatch);
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

  return (
    <>
      <Header />
      <AreaBoundary name="now-strip">
        <NowStrip state={state.workflow} onRetry={retry} intentPicker={<IntentPicker />} />
      </AreaBoundary>
      <main className="layout">
        <AreaBoundary name="stage-rail">
          <StageRail state={state.workflow} onSelect={selectStage} onRetry={retry} />
        </AreaBoundary>
        <AreaBoundary name="matrix">
          <Suspense fallback={<Skeleton lines={4} label="成果物マトリクス" />}>
            <UnitStageMatrix state={state.matrix} onSelectCell={selectCell} onRetry={retry} />
          </Suspense>
        </AreaBoundary>
      </main>
      <AreaBoundary name="detail-panel">
        <DetailPanel />
      </AreaBoundary>
    </>
  );
}

export function App({ bootstrap }: AppProps): ReactNode {
  return (
    <StoreProvider>
      {/* Outer net: the four AreaBoundaries catch area faults, this catches
          anything left (R-UI-1 二段構え). */}
      <AreaBoundary name="app">
        <Dashboard bootstrap={bootstrap} />
      </AreaBoundary>
    </StoreProvider>
  );
}
