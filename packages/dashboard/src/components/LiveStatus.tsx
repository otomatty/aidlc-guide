import type { ReactNode } from "react";
import { type LiveStatusView, liveStatusView } from "../store/liveStatusView.ts";
import type { LiveSlice } from "../store/state.ts";

export function liveStatusText(view: LiveStatusView): string {
  switch (view.kind) {
    case "connecting":
      return "接続中…";
    case "reconnecting":
      return "切断・再接続中…";
    case "degraded":
      return view.reason === "" ? "更新が止まっています" : `更新が止まっています（${view.reason}）`;
    case "live":
      return "更新中";
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

export function LiveStatus({ live }: { live: LiveSlice }): ReactNode {
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
      {liveStatusText(view)}
    </span>
  );
}
