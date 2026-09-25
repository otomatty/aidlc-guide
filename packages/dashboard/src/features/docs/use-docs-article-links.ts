import type { MutableRefObject, RefObject } from "react";
import { useEffect } from "react";
import { isExternal } from "@/services/docs.ts";
import { resolveGuideHref } from "@/features/docs/utils/docs-navigation.ts";
import { resolveOfficialDocHref } from "@/features/docs/utils/resolve-doc-href.ts";
import type { DocSelection, DocsCategory } from "./types.ts";

export function useDocsArticleLinks({
  open,
  articleRef,
  selection,
  knownPaths,
  guideNames,
  setReference,
  evidenceRequest,
  setSelection,
  setCategory,
  setRequestedAnchor,
  setApplyKey,
  setDrawerOpen,
  normalizeRequestedAnchor,
}: {
  open: boolean;
  articleRef: RefObject<HTMLElement | null>;
  selection: DocSelection | null;
  knownPaths: string[];
  guideNames: string[];
  setReference: (value: null) => void;
  evidenceRequest: MutableRefObject<number>;
  setSelection: (value: DocSelection | null) => void;
  setCategory: (value: DocsCategory) => void;
  setRequestedAnchor: (value: string | undefined) => void;
  setApplyKey: (updater: (n: number) => number) => void;
  setDrawerOpen: (value: boolean) => void;
  normalizeRequestedAnchor: (anchor: string | undefined) => string | undefined;
}): void {
  useEffect(() => {
    const root = articleRef.current;
    if (!open || root === null || selection === null) return;

    const onClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (anchor === null || !root.contains(anchor)) return;
      const href = anchor.getAttribute("href");
      if (href === null) return;

      if (selection.kind === "official") {
        const resolved = resolveOfficialDocHref(selection.path, href, knownPaths);
        if (resolved !== null) {
          event.preventDefault();
          evidenceRequest.current += 1;
          setReference(null);
          setSelection({ kind: "official", path: resolved.path });
          setCategory("workflow");
          setRequestedAnchor(normalizeRequestedAnchor(resolved.anchor));
          setApplyKey((n) => n + 1);
          setDrawerOpen(false);
          return;
        }
      } else {
        const resolved = resolveGuideHref(selection.name, href, guideNames);
        if (resolved !== null) {
          event.preventDefault();
          evidenceRequest.current += 1;
          setReference(null);
          setSelection({ kind: "guide", name: resolved.name });
          setCategory("extension");
          setRequestedAnchor(normalizeRequestedAnchor(resolved.anchor));
          setApplyKey((n) => n + 1);
          setDrawerOpen(false);
          return;
        }
      }
      if (!isExternal(href)) event.preventDefault();
    };

    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("click", onClick);
    };
  }, [
    open,
    articleRef,
    selection,
    knownPaths,
    guideNames,
    setReference,
    evidenceRequest,
    setSelection,
    setCategory,
    setRequestedAnchor,
    setApplyKey,
    setDrawerOpen,
    normalizeRequestedAnchor,
  ]);
}
