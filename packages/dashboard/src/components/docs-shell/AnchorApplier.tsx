import { type RefObject, useEffect } from "react";

export type AnchorApplied = "scrolled" | "top" | "none";

export interface AnchorApplierProps {
  /** Outcome from OfficialDocsPage (FR-B2-3). */
  anchorApplied: AnchorApplied | undefined;
  /** Requested fragment (without `#`); required for `scrolled`. */
  anchor?: string;
  articleRef: RefObject<HTMLElement | null>;
  /** Re-run when body content changes (path/locale/markdown). */
  contentKey?: string;
}

/** GitHub-style heading slug (same algorithm as official-docs; local copy — no package import). */
export function slugifyHeading(heading: string): string {
  return heading
    .replace(/^#{1,6}\s*/, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
    .replace(/\s/g, "-");
}

function normalizeAnchor(anchor: string): string {
  return slugifyHeading(anchor.trim().replace(/^#/, ""));
}

/**
 * Apply `page.anchorApplied` after load (FR-B2-3):
 * - scrolled → scroll/focus matching heading
 * - top → scroll/focus article top
 * - none → noop
 */
export function AnchorApplier({
  anchorApplied,
  anchor,
  articleRef,
  contentKey,
}: AnchorApplierProps): null {
  // biome-ignore lint/correctness/useExhaustiveDependencies: contentKey re-runs after body swap
  useEffect(() => {
    const root = articleRef.current;
    if (root === null || anchorApplied === undefined || anchorApplied === "none") return;

    if (anchorApplied === "top") {
      root.scrollIntoView({ block: "start" });
      root.focus({ preventScroll: true });
      return;
    }

    const wanted = anchor === undefined ? "" : normalizeAnchor(anchor);
    if (wanted === "") return;

    const headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
    for (const node of headings) {
      if (!(node instanceof HTMLElement)) continue;
      if (slugifyHeading(node.textContent ?? "") !== wanted) continue;
      node.scrollIntoView({ block: "start" });
      if (!node.hasAttribute("tabindex")) node.tabIndex = -1;
      node.focus({ preventScroll: true });
      return;
    }
  }, [anchorApplied, anchor, articleRef, contentKey]);

  return null;
}
