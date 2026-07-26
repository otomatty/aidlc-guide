import { type ExtensionContext, ViewColumn, type WebviewPanel, window } from "vscode";
import type { DoctorReport } from "./doctor.ts";
import { runDoctor } from "./doctor.ts";
import { isMcpRegistered, mcpScriptPath, registerMcp } from "./mcp-register.ts";

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
  <p class="${report.ready ? "ok" : "warn"}">${report.ready ? "ワークスペースは読取可能です。" : "aidlc/ と有効な Intent（active-intent、またはレコードが1件だけの lone-intent）を先に用意してください。"}</p>
  <p>MCP: ${mcpDone ? "✔ .mcp.json に登録済み" : "未登録 — 下のボタンで追加"}</p>
  <button id="register-mcp">MCP をこのワークスペースに登録</button>
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

async function renderSetup(
  panel: WebviewPanel,
  workspaceRoot: string,
): Promise<void> {
  const report = await runDoctor(workspaceRoot);
  const mcpDone = await isMcpRegistered(workspaceRoot);
  panel.webview.html = setupHtml(report, mcpDone);
}

export async function openSetupPanel(
  context: ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const panel = window.createWebviewPanel("aidlcGuide.setup", "AIDLC Guide Setup", ViewColumn.One, {
    enableScripts: true,
  });

  await renderSetup(panel, workspaceRoot);

  panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (typeof message !== "object" || message === null) return;
    const msg = message as Record<string, unknown>;

    if (msg.type === "recheck") {
      await renderSetup(panel, workspaceRoot);
      return;
    }

    if (msg.type === "register-mcp") {
      const result = await registerMcp(workspaceRoot, mcpScriptPath(context.extensionPath));
      if (result.ok) {
        await context.workspaceState.update("aidlc-guide.setupDone", true);
        await renderSetup(panel, workspaceRoot);
        void window.showInformationMessage("AIDLC Guide MCP を .mcp.json に登録しました。");
      } else {
        void window.showErrorMessage(`MCP 登録に失敗: ${result.reason}`);
      }
      return;
    }

    if (msg.type === "open-dashboard") {
      await context.workspaceState.update("aidlc-guide.setupDone", true);
      const { openDashboardPanel } = await import("./dashboard-panel.ts");
      openDashboardPanel(context, workspaceRoot);
      panel.dispose();
    }
  });
}

export async function maybePromptSetup(
  context: ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const done = context.workspaceState.get<boolean>("aidlc-guide.setupDone", false);
  if (done) return;
  const mcp = await isMcpRegistered(workspaceRoot);
  if (mcp) {
    await context.workspaceState.update("aidlc-guide.setupDone", true);
    return;
  }
  const pick = await window.showInformationMessage(
    "AIDLC Guide: 初回セットアップ（MCP 登録・前提チェック）を実行しますか？",
    "Setup",
    "後で",
  );
  if (pick === "Setup") await openSetupPanel(context, workspaceRoot);
}
