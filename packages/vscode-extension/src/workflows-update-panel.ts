import { randomBytes } from "node:crypto";
import path from "node:path";
import { WORKFLOWS_TARGET_VERSION, type WorkflowsManagementState } from "@aidlc-guide/shared-types";
import { commands, type ExtensionContext, env, Uri, ViewColumn, window, workspace } from "vscode";
import { configureCliEnvironment } from "./cli-environment.ts";
import {
  type CliManagementResult,
  inspectCliManagement,
  updateMachineCli,
} from "./cli-management.ts";
import { HARNESS_LABELS } from "./harness-detect.ts";
import { INSTALL_GUIDE_URL, readNativeInstall } from "./native-setup.ts";
import { escapeSetupText as esc } from "./setup-html.ts";
import type { UpdateProblem } from "./workflows-conflicts.ts";
import { diagnoseInstalledWorkflows } from "./workflows-diagnose.ts";
import { inspectWorkflowsManagement } from "./workflows-management.ts";
import type {
  NativeWorkflowsUpdateResult,
  WorkflowsToolUpdateResult,
} from "./workflows-native-update.ts";
import { workflowsRepairKey } from "./workflows-operation.ts";
import { probeRepairTools, REPAIR_TOOLS, repairWorkflows } from "./workflows-repair.ts";
import { repairPath } from "./workflows-repair-files.ts";
import { repairHtml, repairScript } from "./workflows-repair-html.ts";
import { updateInstalledWorkflows } from "./workflows-update.ts";
import {
  isSnoozedForPin,
  UPDATE_WORKFLOWS_COMMAND,
  WORKFLOWS_SNOOZE_KEY,
} from "./workflows-version.ts";

const isOpenFolder = (root: string): boolean =>
  workspace.workspaceFolders?.some((folder) => folder.uri.fsPath === root) ?? false;

/** Render the nonce-protected update page; diagnostics are inserted as text by its client. */
export function workflowsUpdateHtml(
  state: WorkflowsManagementState,
  nonce: string,
  cli: ReturnType<typeof inspectCliManagement>,
): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<title>AI-DLC の更新</title>
<style nonce="${nonce}">
body { font-family: var(--vscode-font-family, system-ui); color: var(--vscode-foreground); background: var(--vscode-editor-background); line-height: 1.7; padding: 24px; }
main { max-width: 860px; margin: auto; } h1 { font-size: 26px; }
section { margin: 20px 0; padding: 20px; border: 1px solid var(--vscode-panel-border, #8885); border-radius: 8px; }
h2 { margin-top: 0; font-size: 20px; }
a.text-link, button.text-link { background: transparent; color: var(--vscode-textLink-foreground); border: 0; padding: 0; border-radius: 0; text-decoration: none; }
a.text-link:hover, button.text-link:hover { background: transparent; color: var(--vscode-textLink-activeForeground); text-decoration: underline; }
button.text-link:disabled { text-decoration: none; }
table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--vscode-panel-border, #8885); }
button { font: inherit; margin: 12px 8px 0 0; padding: 8px 14px; cursor: pointer; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; border-radius: 4px; }
button:disabled { opacity: .55; cursor: default; } button:focus-visible, a:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; }
.cli-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0 12px; }
.cli-actions button { margin-right: 0; }
.cli-actions #cli-result { margin: 12px 0 0; flex: 1 1 16rem; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--vscode-textCodeBlock-background); padding: 12px; }
code { overflow-wrap: anywhere; } #results { padding-left: 20px; }
</style></head><body><main>
<h1>AI-DLC の更新</h1>
<p>対象プロジェクト：<code>${esc(state.root)}</code></p>
<p>このマシンの CLI と、Git で共有するプロジェクトのエンジンをそれぞれ更新できます。</p>
<section id="cli-section" aria-labelledby="cli-heading" aria-busy="false">
<h2 id="cli-heading">このマシンの AI-DLC CLI</h2>
<p>このマシンの CLI と実行用ランタイムを更新します。リポジトリのファイルは変更しません。</p>
<p>マシンの既定バージョン：<strong id="cli-current">${esc(cli.machineVersion ?? "未インストール")}</strong> ／ 実行環境の対象バージョン：<strong>${esc(cli.target)}</strong></p>
<p>プロジェクトの固定バージョン：<code id="project-pin">${esc(state.projectPin ?? "指定なし")}</code>。固定バージョンがあるプロジェクトは、そのバージョンを引き続き使用します。</p>
<p id="cli-state" role="status">${esc(cli.updateMessage)}</p>
<div class="cli-actions">
<button id="update-cli"${cli.canUpdate ? "" : " disabled"}>CLI を更新</button>
<p id="cli-result" role="status" aria-live="polite"></p>
</div>
</section>
<section aria-labelledby="project-heading">
<h2 id="project-heading">プロジェクトのエンジン</h2>
<p>設定済みのすべてのツールのエンジン・設定と <code>.aidlc-version</code> を ${esc(state.target)} に揃えます。変更内容は Git の差分で確認し、チームに共有してください。</p>
<p>チーム・プロジェクトの設定とワークフローの成果物は保持します。進行中のワークフローがある場合は、完了してから実行してください。</p>
<table><caption>更新対象のツール</caption><thead><tr><th scope="col">ツール</th><th scope="col">現在</th><th scope="col">更新後</th></tr></thead><tbody id="tools">${state.tools.map((tool) => `<tr><td>${esc(tool.label)}</td><td>${esc(tool.version ?? "確認が必要")}</td><td>${esc(state.target)}</td></tr>`).join("")}</tbody></table>
<p id="state" role="status">${esc(state.message)}</p>
<p id="runtime-required"${state.canUpdate && (!cli.targetInstalled || !cli.launcherReady) ? "" : " hidden"}>先に「CLI を更新」で ${esc(state.target)} の実行環境を準備してください。</p>
<button id="apply"${state.canUpdate && cli.targetInstalled && cli.launcherReady ? "" : " disabled"}>プロジェクトのエンジンを更新</button>
<button type="button" class="text-link" id="doctor"${state.tools.length > 0 ? "" : " disabled"}>Doctor を再実行</button>
<button type="button" class="text-link" id="install">利用するツールを追加</button>
<ul id="results" aria-label="ツールごとの更新結果" aria-live="polite"></ul>
<p id="result" role="status"></p>
<details id="repair-details"><summary>更新前の問題を診断・修正</summary>${repairHtml}</details>
</section>
<section aria-labelledby="extension-heading"><h2 id="extension-heading">AIDLC Guide 拡張機能</h2>
<p>新しい AI-DLC のバージョンに対応した拡張機能を確認します。</p><button type="button" class="text-link" id="extension-update">拡張機能の更新を確認</button></section>
<button type="button" class="text-link" id="refresh">状態を再確認</button><button type="button" class="text-link" id="setup">セットアップを開く</button><a class="text-link" id="docs" href="${esc(INSTALL_GUIDE_URL)}">公式手順を開く</a>
<details><summary>実行ログ</summary><pre id="log"></pre></details>
</main><script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let busy = false;
let busyScope = '';
let canUpdate = ${state.canUpdate};
let cliCanUpdate = ${cli.canUpdate};
let targetInstalled = ${cli.targetInstalled && cli.launcherReady};
let hasTools = ${state.tools.length > 0};
const apply = document.getElementById('apply');
const cliResult = document.getElementById('cli-result');
function setCliProgress(text) { cliResult.textContent = text; }
function buttons() {
  apply.disabled = busy || !canUpdate || !targetInstalled;
  document.getElementById('update-cli').disabled = busy || !cliCanUpdate;
  document.getElementById('doctor').disabled = busy || !hasTools;
  for (const id of ['refresh', 'install', 'setup', 'extension-update']) document.getElementById(id).disabled = busy;
  document.getElementById('runtime-required').hidden = !canUpdate || targetInstalled;
  document.getElementById('cli-section').setAttribute('aria-busy', String(busy && busyScope === 'cli'));
  repairButtons();
}
for (const id of ['apply', 'update-cli', 'doctor']) document.getElementById(id).addEventListener('click', () => {
  busy = true;
  busyScope = id === 'update-cli' ? 'cli' : 'project';
  if (id === 'update-cli') setCliProgress('更新中…');
  buttons();
  vscode.postMessage({ type: id });
});
for (const id of ['refresh', 'install', 'setup', 'extension-update', 'docs']) document.getElementById(id).addEventListener('click', (event) => {
  if (event.currentTarget instanceof HTMLAnchorElement) event.preventDefault();
  vscode.postMessage({ type: id });
});
window.addEventListener('message', ({ data: msg }) => {
  if (msg.type === 'log') {
    document.getElementById('log').textContent += msg.line + '\\n';
    if (busyScope === 'cli') {
      const lines = String(msg.line).split('\\n').map(line => line.trim()).filter(Boolean);
      setCliProgress(lines[lines.length - 1] || '更新中…');
    }
  }
  if (msg.type === 'state') {
    canUpdate = msg.state.canUpdate;
    hasTools = msg.state.tools.length > 0;
    document.getElementById('state').textContent = msg.state.message;
    document.getElementById('project-pin').textContent = msg.state.projectPin || '指定なし';
    const rows = msg.state.tools.map(tool => {
      const row = document.createElement('tr');
      for (const value of [tool.label, tool.version || '確認が必要', msg.state.target]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      return row;
    });
    document.getElementById('tools').replaceChildren(...rows); buttons();
  }
  if (msg.type === 'cli-state') {
    cliCanUpdate = msg.state.canUpdate;
    targetInstalled = msg.state.targetInstalled && msg.state.launcherReady;
    document.getElementById('cli-current').textContent = msg.state.machineVersion || '未インストール';
    document.getElementById('cli-state').textContent = msg.state.updateMessage;
    buttons();
  }
  if (msg.type === 'results') document.getElementById('results').replaceChildren(...msg.results.map(result => {
    const item = document.createElement('li'); item.textContent = result.label + '：' + result.message; return item;
  }));
  if (msg.type === 'problems' && msg.problems.length) document.getElementById('repair-details').open = true;
  if (msg.type === 'done') {
    busy = false;
    busyScope = '';
    document.getElementById(msg.scope === 'cli' ? 'cli-result' : 'result').textContent = msg.message;
    buttons();
  }
  if (msg.type === 'reset') {
    document.getElementById('log').textContent = '';
    if (msg.scope === 'cli') setCliProgress('更新中…');
    else document.getElementById('result').textContent = '';
  }
});
${repairScript}
vscode.postMessage({ type: 'ready' });
</script></body></html>`;
}

export function workflowsUpdateMessage(
  result: NativeWorkflowsUpdateResult,
  entries: WorkflowsToolUpdateResult[],
): string {
  const message = workflowsUpdateBaseMessage(result, entries);
  if (result.recovery === "failed")
    return `${message} 以前のバージョンへの復元にも失敗しました。現在の .aidlc-version と CLI のバージョンを実行ログ・公式手順で確認し、復元してから再実行してください。`;
  if (result.recovery === "restored")
    return `${message} 更新前のバージョンへの復元を確認しました。`;
  return message;
}

function workflowsUpdateBaseMessage(
  result: NativeWorkflowsUpdateResult,
  entries: WorkflowsToolUpdateResult[],
): string {
  if (result.ok)
    return "プロジェクトのエンジン・固定バージョンの更新と Doctor の確認が完了しました。Git の差分を確認して共有してください。";
  if (result.reason === "doctor")
    return "設定反映済み・診断未完了です。実行ログの診断内容を確認し、対処後に「Doctor を再実行」を選んでください。";
  if (result.reason === "runtime-required")
    return "プロジェクトの更新は未実行です。先に「CLI を更新」で必要な実行環境を準備してください。";
  if (result.reason === "previous-runtime-required")
    return "更新前に停止しました。失敗時に以前の固定バージョンへ戻すための実行環境がありません。実行ログに示された旧固定バージョンの CLI を公式手順で復元してから再実行してください。プロジェクトの設定は変更していません。";
  if (result.reason === "pin-failed")
    return "プロジェクトの固定バージョンの設定に失敗しました。ツールのエンジンは未更新です。実行ログと .aidlc-version を確認してください。";
  if (result.reason === "preflight")
    return "更新前の確認で停止しました。ツールのエンジンは未更新です。下の問題と実行ログを確認し、対処後に更新を再実行してください。";
  if (result.reason === "busy")
    return "別のインストールまたは更新が実行中です。処理が終わってから再実行してください。";
  if (result.reason === "verification" || result.reason === "runtime-verification")
    return "ファイル更新後のバージョン確認に失敗しました。適用済みの範囲と実行ログを確認し、状態を再確認してください。";
  const applied = entries.filter((entry) => entry.status === "completed").length;
  const failed = entries.filter((entry) => entry.status === "failed").length;
  const pending = entries.filter((entry) => entry.status === "pending").length;
  return `更新は完了していません。設定反映済み ${applied} 件、失敗 ${failed} 件、未実行 ${pending} 件。失敗した処理にも変更が残っている場合があります。ツールごとの結果と実行ログ、Git の差分を確認してから再実行してください。`;
}

export function cliUpdateMessage(result: CliManagementResult): string {
  if (result.ok) return result.message;
  const stages = {
    preflight: "更新前の確認",
    install: "CLI の導入",
    activate: "CLI の切り替え",
    register: "固定バージョンの登録",
    verify: "更新後の検証",
    restore: "既定バージョンの復元",
    complete: "完了確認",
  };
  const applied = result.applied
    ? "マシンに変更が残っている場合があります。"
    : "変更は未適用です。";
  const recovery =
    result.recovery === "restored"
      ? "以前の既定バージョンに戻しました。"
      : result.recovery === "failed"
        ? "既定バージョンの復元にも失敗しました。"
        : "";
  return `${stages[result.stage]}で停止しました。${result.message} ${applied}${recovery} ${result.nextAction}`;
}

/** Bind update and repair actions to the selected trusted workspace, never a webview-supplied root. */
export async function openWorkflowsUpdatePanel(
  context: ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  if (!workspace.isTrusted || !isOpenFolder(workspaceRoot)) {
    void window.showErrorMessage("更新対象のワークスペースを開き、信頼してから実行してください。");
    return;
  }
  const repairKey = workflowsRepairKey(workspaceRoot);
  const needsRepair = () => context.workspaceState.get<boolean>(repairKey) === true;
  const inspect = () => inspectWorkflowsManagement(workspaceRoot, needsRepair());
  const panel = window.createWebviewPanel(
    "aidlcGuide.updateWorkflows",
    "AI-DLC の更新",
    ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  panel.webview.html = workflowsUpdateHtml(
    inspect(),
    randomBytes(18).toString("hex"),
    inspectCliManagement(workspaceRoot),
  );
  let disposed = false;
  let busy = false;
  let validFolder = true;
  const cancellation = new AbortController();
  const folderSubscription = workspace.onDidChangeWorkspaceFolders?.(() => {
    if (!isOpenFolder(workspaceRoot)) {
      validFolder = false;
      panel.dispose();
    }
  });
  // Closing the UI cancels forward work but still permits rollback in an open, trusted folder.
  const canRestore = () => validFolder && workspace.isTrusted && isOpenFolder(workspaceRoot);
  const isCurrent = () => !disposed && canRestore();
  const send = (message: unknown) => {
    if (!disposed) void panel.webview.postMessage(message);
  };
  const refresh = () => {
    if (!isCurrent()) return;
    send({ type: "state", state: inspect() });
    send({ type: "cli-state", state: inspectCliManagement(workspaceRoot) });
  };
  const results = new Map<string, WorkflowsToolUpdateResult>();
  let problems: UpdateProblem[] = [];
  let repairCancellation: AbortController | undefined;
  const showProblems = (entries: UpdateProblem[], message?: string) => {
    problems = entries;
    send({
      type: "problems",
      problems: entries.map((p) => ({ ...p, label: HARNESS_LABELS[p.harness] })),
      message,
    });
  };
  panel.onDidDispose(() => {
    disposed = true;
    cancellation.abort();
    repairCancellation?.abort();
    folderSubscription?.dispose();
  });
  panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (!message || typeof message !== "object" || !isCurrent()) return;
    const { type } = message as { type?: unknown };
    if (type === "cancel-repair") {
      repairCancellation?.abort();
      return;
    }
    if (type === "docs") {
      await env.openExternal(Uri.parse(INSTALL_GUIDE_URL));
      return;
    }
    if (busy) return;
    if (type === "copy-diagnosis") {
      await env.clipboard.writeText(
        JSON.stringify({ target: WORKFLOWS_TARGET_VERSION, problems }, null, 2),
      );
      return;
    }
    if (type === "problem-file") {
      const index = (message as { index?: unknown }).index;
      if (
        typeof index !== "number" ||
        !Number.isInteger(index) ||
        !problems[index] ||
        problems[index].path === "設定全体"
      )
        return;
      try {
        const document = await workspace.openTextDocument(
          Uri.file(repairPath(workspaceRoot, problems[index].path)),
        );
        await window.showTextDocument(document, { preview: true });
      } catch {
        void window.showErrorMessage("対象ファイルを開けません。診断情報を確認してください。");
      }
      return;
    }
    if (type === "diagnose" || type === "repair" || type === "probe-tools") {
      busy = true;
      repairCancellation = new AbortController();
      try {
        if (type === "probe-tools") {
          send({ type: "repair-tools", tools: await probeRepairTools() });
          send({ type: "repair-done", message: "CLI の確認が完了しました。" });
          return;
        }
        const tool = (message as { tool?: unknown }).tool;
        if (type === "repair" && !REPAIR_TOOLS.some((candidate) => candidate === tool))
          throw new Error("修正に使うハーネスを選択してください。");
        if (type === "repair") await context.workspaceState.update(repairKey, true);
        const result = await repairWorkflows({
          root: workspaceRoot,
          backupParent: path.join(context.globalStorageUri.fsPath, "update-backups"),
          signal: AbortSignal.any([cancellation.signal, repairCancellation.signal]),
          isCurrent,
          log: (line) => send({ type: "log", line }),
          ...(type === "repair" ? { tool: tool as (typeof REPAIR_TOOLS)[number] } : {}),
        });
        showProblems(result.problems, result.message);
        send({
          type: "repair-done",
          message: result.message + (result.backup ? ` バックアップ: ${result.backup}` : ""),
          ready: result.problems.length === 0,
        });
      } catch (error) {
        send({
          type: "repair-done",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        busy = false;
        repairCancellation = undefined;
        refresh();
      }
      return;
    }
    if (type === "install") {
      await commands.executeCommand("aidlc-guide.installWorkflows", workspaceRoot);
      return;
    }
    if (type === "setup") {
      await commands.executeCommand("aidlc-guide.setup", workspaceRoot);
      return;
    }
    if (type === "extension-update") {
      await commands.executeCommand("aidlc-guide.checkUpdate");
      return;
    }
    if (type === "ready" || type === "refresh") {
      refresh();
      return;
    }
    if (type === "update-cli" || type === "doctor") {
      busy = true;
      const scope = type === "update-cli" ? "cli" : "project";
      send({ type: "reset", scope });
      try {
        if (type === "update-cli") {
          const result = await updateMachineCli({
            workspaceRoot,
            isCurrent,
            signal: cancellation.signal,
            log: (line) => send({ type: "log", line }),
          });
          const runtime = result.ok && isCurrent() ? readNativeInstall() : null;
          if (runtime) configureCliEnvironment(context, runtime);
          send({ type: "done", scope, message: cliUpdateMessage(result) });
        } else {
          results.clear();
          send({ type: "results", results: [] });
          const result = await diagnoseInstalledWorkflows({
            workspaceRoot,
            isCurrent,
            signal: cancellation.signal,
            log: (line) => send({ type: "log", line }),
            setNeedsRepair: async (value) => {
              await context.workspaceState.update(repairKey, value);
            },
            onHarnessResult: (entry) => {
              results.set(entry.id, entry);
              send({
                type: "results",
                results: [...results.values()].map((item) => ({
                  ...item,
                  label: HARNESS_LABELS[item.id],
                })),
              });
            },
          });
          send({ type: "done", scope, message: result.message });
        }
      } catch (cause) {
        send({
          type: "done",
          scope,
          message: `処理の完了を確認できません。状態を再確認してください：${cause instanceof Error ? cause.message : String(cause)}`,
        });
      } finally {
        busy = false;
        refresh();
      }
      return;
    }
    if (type !== "apply") return;
    busy = true;
    results.clear();
    send({ type: "reset" });
    send({ type: "results", results: [] });
    try {
      const result = await updateInstalledWorkflows({
        workspaceRoot,
        isCurrent,
        canRestore,
        signal: cancellation.signal,
        needsRepair: needsRepair(),
        setNeedsRepair: async (value) => {
          await context.workspaceState.update(repairKey, value);
        },
        log: (line) => send({ type: "log", line }),
        onHarnessResult: (entry) => {
          results.set(entry.id, entry);
          send({
            type: "results",
            results: [...results.values()].map((item) => ({
              ...item,
              label: HARNESS_LABELS[item.id],
            })),
          });
        },
      });
      if (result.problems) showProblems(result.problems);
      else if (result.ok) showProblems([], "すべての問題を解消し、更新が完了しました。");
      send({
        type: "done",
        message: workflowsUpdateMessage(result, [...results.values()]),
      });
    } catch (cause) {
      send({
        type: "done",
        message: `更新に失敗しました：${cause instanceof Error ? cause.message : String(cause)}`,
      });
    } finally {
      busy = false;
      refresh();
    }
  });
}

const promptJobs = new Map<string, { job: Promise<void>; isCurrent: () => boolean }>();
export async function maybePromptWorkflowsUpdate(
  context: ExtensionContext,
  workspaceRoot: string,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  if (!isCurrent()) return;
  const previous = promptJobs.get(workspaceRoot);
  if (previous?.isCurrent()) return previous.job;
  const job = promptOnce(context, workspaceRoot, isCurrent);
  promptJobs.set(workspaceRoot, { job, isCurrent });
  try {
    await job;
  } finally {
    if (promptJobs.get(workspaceRoot)?.job === job) promptJobs.delete(workspaceRoot);
  }
}

async function promptOnce(
  context: ExtensionContext,
  root: string,
  isCurrent: () => boolean,
): Promise<void> {
  if (!isCurrent() || !workspace.isTrusted || !isOpenFolder(root)) return;
  const state = inspectWorkflowsManagement(
    root,
    context.workspaceState.get<boolean>(workflowsRepairKey(root)) === true,
  );
  if (
    !state.canUpdate ||
    isSnoozedForPin(context.workspaceState.get(WORKFLOWS_SNOOZE_KEY), WORKFLOWS_TARGET_VERSION)
  )
    return;
  const pick = await window.showInformationMessage(
    `AIDLC Guide: 設定済みの全ツールを aidlc-workflows ${WORKFLOWS_TARGET_VERSION} に更新できます。`,
    "アップデートする",
    "後で",
  );
  if (!isCurrent() || !workspace.isTrusted || !isOpenFolder(root)) return;
  if (pick === "後で")
    await context.workspaceState.update(WORKFLOWS_SNOOZE_KEY, WORKFLOWS_TARGET_VERSION);
  if (pick === "アップデートする") await openWorkflowsUpdatePanel(context, root);
}

export { UPDATE_WORKFLOWS_COMMAND };
