import type { DeepLink } from "@aidlc-guide/shared-types";
import { useEffect, useRef } from "react";
import { useAppState, useDispatch } from "../store/context.tsx";
import { deriveViewState } from "../store/deriveViewState.ts";
import type { Selection } from "../store/state.ts";
import { fetchDocsSettings, fetchLinks, fetchStageDoc } from "./api.ts";

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

/**
 * Prefetch stage purposes for the rail when the viewport is wide enough to
 * show them. Off the first-paint path (idle), and skipped on narrow screens.
 */
export function usePrefetchStageDocs(slugs: readonly string[]): void {
  const state = useAppState();
  const dispatch = useDispatch();
  const stageDocRef = useRef(state.stageDoc);
  stageDocRef.current = state.stageDoc;
  const roster = slugs.join("\0");

  useEffect(() => {
    if (roster === "") return;
    const list = roster.split("\0");
    // jsdom has no matchMedia; treat as wide so purposes still warm in tests.
    const mq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(min-width: 48rem)")
        : ({
            matches: true,
            addEventListener: () => {},
            removeEventListener: () => {},
          } as unknown as MediaQueryList);
    let cancelled = false;
    let cancelScheduled: (() => void) | undefined;
    const inFlight = new Set<string>();

    const prefetch = (): void => {
      if (cancelled || !mq.matches) return;
      for (const slug of list) {
        if (stageDocRef.current[slug] !== undefined || inFlight.has(slug)) continue;
        inFlight.add(slug);
        dispatch({ type: "stage-doc", slug, state: { kind: "loading" } });
        void fetchStageDoc(slug).then((result) => {
          inFlight.delete(slug);
          if (cancelled) return;
          dispatch({ type: "stage-doc", slug, state: deriveViewState(result) });
        });
      }
    };

    const schedule = (): void => {
      cancelScheduled?.();
      const idle = window.requestIdleCallback;
      if (typeof idle === "function") {
        const handle = idle(prefetch, { timeout: 2000 });
        cancelScheduled = () => {
          window.cancelIdleCallback(handle);
        };
        return;
      }
      const timer = setTimeout(prefetch, 0);
      cancelScheduled = () => {
        clearTimeout(timer);
      };
    };

    schedule();
    mq.addEventListener("change", schedule);
    return () => {
      cancelled = true;
      cancelScheduled?.();
      mq.removeEventListener("change", schedule);
    };
  }, [roster, dispatch]);
}

/** Step 7: header links + docsBaseUrl, after first paint — never on the critical path. */
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
      void fetchDocsSettings().then((result) => {
        if ("ok" in result) {
          dispatch({
            type: "docs-settings",
            docsBaseUrl: result.value.docsBaseUrl,
            stageDocs: result.value.stageDocs,
          });
        }
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

function withAnchor(base: string, anchor: string): string {
  if (anchor === "" || anchor === "#") return base;
  const fragment = anchor.startsWith("#") ? anchor.slice(1) : anchor;
  return `${base}#${fragment}`;
}

/** Join `docsBaseUrl` (trailing slash) with a repo-relative `docPath`. */
export function joinDocsUrl(docsBaseUrl: string, docPath: string): string | null {
  const base = safeHref(docsBaseUrl);
  const rel = safeHref(docPath);
  if (base === null || rel === null || !isExternal(base)) return null;
  try {
    return new URL(rel.replace(/^\.\//, ""), base.endsWith("/") ? base : `${base}/`).href;
  } catch {
    return null;
  }
}

/**
 * `{docPath, docAnchor}` → href when using `docsBaseUrl` + bridge-map path.
 * Prefer {@link docsOpenHref} for StageCard (honours per-stage overrides).
 */
export function deepLinkHref(
  link: DeepLink | null,
  docsBaseUrl: string | null = null,
): string | null {
  if (link === null) return null;
  if (docsBaseUrl !== null && docsBaseUrl.trim() !== "") {
    const absolute = joinDocsUrl(docsBaseUrl, link.docPath);
    return absolute === null ? null : withAnchor(absolute, link.docAnchor);
  }
  const base = safeHref(link.docPath);
  if (base === null) return null;
  return withAnchor(base, link.docAnchor);
}

/**
 * Open URL for 「docs を開く」:
 * 1. `stageDocs[slug]` (Confluence / Notion / … full URL)
 * 2. else `docsBaseUrl` + bridge-map path
 * 3. else `null` (IDE may open the workspace file)
 */
export function docsOpenHref(
  slug: string,
  link: DeepLink | null,
  settings: {
    docsBaseUrl: string | null;
    stageDocs: Readonly<Record<string, string>>;
  },
): string | null {
  const override = settings.stageDocs[slug]?.trim();
  if (override !== undefined && override !== "") {
    return safeHref(override);
  }
  return deepLinkHref(link, settings.docsBaseUrl);
}

/** Ask the VS Code host to open a workspace-relative docs path. */
export function openDocInIde(link: DeepLink): boolean {
  const api = window.acquireVsCodeApi?.();
  if (api === undefined) return false;
  api.postMessage({ type: "open-doc", path: link.docPath, anchor: link.docAnchor });
  return true;
}

export function canOpenDocsInIde(): boolean {
  return typeof window.acquireVsCodeApi === "function";
}
