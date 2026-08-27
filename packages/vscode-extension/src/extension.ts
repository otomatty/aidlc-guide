import { commands, type ExtensionContext, window, workspace } from "vscode";
import { askOneShot, launchBtw, shareOnLan } from "./commands.ts";
import { openDashboardPanel } from "./dashboard-panel.ts";
import { disposeAllSessions } from "./guide-session.ts";
import { mcpScriptPath, registerMcp } from "./mcp-register.ts";
import { maybePromptSetup, openSetupPanel } from "./setup-panel.ts";
import { createStatusBar, startStatusBarRefresh } from "./status-bar.ts";
import {
  maybePromptWorkflowsUpdate,
  openWorkflowsUpdatePanel,
  UPDATE_WORKFLOWS_COMMAND,
} from "./workflows-update-panel.ts";

function primaryRoot(): string | undefined {
  return workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function activate(context: ExtensionContext): Promise<void> {
  const root = primaryRoot();
  if (root === undefined) return;

  createStatusBar(context);
  startStatusBarRefresh(context, root);

  context.subscriptions.push(
    commands.registerCommand("aidlc-guide.open", () => {
      const ws = primaryRoot();
      if (ws === undefined) {
        void window.showErrorMessage("ワークスペースを開いてください。");
        return;
      }
      openDashboardPanel(context, ws);
    }),

    commands.registerCommand("aidlc-guide.setup", () => {
      const ws = primaryRoot();
      if (ws === undefined) return;
      void openSetupPanel(context, ws);
    }),

    commands.registerCommand("aidlc-guide.registerMcp", async () => {
      const ws = primaryRoot();
      if (ws === undefined) return;
      const result = await registerMcp(ws, mcpScriptPath(context.extensionPath));
      if (result.ok) {
        await context.workspaceState.update("aidlc-guide.setupDone", true);
        void window.showInformationMessage("MCP を .mcp.json に登録しました。");
      } else {
        void window.showErrorMessage(`MCP 登録失敗: ${result.reason}`);
      }
    }),

    commands.registerCommand("aidlc-guide.askBtw", () => {
      void launchBtw(context, false);
    }),

    commands.registerCommand("aidlc-guide.askOneShot", () => {
      void askOneShot(context);
    }),

    commands.registerCommand("aidlc-guide.shareLan", () => {
      void shareOnLan(context);
    }),

    commands.registerCommand(UPDATE_WORKFLOWS_COMMAND, () => {
      const ws = primaryRoot();
      if (ws === undefined) {
        void window.showErrorMessage("ワークスペースを開いてください。");
        return;
      }
      void openWorkflowsUpdatePanel(context, ws);
    }),

    { dispose: () => disposeAllSessions() },
  );

  void maybePromptSetup(context, root);
  void maybePromptWorkflowsUpdate(context, root);
}

export function deactivate(): void {
  disposeAllSessions();
}
