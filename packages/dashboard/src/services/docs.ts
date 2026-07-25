import type { DeepLink } from "@aidlc-guide/shared-types";
import { useEffect, useRef } from "react";
import { useAppState, useDispatch } from "../store/context.tsx";
import { deriveViewState } from "../store/deriveViewState.ts";
import type { Selection } from "../store/state.ts";
import { fetchLinks, fetchStageDoc } from "./api.ts";

/**
 * On-demand fetches (BLM steps 6/7) — deliberately off the first-paint path
 * (P-UI-2) — plus the one place deep-link hrefs are built (S-UI-4).
 */

/** Which stage a selection explains; a matrix cell explains its column. */
export function slugOf(selection: Selection): string | null {
  if (selection === null) return null;
  return selection.kind === "stage" ? selection.slug : selection.stage;
}

/**
 * Step 6: fetch on selection, once per slug per session. The memo *is* the
 * `stageDoc` slice — a second cache would be a second truth.
 */
export function useStageDoc(): void {
  const state = useAppState();
  const dispatch = useDispatch();
  const slug = slugOf(state.selected);
  const cached = slug === null ? undefined : state.stageDoc[slug];
  const known = cached !== undefined;

  useEffect(() => {
    if (slug === null || known) return;
    dispatch({ type: "stage-doc", slug, state: { kind: "loading" } });
    void fetchStageDoc(slug).then((result) => {
      // Always dispatched, even if the user has moved on: the slice is keyed
      // by slug, so a late answer fills its own slot instead of clobbering the
      // current one. Dropping it would leave that slug stuck on "loading"
      // forever, because `known` already suppresses a second fetch.
      dispatch({ type: "stage-doc", slug, state: deriveViewState(result) });
    });
  }, [slug, known, dispatch]);
}

/** Step 7: header links, after first paint — never on the critical path. */
export function useProjectLinks(): void {
  const dispatch = useDispatch();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = (): void => {
      void fetchLinks().then((result) => {
        dispatch({ type: "links", result });
      });
    };

    const idle = window.requestIdleCallback;
    if (typeof idle === "function") {
      const handle = idle(run, { timeout: 2000 });
      return () => {
        window.cancelIdleCallback(handle);
      };
    }
    // Safari and jsdom have no requestIdleCallback; a macrotask is close
    // enough — the point is only "after the first paint".
    const timer = setTimeout(run, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [dispatch]);
}

/**
 * S-UI-4: only `http(s)` and same-origin relative paths become hrefs. Anything
 * else (`javascript:`, `file:`, `data:`) is refused — the values come from a
 * config file the user edits, which is still not a reason to open them blindly.
 */
export function safeHref(target: string): string | null {
  const trimmed = target.trim();
  if (trimmed === "") return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // A scheme-ish prefix on something that is not http(s).
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}

export function isExternal(target: string): boolean {
  return /^https?:\/\//i.test(target.trim());
}

/** `{docPath, docAnchor}` → the link the StageCard renders (US-23). */
export function deepLinkHref(link: DeepLink | null): string | null {
  if (link === null) return null;
  const base = safeHref(link.docPath);
  if (base === null) return null;
  return link.docAnchor === "" ? base : `${base}#${link.docAnchor}`;
}
