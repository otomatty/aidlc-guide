import type { ReadResult } from "@aidlc-guide/shared-types";
import { useEffect, useState } from "react";
import { deriveViewState } from "../store/derive-view-state.ts";
import type { ViewState } from "../store/state.ts";

/**
 * The one fetch→ViewState machine for panel-local data: liveness-guarded,
 * funnelled through `deriveViewState` so every degradation (`error`,
 * `unsupported`, `warnings`) renders the same way everywhere. This existed as
 * six hand-rolled useState/useEffect copies before being extracted — each
 * with its own subset of the branches.
 *
 * `load` is `null` to skip (panel closed, nothing selected); `deps` are the
 * values the fetch closure reads. Returns `null` until the first fetch of the
 * current deps starts resolving state.
 */
export function useFetchView<T>(
  load: (() => Promise<ReadResult<T>>) | null,
  deps: readonly unknown[],
): ViewState<T> | null {
  const [view, setView] = useState<ViewState<T> | null>(null);

  useEffect(
    () => {
      if (load === null) {
        setView(null);
        return;
      }
      let live = true;
      setView({ kind: "loading" });
      void load().then((result) => {
        if (live) setView(deriveViewState(result));
      });
      return () => {
        live = false;
      };
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the caller's fetch-closure inputs
    deps,
  );

  return view;
}
