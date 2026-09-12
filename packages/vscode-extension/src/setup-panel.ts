import { randomBytes } from "node:crypto";
import path from "node:path";
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
import type { NativeDoctorReport } from "./doctor-output.ts";
import { CODEX_GIT_REQUIRED, isGitRepository } from "./git-prerequisite.ts";
import { HARNESS_LABELS, type HarnessId } from "./harness-detect.ts";
import {
  docsSkillPath,
  mcpScriptPath,
  refreshDocsRegistration,
  registerMcp,
} from "./mcp-register.ts";
import {
  INSTALL_GUIDE_URL,
  runNativeDoctor,
  runSetupProcess,
  type SetupRunner,
} from "./native-setup.ts";
import { resolveOfficialDocsRoot } from "./official-docs-root.ts";
import { type SetupPanelMode, setupHtml } from "./setup-html.ts";
import { inspectSetup, needsSetup, type SetupPreference, setupStateKey } from "./setup-state.ts";
import { installWorkflows, type WorkflowsHarnessInstallResult } from "./workflows-install.ts";
import { harnessVersionRel } from "./workflows-version.ts";

type HarnessDoctorReport = { id: HarnessId; report: NativeDoctorReport };

const panels = new Map<string, WebviewPanel>();
const runningRoots = new Set<string>();
const HARNESS_IDS = new Set(Object.keys(HARNESS_LABELS));
const isOpenFolder = (root: string): boolean =>
  workspace.workspaceFolders?.some((folder) => folder.uri.fsPath === root) ?? false;

/** One setup tab per folder, shared by automatic startup and the Setup command. */
export async function openSetupPanel(context: ExtensionContext, root: string): Promise<void> {
  return openSetupView(context, root, "setup");
}

/** Settings and onboarding share the same installer and presentation. */
export async function openWorkflowsInstallPanel(
  context: ExtensionContext,
  root: string,
): Promise<void> {
  return openSetupView(context, root, "install");
}

async function openSetupView(
  context: ExtensionContext,
  root: string,
  mode: SetupPanelMode,
): Promise<void> {
  if (!isOpenFolder(root)) return;
  const panelKey = `${mode}:${root}`;
  const existing = panels.get(panelKey);
  if (existing) {
    existing.reveal(ViewColumn.One);
    return;
  }
  const panel = window.createWebviewPanel(
    mode === "install" ? "aidlcGuide.workflowsInstall" : "aidlcGuide.setup",
    mode === "install" ? "aidlc-workflows インストール" : "AIDLC Guide セットアップ",
    ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  panels.set(panelKey, panel);
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
  let selected: HarnessId[] = [/cursor/i.test(env.appName) ? "cursor" : "claude"];
  let selectedInitialized = false;
  let logText = "";
  let statusText = "";
  let statusError = false;
  let doctorReport: NativeDoctorReport | null = null;
  let doctorReports: HarnessDoctorReport[] = [];
  let doctorRunning = false;
  let installResults: WorkflowsHarnessInstallResult[] = [];
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
  const showDoctorReport = (report: NativeDoctorReport) => {
    doctorRunning = false;
    doctorReport = report;
    doctorReports = [];
    send({ type: "doctor-report", report });
  };
  const doctorUnavailable = (summary: string, rawOutput = "", version = "不明") => {
    showDoctorReport({
      version,
      executedAt: new Date().toISOString(),
      outcome: "unavailable",
      summary,
      checks: [],
      counts: null,
      rawOutput,
      unparsedOutput: [],
    });
    status(summary, true);
  };
  const render = async () => {
    const state = await inspectSetup(context, root);
    if (!selectedInitialized) {
      const saved =
        state.preference?.harnesses ??
        (state.preference?.harness ? [state.preference.harness] : []);
      const available = saved.filter(
        (id) =>
          HARNESS_IDS.has(id) && (state.harnesses.length === 0 || state.harnesses.includes(id)),
      );
      selected =
        available.length > 0 ? available : state.harnesses.length > 0 ? state.harnesses : selected;
      selectedInitialized = true;
    }
    selected = [...new Set([...selected, ...state.harnesses])];
    if (!disposed)
      panel.webview.html = setupHtml(
        state,
        selected,
        workspace.isTrusted,
        randomBytes(18).toString("hex"),
        mode,
      );
  };
  const dispose = panel.onDidDispose(() => {
    disposed = true;
    cancellation.abort(new Error("プロジェクトの設定を中止しました。"));
    panels.delete(panelKey);
  });
  context.subscriptions.push(panel, dispose);
  const messages = panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (typeof message !== "object" || message === null || disposed || !isOpenFolder(root)) return;
    const msg = message as Record<string, unknown>;
    if (typeof msg.type !== "string") return;
    if (msg.type === "ready") {
      send({
        type: "restore",
        log: logText,
        text: statusText,
        error: statusError,
        doctorReport,
        doctorReports,
        installResults,
      });
      if (doctorRunning) send({ type: "doctor-running" });
      send({ type: "busy", value: busy });
      return;
    }
    if (busy) return;
    if ("harnesses" in msg) {
      if (
        !Array.isArray(msg.harnesses) ||
        msg.harnesses.some((id) => typeof id !== "string" || !HARNESS_IDS.has(id))
      ) {
        status("インストールするツールの選択を確認してください。", true);
        return;
      }
      selected = [...new Set(msg.harnesses)] as HarnessId[];
    }
    if (msg.type === "select-harnesses") return;
    if (msg.type === "docs" || msg.type === "bun-docs") {
      await env.openExternal(
        Uri.parse(msg.type === "docs" ? INSTALL_GUIDE_URL : "https://bun.sh/docs/installation"),
      );
      return;
    }
    if (!["install", "register-mcp", "recheck", "run-doctor", "finish"].includes(msg.type)) return;
    if (mode === "install" && ["register-mcp", "finish"].includes(msg.type)) return;
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
      if (selected.includes("codex") && msg.type === "finish") {
        if (!(await isGitRepository(root, cancellation.signal)))
          throw new Error(CODEX_GIT_REQUIRED);
        if (!canWrite()) return;
      }
      if (msg.type === "install") {
        status("AI-DLC を準備しています…");
        installResults = [];
        send({ type: "install-results", results: installResults });
        const result = await installWorkflows({
          workspaceRoot: root,
          selected,
          log,
          signal: cancellation.signal,
          isCurrent: canWrite,
          onHarnessResult: (entry) => {
            if (!canWrite()) return;
            installResults.push(entry);
            send({ type: "install-results", results: installResults });
            if (entry.doctorReport) showDoctorReport(entry.doctorReport);
          },
        });
        if (!canWrite()) return;
        installResults = result.harnesses;
        status(result.message, !result.ok);
        const failed = result.harnesses
          .filter((entry) => entry.status === "failed")
          .map((entry) => entry.id);
        if (failed.length > 0) selected = failed;
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
      } else if (msg.type === "run-doctor") {
        doctorReport = null;
        doctorReports = [];
        doctorRunning = true;
        send({ type: "doctor-running" });
        status("環境を診断しています…");
        // inspectSetup resolves the project's registered pin, not the machine-active version.
        if (!state.native) {
          doctorUnavailable(
            state.runtimeIssue ??
              "診断に使用する AI-DLC 本体が見つかりません。「AI-DLC を準備する」で本体の導入・設定を確認してください。",
            "",
            state.version ?? "不明",
          );
        } else if (state.harnesses.length > 0) {
          const reports: HarnessDoctorReport[] = [];
          for (const id of new Set(state.harnesses)) {
            status(`${HARNESS_LABELS[id]} の環境を診断しています…`);
            const harnessDir = path.dirname(path.dirname(harnessVersionRel(id)));
            const runner: SetupRunner = (command, args, cwd, env, signal, options) =>
              runSetupProcess(
                command,
                args,
                cwd,
                { ...env, AIDLC_HARNESS_DIR: harnessDir },
                signal,
                options,
              );
            const report = await runNativeDoctor(state.native, root, runner, {
              signal: cancellation.signal,
              isCurrent: canWrite,
            });
            if (!canWrite()) return;
            reports.push({ id, report });
          }
          // Publish only a complete run: a cancelled later tool must not leave an all-clear result.
          doctorRunning = false;
          doctorReports = reports;
          send({ type: "doctor-reports", reports });
          const failed = reports.filter(
            ({ report }) => report.outcome === "failed" || report.outcome === "unavailable",
          );
          const warnings = reports.some(({ report }) => report.outcome === "warning");
          status(
            `${reports.length} 個のツールの診断が完了しました。${
              failed.length > 0
                ? `${failed.map(({ id }) => HARNESS_LABELS[id]).join("、")} の診断結果を確認してください。`
                : warnings
                  ? "確認が必要な項目があります。"
                  : "問題はありません。"
            }`,
            failed.length > 0,
          );
        } else {
          const report = await runNativeDoctor(state.native, root, undefined, {
            signal: cancellation.signal,
            isCurrent: canWrite,
          });
          if (!canWrite()) return;
          showDoctorReport(report);
          status(report.summary, report.outcome === "unavailable" || report.outcome === "failed");
        }
      } else if (msg.type === "recheck") {
        const report = await runDoctor(root, resolveOfficialDocsRoot(context.extensionPath, root));
        if (!canWrite()) return;
        log(report.checks.map((check) => `${check.label}: ${check.detail}`).join("\n"));
        status("現在の設定を確認しました。");
      } else if (msg.type === "finish") {
        if (!state.configured)
          throw new Error("AI-DLC の設定を確認できません。「状態を再確認」で確認してください。");
        if (selected.length === 0 || selected.some((id) => !state.harnesses.includes(id)))
          throw new Error("選択したツールの設定を完了してから、セットアップを終了してください。");
        if (
          !(await savePreference({
            completed: true,
            docsSkipped: !state.docsReady,
            harness: selected[0] ?? state.harnesses[0] ?? "claude",
            harnesses: selected,
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
      if (canWrite() && msg.type === "run-doctor") {
        doctorUnavailable("診断を実行できませんでした。原文で詳細を確認してください。", text);
        return;
      }
      if (!canWrite() && text.includes("rollback-conflict:"))
        void window.showErrorMessage(
          `文書参照の登録を中止しました。途中で変更されたファイルは復元せず保持しています: ${text}`,
        );
      status(text, true);
      log(text);
    } finally {
      doctorRunning = false;
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
