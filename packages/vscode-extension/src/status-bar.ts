import { currentStageView, formatDuration } from "@aidlc-guide/shared-types";
import { type ExtensionContext, StatusBarAlignment, type StatusBarItem, window } from "vscode";
import {
  getOrCreateSession,
  persistSelectedIntent,
  type SelectedIntentPersist,
} from "./guide-session.ts";
import { resolveOfficialDocsRoot } from "./official-docs-root.ts";

let item: StatusBarItem | undefined;

/**
 * Monotonic refresh id: event-driven and interval refreshes overlap, and an
 * older refresh resolving last must not overwrite a newer one's text with a
 * stale (though internally consistent) workflow/timings pair. Only the latest
 * refresh may touch the item.
 */
let refreshSeq = 0;

export function createStatusBar(context: ExtensionContext): StatusBarItem {
  item = window.createStatusBarItem(StatusBarAlignment.Left, 100);
  item.command = "aidlc-guide.open";
  item.text = "$(list-tree) AIDLC Guide";
  item.tooltip = "AIDLC Guide: Open";
  context.subscriptions.push(item);
  item.show();
  return item;
}

export async function refreshStatusBar(
  workspaceRoot: string,
  officialDocsRoot: string = workspaceRoot,
  persist?: SelectedIntentPersist,
): Promise<void> {
  if (item === undefined) return;
  const seq = ++refreshSeq;
  const stale = (): boolean => seq !== refreshSeq;
  try {
    const session = getOrCreateSession(workspaceRoot, officialDocsRoot, persist);
    const state = await session.service.reader.getWorkflow();
    if (stale()) return;
    if (!("ok" in state) || state.value.currentStage === null) {
      item.text = "$(list-tree) AIDLC Guide";
      item.tooltip = "AIDLC Guide: Open";
      return;
    }

    const stage = state.value.currentStage;
    // Stage-only label first, so a timing failure below has something
    // already-correct to fall back on instead of the bare default.
    item.text = `$(list-tree) ${stage}`;
    item.tooltip = `AIDLC Guide — ${state.value.phase} / ${stage}`;

    // Timing is best-effort decoration: a failure here must not blank the
    // stage name set above — this inner try means it doesn't.
    try {
      const timings = await session.service.reader.getTimings();
      if (stale()) return;
      // Which view is the current stage, and whether its runs describe the
      // attempt in play, was decided once in reader-core (issue #9) — this
      // surface reads the answer rather than re-deriving it. `currentStageView`
      // also applies the shared staleness gate (the payload's own
      // `currentStage` snapshot vs. the state read above), so two independent
      // reads can never put another stage's numbers next to this stage's name.
      const current = currentStageView(stage, "ok" in timings ? timings.value : null);
      if (current === null) return;

      const elapsed = formatDuration(current.elapsedActiveMs);
      const remaining =
        current.remainingMs === null ? "—" : `≈${formatDuration(current.remainingMs)}`;
      item.text = `$(list-tree) ${stage} · ${elapsed} / ${remaining}`;
      item.tooltip = `AIDLC Guide — ${state.value.phase} / ${stage}\n経過（実作業推定）: ${elapsed}\n残り（実績からの推定）: ${remaining}`;
    } catch {
      // Stage-only label above already stands.
    }
  } catch {
    item.text = "$(list-tree) AIDLC Guide";
  }
}

export function startStatusBarRefresh(
  context: ExtensionContext,
  workspaceRoot: string,
  intervalMs = 30_000,
): void {
  const officialDocsRoot = resolveOfficialDocsRoot(context.extensionPath, workspaceRoot);
  const persist = persistSelectedIntent(context);
  void refreshStatusBar(workspaceRoot, officialDocsRoot, persist);

  // Change-driven refresh via the session's existing watch→hub channel, so the
  // status bar reflects a stage change within the ≤2s budget (NFR-3) instead
  // of waiting out the poll. The interval below stays as the elapsed-time tick
  // (経過表示 advances even when no file changes) and as a fallback.
  const session = getOrCreateSession(workspaceRoot, officialDocsRoot, persist);
  const pushClient = {
    send: () => {
      void refreshStatusBar(workspaceRoot, officialDocsRoot);
    },
  };
  session.service.hub.add(pushClient);

  const handle = setInterval(() => {
    void refreshStatusBar(workspaceRoot, officialDocsRoot);
  }, intervalMs);
  context.subscriptions.push({
    dispose: () => {
      clearInterval(handle);
      session.service.hub.remove(pushClient);
    },
  });
}
