import { commands, type ExtensionContext, window, workspace } from "vscode";
import { askOneShot, launchBtw, shareOnLan } from "./commands.ts";
import { openDashboardPanel } from "./dashboard-panel.ts";
import { disposeAllSessions } from "./guide-session.ts";
import { docsSkillPath, mcpScriptPath, registerMcp } from "./mcp-register.ts";
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
  createStatusBar(context);

  context.subscriptions.push(
    commands.registerCommand("aidlc-guide.open", async () => {
      const ws = primaryRoot();
      if (ws === undefined) {
        void window.showErrorMessage("ワークスペースを開いてください。");
        return;
      }
      if (!(await maybePromptSetup(context, ws))) openDashboardPanel(context, ws);
    }),

    commands.registerCommand("aidlc-guide.setup", () => {
      const ws = primaryRoot();
      if (ws === undefined) {
        void window.showErrorMessage("ワークスペースを開いてください。");
        return;
      }
      void openSetupPanel(context, ws);
    }),

    commands.registerCommand("aidlc-guide.registerMcp", async () => {
      const ws = primaryRoot();
      if (ws === undefined) return;
      if (!workspace.isTrusted) {
        void window.showErrorMessage("ワークスペースを信頼してから登録してください。");
        return;
      }
      const result = await registerMcp(
        ws,
        mcpScriptPath(context.extensionPath),
        docsSkillPath(context.extensionPath),
      );
      if (result.ok) {
        void window.showInformationMessage(
          "MCP と Claude Code / Cursor の文書参照 Skill を登録しました。AI セッションを再起動すると、AI-DLC の質問で文書を参照します。",
        );
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

  let refreshingRoot: string | undefined;
  let stopRefresh: { dispose(): void } | undefined;
  const initializeRoot = async () => {
    const root = primaryRoot();
    if (root === undefined) {
      stopRefresh?.dispose();
      refreshingRoot = undefined;
      return;
    }
    if (workspace.isTrusted && refreshingRoot !== root) {
      stopRefresh?.dispose();
      refreshingRoot = root;
      stopRefresh = startStatusBarRefresh(context, root);
    }
    const setupOpened = await maybePromptSetup(context, root);
    if (!setupOpened && workspace.isTrusted) await maybePromptWorkflowsUpdate(context, root);
  };
  const initialize = () => {
    void initializeRoot().catch((error) => {
      void window.showErrorMessage(`AIDLC Guide の起動に失敗しました: ${String(error)}`);
    });
  };
  context.subscriptions.push(
    workspace.onDidChangeWorkspaceFolders(initialize),
    workspace.onDidGrantWorkspaceTrust(initialize),
  );
  initialize();
}

export function deactivate(): void {
  disposeAllSessions();
}
