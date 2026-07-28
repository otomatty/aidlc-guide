import type { LiveSlice } from "./state.ts";

/**
 * mob-mode M3 / R-MM-3. The one guarantee this module exists for: LiveStatus
 * never claims a liveness the socket does not have.
 *
 * It is a pure derivation of `AppState.live` with no timers, no heuristics and
 * no state of its own, and the `connected === false` branch returns before any
 * `live` variant can be constructed — so "disconnected but showing ライブ更新中"
 * is not a bug that can be introduced here, it is a shape the code cannot
 * produce.
 */
export type LiveStatusView =
  | { kind: "connecting" }
  | { kind: "live"; lastChangeAt: string | null }
  | { kind: "reconnecting" }
  | { kind: "degraded"; reason: string };

export function liveStatusView(live: LiveSlice): LiveStatusView {
  if (!live.connected) {
    // Disconnected dominates degradation: whatever the server last said about
    // its watcher, we are not hearing from it now.
    return live.everConnected ? { kind: "reconnecting" } : { kind: "connecting" };
  }
  if (live.degraded) return { kind: "degraded", reason: live.reason ?? "" };
  // `null` = connected but nothing has changed yet. Rendered as a plain
  // 「ライブ更新中」 with no 最終更新 clause rather than a fabricated time.
  return { kind: "live", lastChangeAt: live.lastChangeAt ?? null };
}
