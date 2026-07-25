import { type ReactNode, useEffect, useState } from "react";
import { type LiveStatusView, liveStatusView } from "../store/liveStatusView.ts";
import type { LiveSlice } from "../store/state.ts";

/**
 * mob-mode M3 / R-UI-5: liveness loss is stated, never implied by staleness.
 * Shown to driver and participants alike — both need to know whether what they
 * are looking at is current (BLM M3).
 */

/**
 * 「最終更新」 goes stale on its own once a session goes quiet, and a frozen
 * "1分前" is exactly the overstated liveness R-MM-3 forbids. One cheap local
 * tick keeps the wording honest; it re-renders this component only.
 */
const TICK_MS = 30_000;

const RELATIVE = new Intl.RelativeTimeFormat("ja", { numeric: "auto" });

/** Largest unit that still gives a whole number. Past times are negative. */
export function relativeTime(iso: string, now: number): string {
  const delta = (new Date(iso).getTime() - now) / 1000;
  if (Number.isNaN(delta)) return "";
  const abs = Math.abs(delta);
  if (abs < 60) return RELATIVE.format(Math.round(delta), "second");
  if (abs < 3600) return RELATIVE.format(Math.round(delta / 60), "minute");
  if (abs < 86_400) return RELATIVE.format(Math.round(delta / 3600), "hour");
  return RELATIVE.format(Math.round(delta / 86_400), "day");
}

/** The four copies of BLM M3, one per `LiveStatusView` variant. */
export function liveStatusText(view: LiveStatusView, now: number): string {
  switch (view.kind) {
    case "connecting":
      return "接続中…";
    case "reconnecting":
      return "切断・再接続中…";
    case "degraded":
      return view.reason === "" ? "更新が止まっています" : `更新が止まっています（${view.reason}）`;
    case "live": {
      if (view.lastChangeAt === null) return "ライブ更新中";
      const when = relativeTime(view.lastChangeAt, now);
      return when === "" ? "ライブ更新中" : `ライブ更新中 · 最終更新 ${when}`;
    }
  }
}

export function LiveStatus({ live }: { live: LiveSlice }): ReactNode {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const view = liveStatusView(live);
  return (
    <span
      className="live"
      role="status"
      aria-live="polite"
      data-state={view.kind}
      data-testid="live-status"
    >
      <span className="live__dot" aria-hidden="true" />
      {liveStatusText(view, now)}
    </span>
  );
}
