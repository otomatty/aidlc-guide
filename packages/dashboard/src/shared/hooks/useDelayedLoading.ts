import { useEffect, useState } from "react";

/** P-UI-5: anything that resolves inside this window never shows a skeleton. */
export const SKELETON_DELAY_MS = 200;

/**
 * `true` only once `active` has held for `delayMs`. One hook so every area
 * uses the same threshold and the flicker rule cannot drift per component.
 */
export function useDelayedLoading(active: boolean, delayMs = SKELETON_DELAY_MS): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return;
    }
    const timer = setTimeout(() => {
      setElapsed(true);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [active, delayMs]);

  return active && elapsed;
}
