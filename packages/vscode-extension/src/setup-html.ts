import { HARNESS_LABELS, type HarnessId } from "./harness-detect.ts";
import { SETUP_RELEASE } from "./native-setup.ts";
import type { SetupSnapshot } from "./setup-state.ts";

export function escapeSetupText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function setupHtml(
  state: SetupSnapshot,
  selected: HarnessId,
  trusted: boolean,
  nonce: string,
): string {
  const esc = escapeSetupText;
  const ready = state.configured;
  const options = Object.entries(HARNESS_LABELS)
    .map(
      ([id, label]) =>
        `<option value="${id}"${id === selected ? " selected" : ""}>${label}</option>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<title>AIDLC Guide セットアップ</title>
<style nonce="${nonce}">
  * { box-sizing: border-box; }
  body { margin: 0; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family, system-ui); font-size: 14px; line-height: 1.7; }
  main { max-width: 860px; margin: 0 auto; padding: 48px 28px 40px; }
  .eyebrow { color: var(--vscode-descriptionForeground); font-size: 12px; letter-spacing: .14em; }
  h1 { margin: 10px 0; font-size: clamp(26px, 4vw, 36px); font-weight: 600; letter-spacing: -.025em; line-height: 1.35; }
  h2 { margin: 0; font-size: 17px; font-weight: 600; }
  p { margin: 8px 0 16px; }
  .muted, .description { color: var(--vscode-descriptionForeground); }
  .workspace { margin: 24px 0 28px; padding: 12px 16px; border-left: 3px solid var(--vscode-focusBorder); background: var(--vscode-textBlockQuote-background); }
  .workspace code { display: block; overflow-wrap: anywhere; }
  .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
  .card { border: 1px solid var(--vscode-panel-border, #8885); border-radius: 10px; padding: 24px; }
  .card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .number { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size: 12px; }
  .badge { margin-left: auto; color: var(--vscode-descriptionForeground); font-size: 12px; }
  .success { color: var(--vscode-testing-iconPassed, #388a34); }
  label { display: block; font-weight: 600; margin: 14px 0 6px; }
  select { width: 100%; max-width: 360px; color: var(--vscode-dropdown-foreground); background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border, #8886); border-radius: 4px; padding: 9px 12px; font: inherit; }
  .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 18px; }
  button { font: inherit; cursor: pointer; border: 1px solid transparent; border-radius: 4px; padding: 9px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button:disabled, select:disabled { opacity: .55; cursor: default; }
  button:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; }
  .note { padding: 12px 16px; border: 1px solid var(--vscode-editorWarning-foreground, #b88); border-radius: 6px; }
  #status { margin: 20px 0 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
  #status.error { color: var(--vscode-errorForeground); }
  details { margin: 12px 0; }
  summary { cursor: pointer; }
  pre { max-height: 300px; overflow: auto; padding: 14px; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--vscode-textCodeBlock-background); font-size: 12px; }
  footer { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-top: 24px; flex-wrap: wrap; }
  .start-command { display: block; padding: 12px; background: var(--vscode-textCodeBlock-background); border-radius: 4px; overflow-wrap: anywhere; }
  @media (max-width: 540px) { main { padding: 24px 16px; } .card { padding: 18px; } .actions button { width: 100%; } }
</style></head><body><main>
<div class="eyebrow">AIDLC GUIDE / GET STARTED</div>
<h1>${ready ? "AI-DLC を使い始めましょう" : "開発を始める準備をしましょう"}</h1>
<p class="description">このプロジェクトで AI-DLC を使うための設定を行います。進捗や成果物は、設定後にダッシュボードで確認できます。</p>
<div class="workspace"><span class="muted">設定するフォルダ</span><code>${esc(state.root)}</code></div>
${trusted ? "" : '<p class="note">このワークスペースは制限モードです。設定を実行するには、VS Code のワークスペースの信頼を確認してください。</p>'}
<ol class="steps">
<li class="card"><div class="card-head"><span class="number">1</span><h2>AI-DLC を準備する</h2><span class="badge ${ready ? "success" : ""}">${ready ? "設定済み" : "設定が必要"}</span></div>
<p class="description">公式インストーラーで本体を導入し、選択したツール向けにこのプロジェクトを設定します。本体の導入に Bun / Node.js は不要です。</p>
<p>${state.native ? `本体 ${esc(state.native.version)} を検出しました。` : ready ? "既存の AI-DLC 設定を利用します。" : `導入するバージョン：${SETUP_RELEASE}`}${state.version ? ` プロジェクト：${esc(state.version)}` : ""}</p>
<label for="harness">AI-DLC を使うツール</label><select id="harness"${ready ? " disabled" : ""}>${options}</select>
<div class="actions"><button id="install"${!trusted || ready ? " disabled" : ""}>${ready ? "AI-DLC は設定済みです" : state.native ? "このプロジェクトを設定" : "インストールして設定"}</button><button class="secondary" id="docs">公式の手順を見る</button></div>
</li>
<li class="card"><div class="card-head"><span class="number">2</span><h2>AI からガイドを参照する</h2><span class="badge ${state.docsReady ? "success" : ""}">${state.docsReady ? "登録済み" : "任意"}</span></div>
<p class="description">Claude Code / Cursor が、同梱の公式ドキュメントを参照して回答できるようにします。文書参照 MCP と Skill を両方のツールに登録します。</p>
<p class="muted">この連携には Bun が必要です。あとから設定することもできます。</p>
<div class="actions"><button class="secondary" id="register-mcp"${!trusted || !ready || state.docsReady ? " disabled" : ""}>${state.docsReady ? "文書参照は登録済みです" : "文書参照を有効にする"}</button><button class="secondary" id="bun-docs">Bun の導入手順</button></div>
</li>
<li class="card"><div class="card-head"><span class="number">3</span><h2>最初のワークフローを始める</h2><span class="badge">設定後</span></div>
<p class="description">選択したツールのチャットで、作りたいものを伝えます。まだワークフローがなくても、セットアップは完了できます。</p>
<code class="start-command" id="start-command">${selected === "codex" ? "$aidlc" : "/aidlc"} 作りたいものや、改善したいことを伝える</code>
</li></ol>
<p id="status" role="status" aria-live="polite"></p>
<details id="log-details"><summary>実行結果・診断の詳細</summary><pre id="log"></pre></details>
<footer><button class="secondary" id="recheck">状態を再確認</button><button id="finish"${!ready || !trusted ? " disabled" : ""}>${state.docsReady ? "設定を完了してダッシュボードへ" : "文書参照はあとで設定して始める"}</button></footer>
</main><script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const harness = document.getElementById('harness');
const status = document.getElementById('status');
const log = document.getElementById('log');
let busy = false;
const saved = vscode.getState();
if (saved && typeof saved.log === 'string') log.textContent = saved.log;
if (saved && typeof saved.status === 'string') status.textContent = saved.status;
function save() { vscode.setState({ log: log.textContent, status: status.textContent }); }
function send(type) { if (!busy) vscode.postMessage({ type, harness: harness.value }); }
['install', 'register-mcp', 'recheck', 'finish', 'docs', 'bun-docs'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => send(id));
});
harness.addEventListener('change', () => {
  document.getElementById('start-command').textContent = (harness.value === 'codex' ? '$aidlc' : '/aidlc') + ' 作りたいものや、改善したいことを伝える';
  send('select-harness');
});
window.addEventListener('message', ({ data: msg }) => {
  if (!msg || typeof msg.type !== 'string') return;
  if (msg.type === 'restore') {
    log.textContent = msg.log;
    status.textContent = msg.text;
    status.classList.toggle('error', msg.error === true);
    if (msg.log) document.getElementById('log-details').open = true;
  }
  if (msg.type === 'busy') {
    busy = msg.value;
    document.querySelectorAll('button, select').forEach(el => {
      if (busy) { el.dataset.disabled = String(el.disabled); el.disabled = true; }
      else if (el.dataset.disabled) el.disabled = el.dataset.disabled === 'true';
    });
    document.querySelector('main').setAttribute('aria-busy', String(busy));
  }
  if (msg.type === 'log') {
    log.textContent = (log.textContent + msg.text + '\\n').slice(-60000);
    document.getElementById('log-details').open = true;
  }
  if (msg.type === 'status') {
    status.textContent = msg.text;
    status.classList.toggle('error', msg.error === true);
  }
  save();
});
vscode.postMessage({ type: 'ready' });
</script></body></html>`;
}
