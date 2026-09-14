import { randomBytes } from "node:crypto";
import { WORKFLOWS_TARGET_VERSION, type WorkflowsManagementState } from "@aidlc-guide/shared-types";
import { commands, type ExtensionContext, env, Uri, ViewColumn, window, workspace } from "vscode";
import { HARNESS_LABELS } from "./harness-detect.ts";
import { INSTALL_GUIDE_URL } from "./native-setup.ts";
import { escapeSetupText as esc } from "./setup-html.ts";
import { inspectWorkflowsManagement } from "./workflows-management.ts";
import type { WorkflowsToolUpdateResult } from "./workflows-native-update.ts";
import { workflowsRepairKey } from "./workflows-operation.ts";
import { updateInstalledWorkflows } from "./workflows-update.ts";
import {
  isSnoozedForPin,
  UPDATE_WORKFLOWS_COMMAND,
  WORKFLOWS_SNOOZE_KEY,
} from "./workflows-version.ts";

const isOpenFolder = (root: string): boolean =>
  workspace.workspaceFolders?.some((folder) => folder.uri.fsPath === root) ?? false;

export function workflowsUpdateHtml(state: WorkflowsManagementState, nonce: string): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<title>aidlc-workflows を更新</title>
<style nonce="${nonce}">
body { font-family: var(--vscode-font-family, system-ui); color: var(--vscode-foreground); background: var(--vscode-editor-background); line-height: 1.7; padding: 24px; }
main { max-width: 860px; margin: auto; } h1 { font-size: 26px; }
table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--vscode-panel-border, #8885); }
button { font: inherit; margin: 12px 8px 0 0; padding: 8px 14px; cursor: pointer; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; border-radius: 4px; }
button:disabled { opacity: .55; cursor: default; } button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--vscode-textCodeBlock-background); padding: 12px; }
code { overflow-wrap: anywhere; } #results { padding-left: 20px; }
</style></head><body><main>
<h1>aidlc-workflows を更新</h1>
<p>対象プロジェクト：<code>${esc(state.root)}</code></p>
<p>導入バージョン：<strong>${esc(state.target)}</strong></p>
<p>このプロジェクトに設定済みのすべてのツールを更新します。ツールの追加はインストール画面から行えます。</p>
<p>チーム・プロジェクトの設定とワークフローの成果物は保持します。進行中のワークフローがある場合は、完了してから実行してください。</p>
<table><caption>更新対象のツール</caption><thead><tr><th scope="col">ツール</th><th scope="col">現在</th><th scope="col">更新後</th></tr></thead><tbody id="tools">${state.tools.map((tool) => `<tr><td>${esc(tool.label)}</td><td>${esc(tool.version ?? "確認が必要")}</td><td>${esc(state.target)}</td></tr>`).join("")}</tbody></table>
<p id="state" role="status">${esc(state.message)}</p>
<button id="apply"${state.canUpdate ? "" : " disabled"}>すべてのツールを ${esc(state.target)} に更新</button>
<button id="refresh">状態を再確認</button><button id="install">インストール・ツール追加</button><button id="docs">公式手順を開く</button>
<ul id="results" aria-label="ツールごとの更新結果" aria-live="polite"></ul>
<p id="result" role="status"></p><details><summary>実行ログ</summary><pre id="log"></pre></details>
</main><script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let busy = false;
let canUpdate = ${state.canUpdate};
const apply = document.getElementById('apply');
function buttons() {
  apply.disabled = busy || !canUpdate;
  document.getElementById('refresh').disabled = busy;
  document.getElementById('install').disabled = busy;
}
apply.addEventListener('click', () => { busy = true; buttons(); vscode.postMessage({ type: 'apply' }); });
for (const id of ['refresh', 'install', 'docs']) document.getElementById(id).addEventListener('click', () => vscode.postMessage({ type: id }));
window.addEventListener('message', ({ data: msg }) => {
  if (msg.type === 'log') document.getElementById('log').textContent += msg.line + '\\n';
  if (msg.type === 'state') {
    canUpdate = msg.state.canUpdate;
    document.getElementById('state').textContent = msg.state.message;
    const rows = msg.state.tools.map(tool => {
      const row = document.createElement('tr');
      for (const value of [tool.label, tool.version || '確認が必要', msg.state.target]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      return row;
    });
    document.getElementById('tools').replaceChildren(...rows); buttons();
  }
  if (msg.type === 'results') document.getElementById('results').replaceChildren(...msg.results.map(result => {
    const item = document.createElement('li'); item.textContent = result.label + '：' + result.message; return item;
  }));
  if (msg.type === 'done') { busy = false; document.getElementById('result').textContent = msg.message; buttons(); }
  if (msg.type === 'reset') { document.getElementById('log').textContent = ''; document.getElementById('result').textContent = ''; }
});
vscode.postMessage({ type: 'ready' });
</script></body></html>`;
}

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
    "aidlc-workflows を更新",
    ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  panel.webview.html = workflowsUpdateHtml(inspect(), randomBytes(18).toString("hex"));
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
  const results = new Map<string, WorkflowsToolUpdateResult>();
  panel.onDidDispose(() => {
    disposed = true;
    cancellation.abort();
    folderSubscription?.dispose();
  });
  panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (!message || typeof message !== "object" || !isCurrent()) return;
    const { type } = message as { type?: unknown };
    if (type === "docs") {
      await env.openExternal(Uri.parse(INSTALL_GUIDE_URL));
      return;
    }
    if (busy) return;
    if (type === "install") {
      await commands.executeCommand("aidlc-guide.installWorkflows", workspaceRoot);
      return;
    }
    if (type === "ready" || type === "refresh") {
      send({ type: "state", state: inspect() });
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
      send({
        type: "done",
        message: result.ok
          ? "すべてのツールと固定版の確認が完了しました。"
          : "更新は完了していません。結果とログを確認し、問題の解消後に再実行してください。",
      });
    } catch (cause) {
      send({
        type: "done",
        message: `更新に失敗しました：${cause instanceof Error ? cause.message : String(cause)}`,
      });
    } finally {
      busy = false;
      if (isCurrent()) send({ type: "state", state: inspect() });
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
