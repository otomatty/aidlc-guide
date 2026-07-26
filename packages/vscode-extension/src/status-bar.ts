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

export async function refreshStatusBar(workspaceRoot: string): Promise<void> {
  if (item === undefined) return;
  try {
    const session = getOrCreateSession(workspaceRoot);
    const state = await session.service.reader.getWorkflow();
    if ("ok" in state && state.value.currentStage !== null) {
      item.text = `$(list-tree) ${state.value.currentStage}`;
      item.tooltip = `AIDLC Guide — ${state.value.phase} / ${state.value.currentStage}`;
    } else {
      item.text = "$(list-tree) AIDLC Guide";
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
  void refreshStatusBar(workspaceRoot);
  const handle = setInterval(() => {
    void refreshStatusBar(workspaceRoot);
  }, intervalMs);
  context.subscriptions.push({ dispose: () => clearInterval(handle) });
}
