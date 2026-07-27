import { type ExtensionContext, StatusBarAlignment, type StatusBarItem, window } from "vscode";
import { getOrCreateSession } from "./guide-session.ts";

let item: StatusBarItem | undefined;

export function createStatusBar(context: ExtensionContext): StatusBarItem {
  item = window.createStatusBarItem(StatusBarAlignment.Left, 100);
  item.command = "aidlc-guide.open";
  item.text = "$(list-tree) AIDLC Guide";
  item.tooltip = "AIDLC Guide: Open";
  context.subscriptions.push(item);
  item.show();
  return item;
}

/** Mirrors dashboard/src/lib/format-duration.ts — the extension bundle cannot import it. */
function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

export async function refreshStatusBar(workspaceRoot: string): Promise<void> {
  if (item === undefined) return;
  try {
    const session = getOrCreateSession(workspaceRoot);
    const state = await session.service.reader.getWorkflow();
    if (!("ok" in state) || state.value.currentStage === null) {
      item.text = "$(list-tree) AIDLC Guide";
      item.tooltip = "AIDLC Guide: Open";
      return;
    }

    const stage = state.value.currentStage;
    // Timing is best-effort decoration: a failure here must not blank the
    // stage name the status bar exists to show.
    const timings = await session.service.reader.getTimings();
    const current = "ok" in timings ? timings.value.remaining.currentStage : null;

    if (current === null) {
      item.text = `$(list-tree) ${stage}`;
      item.tooltip = `AIDLC Guide — ${state.value.phase} / ${stage}`;
      return;
    }

    const elapsed = formatDuration(current.elapsedActiveMs);
    const remaining =
      current.remainingMs === null ? "—" : `≈${formatDuration(current.remainingMs)}`;
    item.text = `$(list-tree) ${stage} · ${elapsed} / ${remaining}`;
    item.tooltip = `AIDLC Guide — ${state.value.phase} / ${stage}\n経過（実作業推定）: ${elapsed}\n残り（実績からの推定）: ${remaining}`;
  } catch {
    item.text = "$(list-tree) AIDLC Guide";
  }
}

export function startStatusBarRefresh(
  context: ExtensionContext,
  workspaceRoot: string,
  intervalMs = 30_000,
): void {
  void refreshStatusBar(workspaceRoot);
  const handle = setInterval(() => {
    void refreshStatusBar(workspaceRoot);
  }, intervalMs);
  context.subscriptions.push({ dispose: () => clearInterval(handle) });
}
