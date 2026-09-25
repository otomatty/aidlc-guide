import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { findAnchor, type TourAnchor } from "./steps.ts";

/** How long a step waits for its element, e.g. a stage page still loading. */
export const ANCHOR_TIMEOUT_MS = 4000;

export interface AnchorBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type AnchorStatus = "searching" | "found" | "missing";

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function boxOf(element: Element): AnchorBox {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function sameBox(a: AnchorBox, b: AnchorBox): boolean {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/**
 * Wait for a step's element, bring it into view and follow its box as the
 * page moves. A step whose element never appears settles as `missing`, so the
 * card still reads correctly instead of hanging.
 */
export function useTourAnchor(anchor: TourAnchor): {
  element: Element | null;
  box: AnchorBox | null;
  status: AnchorStatus;
} {
  const [element, setElement] = useState<Element | null>(null);
  const [status, setStatus] = useState<AnchorStatus>("searching");
  const [box, setBox] = useState<AnchorBox | null>(null);
  const { attr, value } = anchor;

  useEffect(() => {
    setElement(null);
    setBox(null);
    setStatus("searching");
    let settled = false;
    const observer = new MutationObserver(() => check());
    const timer = setTimeout(() => {
      if (settled) return;
      settle();
      setStatus("missing");
    }, ANCHOR_TIMEOUT_MS);
    function settle(): void {
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
    }
    function check(): void {
      if (settled) return;
      const found = findAnchor({ attr, value });
      if (found === null) return;
      settle();
      found.scrollIntoView?.({
        block: "center",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      setElement(found);
      setStatus("found");
    }
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-parked"],
    });
    check();
    return settle;
  }, [attr, value]);

  // Follow the element every frame while the step shows. Scroll and resize
  // events alone let the ring trail a smooth scroll by several frames; reading
  // the box each frame and committing a change synchronously keeps the ring on
  // the element through scrolling, resizing and content loading above it.
  useEffect(() => {
    if (element === null) return;
    let last = boxOf(element);
    setBox(last);
    let frame = requestAnimationFrame(function track() {
      const next = boxOf(element);
      if (!sameBox(last, next)) {
        last = next;
        flushSync(() => setBox(next));
      }
      frame = requestAnimationFrame(track);
    });
    return () => cancelAnimationFrame(frame);
  }, [element]);

  return { element, box, status };
}
