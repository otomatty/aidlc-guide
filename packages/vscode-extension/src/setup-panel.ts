import { randomBytes } from "node:crypto";
import {
  type ExtensionContext,
  env,
  Uri,
  ViewColumn,
  type WebviewPanel,
  window,
  workspace,
} from "vscode";
import { onPath, runDoctor } from "./doctor.ts";
import { CODEX_GIT_REQUIRED, isGitRepository } from "./git-prerequisite.ts";
import { HARNESS_LABELS, type HarnessId } from "./harness-detect.ts";
import {
  docsSkillPath,
  mcpScriptPath,
  refreshDocsRegistration,
  registerMcp,
} from "./mcp-register.ts";
import {
  configureNative,
  INSTALL_GUIDE_URL,
  installNative,
  readNativeInstall,
} from "./native-setup.ts";
import { resolveOfficialDocsRoot } from "./official-docs-root.ts";
import { setupHtml } from "./setup-html.ts";
import { inspectSetup, needsSetup, type SetupPreference, setupStateKey } from "./setup-state.ts";

const panels = new Map<string, WebviewPanel>();
const runningRoots = new Set<string>();
const HARNESS_IDS = new Set(Object.keys(HARNESS_LABELS));
const isOpenFolder = (root: string): boolean =>
  workspace.workspaceFolders?.some((folder) => folder.uri.fsPath === root) ?? false;

/** One setup tab per folder, shared by automatic startup and the Setup command. */
export async function openSetupPanel(context: ExtensionContext, root: string): Promise<void> {
  if (!isOpenFolder(root)) return;
  const existing = panels.get(root);
  if (existing) {
    existing.reveal(ViewColumn.One);
    return;
  }
  const panel = window.createWebviewPanel(
    "aidlcGuide.setup",
    "AIDLC Guide セットアップ",
    ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  panels.set(root, panel);
  let disposed = false;
  const cancellation = new AbortController();
  const canWrite = () => !disposed && isOpenFolder(root) && workspace.isTrusted;
  const savePreference = async (next: SetupPreference): Promise<boolean> => {
    if (!canWrite()) return false;
    const key = setupStateKey(root);
    const previous = context.workspaceState.get<SetupPreference>(key);
    await context.workspaceState.update(key, next);
    if (canWrite()) return true;
    // Preserve a newer setting from another command while rolling back our cancelled completion.
    if (JSON.stringify(context.workspaceState.get(key)) === JSON.stringify(next))
      await context.workspaceState.update(key, previous);
    return false;
  };
  let busy = false;
  let selected: HarnessId = /cursor/i.test(env.appName) ? "cursor" : "claude";
  let selectedInitialized = false;
  let logText = "";
  let statusText = "";
  let statusError = false;
  const send = (message: unknown) => {
    if (!disposed) void panel.webview.postMessage(message);
  };
  const log = (text: string) => {
    logText = `${logText}${text}\n`.slice(-60000);
    send({ type: "log", text });
  };
  const status = (text: string, error = false) => {
    statusText = text;
    statusError = error;
    send({ type: "status", text, error });
  };
  const render = async () => {
    const state = await inspectSetup(context, root);
    if (!selectedInitialized) {
      const saved = state.preference?.harness;
      selected =
        saved &&
        HARNESS_IDS.has(saved) &&
        (state.harnesses.length === 0 || state.harnesses.includes(saved))
          ? saved
          : (state.harnesses[0] ?? selected);
      selectedInitialized = true;
    }
    if (!disposed)
      panel.webview.html = setupHtml(
        state,
        selected,
        workspace.isTrusted,
        randomBytes(18).toString("hex"),
      );
  };
  const dispose = panel.onDidDispose(() => {
    disposed = true;
    cancellation.abort(new Error("プロジェクトの設定を中止しました。"));
    panels.delete(root);
  });
  context.subscriptions.push(panel, dispose);
  const messages = panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (typeof message !== "object" || message === null || disposed || !isOpenFolder(root)) return;
    const msg = message as Record<string, unknown>;
    if (typeof msg.type !== "string") return;
    if (msg.type === "ready") {
      send({ type: "restore", log: logText, text: statusText, error: statusError });
      send({ type: "busy", value: busy });
      return;
    }
    if (busy) return;
    if (typeof msg.harness === "string" && HARNESS_IDS.has(msg.harness))
      selected = msg.harness as HarnessId;
    if (msg.type === "select-harness") return;
    if (msg.type === "docs" || msg.type === "bun-docs") {
      await env.openExternal(
        Uri.parse(msg.type === "docs" ? INSTALL_GUIDE_URL : "https://bun.sh/docs/installation"),
      );
      return;
    }
    if (!["install", "register-mcp", "recheck", "finish"].includes(msg.type)) return;
    if (runningRoots.has(root)) {
      status("このフォルダのセットアップは実行中です。完了後に状態を再確認してください。", true);
      return;
    }
    if (!workspace.isTrusted) {
      status("ワークスペースを信頼してから、設定を実行してください。", true);
      return;
    }
    busy = true;
    runningRoots.add(root);
    send({ type: "busy", value: true });
    try {
      const state = await inspectSetup(context, root);
      if (!canWrite()) return;
      if (selected === "codex" && ["install", "finish"].includes(msg.type)) {
        if (!(await isGitRepository(root, cancellation.signal)))
          throw new Error(CODEX_GIT_REQUIRED);
        if (!canWrite()) return;
      }
      if (msg.type === "install") {
        if (state.configured) {
          status("このプロジェクトは設定済みです。");
          await render();
          return;
        }
        status("AI-DLC を準備しています…");
        let install = readNativeInstall();
        if (!install) {
          await installNative(log);
          if (!canWrite()) return;
          install = readNativeInstall();
        }
        if (!install)
          throw new Error(
            "本体の配置を確認できません。公式手順でインストール先を確認してください。",
          );
        if (!state.projectPresent || state.version === null) {
          const result = await configureNative(install, root, selected, log, undefined, {
            signal: cancellation.signal,
            isCurrent: canWrite,
          });
          if (!canWrite()) return;
          status(
            result.doctorOk
              ? "AI-DLC の設定が完了しました。"
              : "プロジェクトを設定しました。診断に追加の対応項目があります。詳細を確認してください。",
          );
        } else {
          const verified = await inspectSetup(context, root);
          if (!verified.configured)
            throw new Error(
              verified.runtimeIssue ??
                "本体とプロジェクトの設定を確認できません。公式の手順を確認してください。",
            );
          status("本体の配置を確認しました。プロジェクトは設定済みです。");
        }
      } else if (msg.type === "register-mcp") {
        if (!state.configured)
          throw new Error("先に AI-DLC のプロジェクト設定を完了してください。");
        if (!(await onPath("bun")))
          throw new Error(
            "文書参照には Bun が必要です。「Bun の導入手順」から導入し、VS Code / Cursor を再起動してください。",
          );
        if (!canWrite()) return;
        const result = await registerMcp(
          root,
          mcpScriptPath(context.extensionPath),
          docsSkillPath(context.extensionPath),
          canWrite,
        );
        if (!result.ok) throw new Error(`文書参照を登録できませんでした: ${result.reason}`);
        if (!canWrite()) return;
        if (state.preference) {
          const preference = {
            ...state.preference,
            docsSkipped: false,
          };
          if (!(await savePreference(preference))) return;
        }
        status("文書参照を登録しました。利用する AI セッションを再起動してください。");
      } else if (msg.type === "recheck") {
        const report = await runDoctor(root, resolveOfficialDocsRoot(context.extensionPath, root));
        log(report.checks.map((check) => `${check.label}: ${check.detail}`).join("\n"));
        status("現在の設定を確認しました。");
      } else if (msg.type === "finish") {
        if (!state.configured)
          throw new Error("AI-DLC の設定を確認できません。「状態を再確認」で確認してください。");
        if (
          !(await savePreference({
            completed: true,
            docsSkipped: !state.docsReady,
            harness: selected,
          }))
        )
          return;
        const { openDashboardPanel } = await import("./dashboard-panel.ts");
        if (!canWrite()) return;
        openDashboardPanel(context, root);
        panel.dispose();
        return;
      }
      await render();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (!canWrite() && text.includes("rollback-conflict:"))
        void window.showErrorMessage(
          `文書参照の登録を中止しました。途中で変更されたファイルは復元せず保持しています: ${text}`,
        );
      status(text, true);
      log(text);
    } finally {
      busy = false;
      runningRoots.delete(root);
      send({ type: "busy", value: false });
    }
  });
  const trust = workspace.onDidGrantWorkspaceTrust(() => {
    void render().catch((error) => status(String(error), true));
  });
  const folders = workspace.onDidChangeWorkspaceFolders(() => {
    if (!isOpenFolder(root)) panel.dispose();
  });
  context.subscriptions.push(messages, trust, folders);
  panel.onDidDispose(() => {
    messages.dispose();
    trust.dispose();
    folders.dispose();
  });
  await render();
}

/** Open directly when setup is incomplete. Closing the tab does not mark setup complete. */
export async function maybePromptSetup(
  context: ExtensionContext,
  root: string,
  isCurrent: () => boolean = () => true,
): Promise<boolean> {
  try {
    if (!isCurrent()) return false;
    if (workspace.isTrusted) {
      const registration = await refreshDocsRegistration(
        root,
        mcpScriptPath(context.extensionPath),
        docsSkillPath(context.extensionPath),
      );
      if (!isCurrent()) return false;
      if (registration.updated)
        void window.showInformationMessage(
          "AIDLC Guide: 登録済みの文書参照連携を更新しました。AI セッションを再起動してください。",
        );
    }
    const state = await inspectSetup(context, root);
    if (!isCurrent() || !needsSetup(state)) return false;
    await openSetupPanel(context, root);
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    void window.showErrorMessage(
      `セットアップ状態の確認に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    );
    return true;
  }
}
