import { commands, type ExtensionContext, window, workspace } from "vscode";
import { askOneShot, launchBtw, shareOnLan } from "./commands.ts";
import { openDashboardPanel } from "./dashboard-panel.ts";
import { disposeAllSessions } from "./guide-session.ts";
import { docsSkillPath, mcpScriptPath, registerMcp } from "./mcp-register.ts";
import { maybePromptSetup, openSetupPanel, openWorkflowsInstallPanel } from "./setup-panel.ts";
import { type SetupPreference, setupStateKey } from "./setup-state.ts";
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
      const isCurrent = () => primaryRoot() === ws;
      if (!(await maybePromptSetup(context, ws, isCurrent)) && isCurrent())
        openDashboardPanel(context, ws);
    }),

    commands.registerCommand("aidlc-guide.setup", () => {
      const ws = primaryRoot();
      if (ws === undefined) {
        void window.showErrorMessage("ワークスペースを開いてください。");
        return;
      }
      void openSetupPanel(context, ws);
    }),

    commands.registerCommand("aidlc-guide.installWorkflows", (requestedRoot?: unknown) => {
      const ws = requestedRoot === undefined ? primaryRoot() : requestedRoot;
      if (ws === undefined) {
        void window.showErrorMessage("ワークスペースを開いてください。");
        return;
      }
      if (
        typeof ws !== "string" ||
        !workspace.workspaceFolders?.some((folder) => folder.uri.fsPath === ws)
      ) {
        void window.showErrorMessage("インストール対象のワークスペースを開き直してください。");
        return;
      }
      if (!workspace.isTrusted) {
        void window.showErrorMessage(
          "ワークスペースを信頼してから、ワークフローをインストールしてください。",
        );
        return;
      }
      void openWorkflowsInstallPanel(context, ws);
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
        const preference = context.workspaceState.get<SetupPreference>(setupStateKey(ws));
        if (preference)
          await context.workspaceState.update(setupStateKey(ws), {
            ...preference,
            docsSkipped: false,
          });
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
      if (!workspace.isTrusted) {
        void window.showErrorMessage(
          "ワークスペースを信頼してから、ワークフローを更新してください。",
        );
        return;
      }
      void openWorkflowsUpdatePanel(context, ws);
    }),

    { dispose: () => disposeAllSessions() },
  );

  let refreshingRoot: string | undefined;
  let stopRefresh: { dispose(): void } | undefined;
  let generation = 0;
  const initializeRoot = async () => {
    const currentGeneration = ++generation;
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
    const isCurrent = () => currentGeneration === generation && root === primaryRoot();
    const setupOpened = await maybePromptSetup(context, root, isCurrent);
    if (isCurrent() && !setupOpened && workspace.isTrusted)
      await maybePromptWorkflowsUpdate(context, root, isCurrent);
  };
  const initialize = () => {
    void initializeRoot().catch((error) => {
      void window.showErrorMessage(`AIDLC Guide の起動に失敗しました: ${String(error)}`);
    });
  };
  context.subscriptions.push(
    {
      dispose: () => {
        generation++;
        stopRefresh?.dispose();
      },
    },
    workspace.onDidChangeWorkspaceFolders(initialize),
    workspace.onDidGrantWorkspaceTrust(initialize),
  );
  initialize();
}

export function deactivate(): void {
  disposeAllSessions();
}
