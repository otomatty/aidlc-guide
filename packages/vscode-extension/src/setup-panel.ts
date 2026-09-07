import { type ExtensionContext, ViewColumn, type WebviewPanel, window } from "vscode";
import type { DoctorReport } from "./doctor.ts";
import { runDoctor } from "./doctor.ts";
import {
  docsSkillPath,
  mcpScriptPath,
  refreshDocsRegistration,
  registerMcp,
} from "./mcp-register.ts";
import { resolveOfficialDocsRoot } from "./official-docs-root.ts";

/** Render prerequisite results and combined MCP/Skill readiness for the setup webview. */
function setupHtml(report: DoctorReport, mcpDone: boolean): string {
  const rows = report.checks
    .map((c) => `<tr><td>${c.ok ? "✔" : "✖"}</td><td>${c.label}</td><td>${c.detail}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>AIDLC Guide Setup</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 1rem 1.25rem; line-height: 1.5; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    td, th { border: 1px solid #8884; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
    button { margin: 0.25rem 0.5rem 0.25rem 0; padding: 0.4rem 0.8rem; cursor: pointer; }
    .ok { color: #2a7; }
    .warn { color: #c80; }
  </style>
</head>
<body>
  <h1>AIDLC Guide — Setup</h1>
  <p>初回セットアップ。完了後は <strong>AIDLC Guide: Open</strong> だけで Dashboard を開けます。</p>
  <table>
    <thead><tr><th></th><th>項目</th><th>状態</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="${report.ready ? "ok" : "warn"}">${report.ready ? "ワークスペースは読取可能です。" : "aidlc/ と Intent レコード（1件以上）を先に用意してください。"}</p>
  <p>MCP・文書参照 Skill: ${mcpDone ? "✔ 両クライアントに登録済み" : "追加・更新が必要 — 下のボタンで登録"}</p>
  <button id="register-mcp">MCP と文書参照 Skill を登録</button>
  <p>AI-DLC の質問で内蔵文書を参照し、出典付きで回答します。Claude Code / Cursor 用の Skill を追加します。</p>
  <button id="recheck">再チェック</button>
  <button id="open-dashboard">Dashboard を開く</button>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('register-mcp').addEventListener('click', () => {
      vscode.postMessage({ type: 'register-mcp' });
    });
    document.getElementById('recheck').addEventListener('click', () => {
      vscode.postMessage({ type: 'recheck' });
    });
    document.getElementById('open-dashboard').addEventListener('click', () => {
      vscode.postMessage({ type: 'open-dashboard' });
    });
  </script>
</body>
</html>`;
}

/** Inspect prerequisites and registrations without migrating files, then refresh the panel. */
async function renderSetup(
  panel: WebviewPanel,
  workspaceRoot: string,
  docsRoot: string,
  extensionPath: string,
): Promise<void> {
  const report = await runDoctor(workspaceRoot, docsRoot);
  const { complete: mcpDone } = await refreshDocsRegistration(
    workspaceRoot,
    mcpScriptPath(extensionPath),
    docsSkillPath(extensionPath),
    false,
  );
  panel.webview.html = setupHtml(report, mcpDone);
}

/** Open setup actions for explicit registration, rechecking and dashboard navigation. */
export async function openSetupPanel(
  context: ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const panel = window.createWebviewPanel("aidlcGuide.setup", "AIDLC Guide Setup", ViewColumn.One, {
    enableScripts: true,
  });

  const docsRoot = resolveOfficialDocsRoot(context.extensionPath, workspaceRoot);
  await renderSetup(panel, workspaceRoot, docsRoot, context.extensionPath);

  panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (typeof message !== "object" || message === null) return;
    const msg = message as Record<string, unknown>;

    if (msg.type === "recheck") {
      await renderSetup(panel, workspaceRoot, docsRoot, context.extensionPath);
      return;
    }

    if (msg.type === "register-mcp") {
      const result = await registerMcp(
        workspaceRoot,
        mcpScriptPath(context.extensionPath),
        docsSkillPath(context.extensionPath),
      );
      if (result.ok) {
        await context.workspaceState.update("aidlc-guide.setupDone", true);
        await renderSetup(panel, workspaceRoot, docsRoot, context.extensionPath);
        void window.showInformationMessage(
          "MCP と文書参照 Skill を登録しました。AI セッションを再起動してください。",
        );
      } else {
        void window.showErrorMessage(`MCP 登録に失敗: ${result.reason}`);
      }
      return;
    }

    if (msg.type === "open-dashboard") {
      const { openDashboardPanel } = await import("./dashboard-panel.ts");
      openDashboardPanel(context, workspaceRoot);
      panel.dispose();
    }
  });
}

/** Recheck registrations even for users who completed or skipped an older setup. */
export async function maybePromptSetup(
  context: ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const status = await refreshDocsRegistration(
    workspaceRoot,
    mcpScriptPath(context.extensionPath),
    docsSkillPath(context.extensionPath),
  );
  await context.workspaceState.update("aidlc-guide.setupDone", status.complete);
  if (status.updated)
    void window.showInformationMessage(
      "AIDLC Guide: 登録済み MCP・文書参照 Skill を現行版へ更新しました。AI セッションを再起動してください。",
    );
  if (status.complete) return;
  const pick = await window.showInformationMessage(
    "AIDLC Guide: MCP・文書参照 Skill の追加または更新が必要です。セットアップを開きますか？",
    "Setup",
    "後で",
  );
  if (pick === "Setup") await openSetupPanel(context, workspaceRoot);
}
