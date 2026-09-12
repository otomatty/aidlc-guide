import { HARNESS_LABELS, type HarnessId } from "./harness-detect.ts";
import { SETUP_RELEASE } from "./native-setup.ts";
import type { SetupSnapshot } from "./setup-state.ts";

const harnessConflicts = [
  {
    ids: ["copilot", "opencode"],
    message: "GitHub Copilot と opencode は同じ設定フォルダを使うため、同時に設定できません。",
  },
  {
    ids: ["kiro", "kiro-ide"],
    message: "Kiro CLI と Kiro IDE は同じ設定フォルダを使うため、同時に設定できません。",
  },
] satisfies { ids: HarnessId[]; message: string }[];

export function escapeSetupText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type SetupPanelMode = "setup" | "install";

export function setupHtml(
  state: SetupSnapshot,
  selected: HarnessId[],
  trusted: boolean,
  nonce: string,
  mode: SetupPanelMode = "setup",
): string {
  const esc = escapeSetupText;
  const ready = state.configured;
  const installing = mode === "install";
  selected = [...new Set([...selected, ...state.harnesses])];
  const pending = selected.filter((id) => !state.harnesses.includes(id));
  const collision = harnessConflicts.some(({ ids }) => ids.every((id) => selected.includes(id)));
  const title = installing
    ? "aidlc-workflows をインストール"
    : ready
      ? "AI-DLC を使い始めましょう"
      : "開発を始める準備をしましょう";
  const options = Object.entries(HARNESS_LABELS)
    .map(
      ([id, label]) =>
        `<label class="harness-option"><input type="checkbox" name="harness" value="${id}"${selected.includes(id as HarnessId) ? " checked" : ""}${!trusted || state.harnesses.includes(id as HarnessId) ? " disabled" : ""}><span>${label}</span>${state.harnesses.includes(id as HarnessId) ? '<span class="badge">設定あり</span>' : ""}</label>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<title>${title}</title>
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
  fieldset { border: 0; padding: 0; margin: 20px 0 0; min-width: 0; }
  legend { font-weight: 600; margin-bottom: 4px; }
  .harnesses { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 8px; }
  .harness-option { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--vscode-panel-border, #8885); border-radius: 6px; cursor: pointer; }
  .harness-option:has(:checked) { border-color: var(--vscode-focusBorder); background: var(--vscode-list-inactiveSelectionBackground); }
  .harness-option input { width: 16px; height: 16px; margin: 0; accent-color: var(--vscode-button-background); }
  #selection-note { margin: 10px 0 0; }
  #selection-note.error { color: var(--vscode-errorForeground); }
  #install-results { padding: 0; list-style: none; }
  #install-results li { border-top: 1px solid var(--vscode-panel-border, #8885); padding: 12px 0; }
  #install-results p { margin: 4px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 18px; }
  button { font: inherit; cursor: pointer; border: 1px solid transparent; border-radius: 4px; padding: 9px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button:disabled, input:disabled { opacity: .55; cursor: default; }
  button:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; }
  .note { padding: 12px 16px; border: 1px solid var(--vscode-editorWarning-foreground, #b88); border-radius: 6px; }
  #status { margin: 20px 0 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
  #status.error { color: var(--vscode-errorForeground); }
  details { margin: 12px 0; }
  summary { cursor: pointer; }
  pre { max-height: 300px; overflow: auto; padding: 14px; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--vscode-textCodeBlock-background); font-size: 12px; }
  footer { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-top: 24px; flex-wrap: wrap; }
  .start-command { display: block; padding: 12px; background: var(--vscode-textCodeBlock-background); border-radius: 4px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .doctor { margin-top: 28px; padding: 24px; border: 1px solid var(--vscode-panel-border, #8885); border-radius: 10px; overflow-wrap: anywhere; }
  .doctor h3 { margin: 20px 0 8px; font-size: 14px; }
  .doctor-summary { margin-top: 18px; font-weight: 600; white-space: pre-wrap; }
  .doctor-meta { font-size: 12px; color: var(--vscode-descriptionForeground); }
  .doctor-counts, .doctor-checks { list-style: none; margin: 10px 0; padding: 0; }
  .doctor-counts { display: flex; flex-wrap: wrap; gap: 8px 20px; }
  .doctor-check { padding: 12px 0; border-top: 1px solid var(--vscode-panel-border, #8885); }
  .doctor-check-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 12px; }
  .doctor-label { flex: 1; min-width: min(180px, 100%); white-space: pre-wrap; }
  .doctor-state { font-weight: 600; }
  .doctor-ok { color: var(--vscode-testing-iconPassed, #388a34); }
  .doctor-warn { color: var(--vscode-editorWarning-foreground, #b89500); }
  .doctor-fail { color: var(--vscode-errorForeground); }
  .doctor-fix, .doctor-original { margin: 6px 0 0; white-space: pre-wrap; }
  .doctor-original { color: var(--vscode-descriptionForeground); }
  @media (max-width: 540px) { main { padding: 24px 16px; } .card, .doctor { padding: 18px; } .actions button { width: 100%; } }
</style></head><body><main>
<div class="eyebrow">AIDLC GUIDE / ${installing ? "INSTALL" : "GET STARTED"}</div>
<h1>${title}</h1>
<p class="description">${installing ? "このプロジェクトで使うツールを選んで、AI-DLC を設定します。設定済みのツールはそのまま利用します。" : "このプロジェクトで AI-DLC を使うための設定を行います。進捗や成果物は、設定後にダッシュボードで確認できます。"}</p>
<div class="workspace"><span class="muted">設定するフォルダ</span><code>${esc(state.root)}</code></div>
${trusted ? "" : '<p class="note">このワークスペースは制限モードです。設定を実行するには、VS Code のワークスペースの信頼を確認してください。</p>'}
<ol class="steps">
<li class="card"><div class="card-head">${installing ? "" : '<span class="number">1</span>'}<h2>AI-DLC を準備する</h2><span class="badge ${ready ? "success" : ""}">${ready ? "設定済み" : "設定が必要"}</span></div>
<p class="description">公式インストーラーで本体を導入し、選択したツール向けにこのプロジェクトを設定します。本体の導入に Bun / Node.js は不要です。</p>
<p>${state.native ? `本体 ${esc(state.native.version)} を検出しました。` : ready ? "既存の AI-DLC 設定を利用します。" : `導入するバージョン：${SETUP_RELEASE}`}${state.version ? ` プロジェクト：${esc(state.version)}` : ""}</p>
${state.runtimeIssue ? `<p class="note">${esc(state.runtimeIssue)}</p>` : ""}
<fieldset aria-describedby="harness-help selection-note"><legend>AI-DLC を使うツール</legend>
<p class="muted" id="harness-help">複数選択できます。設定済みのツールを保持したまま、選択したツールを追加します。</p>
<div class="harnesses">${options}</div></fieldset>
<p id="selection-note" role="status" aria-live="polite"></p>
<div class="actions"><button id="install"${!trusted || pending.length === 0 || collision ? " disabled" : ""}>${state.harnesses.length ? "選択したツールを追加" : state.native ? "選択したツールを設定" : "インストールして設定"}</button><button class="secondary" id="docs">公式の手順を見る</button></div>
<ul id="install-results" aria-label="ツールごとのインストール結果" aria-live="polite"></ul>
</li>
${
  installing
    ? ""
    : `<li class="card"><div class="card-head"><span class="number">2</span><h2>AI からガイドを参照する</h2><span class="badge ${state.docsReady ? "success" : ""}">${state.docsReady ? "登録済み" : "任意"}</span></div>
<p class="description">Claude Code / Cursor が、同梱の公式ドキュメントを参照して回答できるようにします。文書参照 MCP と Skill を両方のツールに登録します。</p>
<p class="muted">この連携には Bun が必要です。あとから設定することもできます。</p>
<div class="actions"><button class="secondary" id="register-mcp"${!trusted || !ready || state.docsReady ? " disabled" : ""}>${state.docsReady ? "文書参照は登録済みです" : "文書参照を有効にする"}</button><button class="secondary" id="bun-docs">Bun の導入手順</button></div>
</li>
<li class="card"><div class="card-head"><span class="number">3</span><h2>最初のワークフローを始める</h2><span class="badge">設定後</span></div>
<p class="description">選択したツールのチャットで、作りたいものを伝えます。まだワークフローがなくても、セットアップは完了できます。</p>
<code class="start-command" id="start-command"></code>
</li>`
}</ol>
<p id="status" role="status" aria-live="polite"></p>
<section class="doctor" id="doctor" aria-labelledby="doctor-heading" aria-busy="false">
<h2 id="doctor-heading">AI-DLC の診断結果</h2>
<p class="description">本体・プロジェクトの状態を検査し、結果と対処方法を日本語で表示します。</p>
<div class="actions"><button class="secondary" id="run-doctor"${!trusted ? " disabled" : ""}>診断を実行</button></div>
<div id="doctor-result" role="status" aria-live="polite"><p class="muted">診断はまだ実行していません。</p></div>
</section>
<details id="log-details"><summary>実行結果・診断の詳細</summary><pre id="log"></pre></details>
<footer><button class="secondary" id="recheck">状態を再確認</button>${installing ? "" : `<button id="finish"${!ready || !trusted ? " disabled" : ""}>${state.docsReady ? "設定を完了してダッシュボードへ" : "文書参照はあとで設定して始める"}</button>`}</footer>
</main><script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const harnesses = [...document.querySelectorAll('input[name="harness"]')];
const installed = ${JSON.stringify(state.harnesses)};
const harnessConflicts = ${JSON.stringify(harnessConflicts)};
const trusted = ${trusted};
const configured = ${ready};
const labels = ${JSON.stringify(HARNESS_LABELS)};
const status = document.getElementById('status');
const log = document.getElementById('log');
const doctor = document.getElementById('doctor');
const doctorResult = document.getElementById('doctor-result');
const doctorButton = document.getElementById('run-doctor');
let busy = false;
let doctorReport = null;
let installResults = [];
const saved = vscode.getState();
if (saved && typeof saved.log === 'string') log.textContent = saved.log;
if (saved && typeof saved.status === 'string') status.textContent = saved.status;
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (typeof text === 'string') node.textContent = text;
  if (className) node.className = className;
  return node;
}
function renderDoctor(report) {
  doctorReport = report && Array.isArray(report.checks) ? report : null;
  doctorResult.replaceChildren();
  doctor.setAttribute('aria-busy', 'false');
  doctorButton.textContent = doctorReport ? '診断を再実行' : '診断を実行';
  if (!doctorReport) {
    doctorResult.append(element('p', '診断はまだ実行していません。', 'muted'));
    return;
  }
  const summaryClass = { ok: 'doctor-ok', warning: 'doctor-warn', failed: 'doctor-fail', unavailable: 'doctor-fail' }[doctorReport.outcome] || '';
  doctorResult.append(element('p', doctorReport.summary, 'doctor-summary ' + summaryClass));
  const meta = element('p', '', 'doctor-meta');
  meta.append(element('span', '本体バージョン：' + (doctorReport.version || '未取得')));
  meta.append(element('br'));
  const date = new Date(doctorReport.executedAt);
  const time = element('time', Number.isNaN(date.getTime()) ? doctorReport.executedAt : date.toLocaleString('ja-JP'));
  if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString();
  meta.append(element('span', '実行日時：'), time);
  doctorResult.append(meta);
  if (doctorReport.counts) {
    const counts = element('ul', '', 'doctor-counts');
    counts.setAttribute('aria-label', '診断の集計');
    counts.append(
      element('li', '正常 ' + doctorReport.counts.passed + ' 件', 'doctor-ok'),
      element('li', '要確認 ' + doctorReport.counts.warnings + ' 件', 'doctor-warn'),
      element('li', '問題あり ' + doctorReport.counts.failed + ' 件', 'doctor-fail'),
    );
    doctorResult.append(counts);
  }
  const sections = { machine: '実行環境', project: 'プロジェクト', framework: 'AI-DLC 本体', other: 'その他' };
  const states = { ok: '正常', warn: '要確認', fail: '問題あり' };
  Object.entries(sections).forEach(([section, heading]) => {
    const checks = doctorReport.checks.filter(check => (Object.hasOwn(sections, check.section) ? check.section : 'other') === section);
    if (!checks.length) return;
    doctorResult.append(element('h3', heading));
    const list = element('ul', '', 'doctor-checks');
    checks.forEach(check => {
      const item = element('li', '', 'doctor-check');
      const head = element('div', '', 'doctor-check-head');
      head.append(element('span', states[check.status] || '要確認', 'doctor-state doctor-' + (Object.hasOwn(states, check.status) ? check.status : 'warn')));
      head.append(element('span', check.label, 'doctor-label'));
      item.append(head);
      if (check.translated === false) item.append(element('p', '原文：' + check.originalLabel, 'doctor-original'));
      if (check.fix) item.append(element('p', '対処方法：' + check.fix, 'doctor-fix'));
      if (check.originalFix && check.fixTranslated === false) item.append(element('p', '対処方法の原文：' + check.originalFix, 'doctor-original'));
      list.append(item);
    });
    doctorResult.append(list);
  });
  if (doctorReport.unparsedOutput && doctorReport.unparsedOutput.length) {
    doctorResult.append(element('p', '形式を読み取れない出力があります。以下の原文を確認してください。', 'note'));
    const unparsed = element('details');
    unparsed.append(element('summary', '未分類の出力を見る'), element('pre', doctorReport.unparsedOutput.join('\\n')));
    doctorResult.append(unparsed);
  }
  const original = element('details');
  original.id = 'doctor-original';
  original.append(element('summary', '原文を見る'), element('pre', doctorReport.rawOutput));
  doctorResult.append(original);
}
if (saved && saved.doctorReport) renderDoctor(saved.doctorReport);
function save() { vscode.setState({ log: log.textContent, status: status.textContent, doctorReport }); }
function selection() { return harnesses.filter(el => el.checked).map(el => el.value); }
function updateSelection() {
  const selected = selection();
  const pending = selected.filter(id => !installed.includes(id));
  const combined = new Set([...installed, ...selected]);
  const collision = harnessConflicts.find(({ ids }) => ids.every(id => combined.has(id)))?.message;
  const note = document.getElementById('selection-note');
  note.textContent = collision || (pending.length ? pending.length + ' 個のツールを' + (installed.length ? '追加' : '設定') + 'します。' : installed.length ? '設定済みです。追加するツールを選択できます。' : 'ツールを1つ以上選択してください。');
  note.classList.toggle('error', !!collision);
  document.getElementById('install').disabled = busy || !trusted || !pending.length || !!collision;
  const finish = document.getElementById('finish');
  if (finish) finish.disabled = busy || !trusted || !configured || !selected.length || selected.some(id => !installed.includes(id));
  const command = document.getElementById('start-command');
  if (command) {
    const commands = [];
    if (selected.includes('codex')) commands.push('Codex：$aidlc 作りたいものや、改善したいことを伝える');
    if (selected.some(id => id !== 'codex')) commands.push('/aidlc 作りたいものや、改善したいことを伝える');
    command.textContent = commands.join('\\n') || '利用するツールを選択してください。';
  }
}
function renderInstallResults(results) {
  installResults = Array.isArray(results) ? results : [];
  const list = document.getElementById('install-results');
  list.replaceChildren();
  const states = { configured: '設定完了', skipped: '設定済み', failed: '失敗', cancelled: '中止' };
  installResults.forEach(result => {
    const item = element('li');
    item.append(element('strong', (labels[result.id] || result.id) + '：' + (states[result.status] || '要確認')));
    if (result.message) item.append(element('p', result.message));
    if (result.doctorReport) {
      const button = element('button', 'このツールの診断結果を見る', 'secondary');
      button.disabled = busy;
      button.addEventListener('click', () => { renderDoctor(result.doctorReport); save(); });
      item.append(button);
    }
    list.append(item);
  });
}
function send(type) { if (!busy) vscode.postMessage({ type, harnesses: selection() }); }
['install', 'register-mcp', 'recheck', 'finish', 'docs', 'bun-docs', 'run-doctor'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => send(id));
});
harnesses.forEach(input => input.addEventListener('change', () => {
  updateSelection();
  send('select-harnesses');
}));
updateSelection();
window.addEventListener('message', ({ data: msg }) => {
  if (!msg || typeof msg.type !== 'string') return;
  if (msg.type === 'restore') {
    log.textContent = msg.log;
    status.textContent = msg.text;
    status.classList.toggle('error', msg.error === true);
    if (msg.log) document.getElementById('log-details').open = true;
    renderDoctor(msg.doctorReport);
    renderInstallResults(msg.installResults);
  }
  if (msg.type === 'busy' && busy !== (msg.value === true)) {
    busy = msg.value === true;
    document.querySelectorAll('button, input').forEach(el => {
      if (busy) { el.dataset.disabled = String(el.disabled); el.disabled = true; }
      else if (el.dataset.disabled) el.disabled = el.dataset.disabled === 'true';
    });
    document.querySelector('main').setAttribute('aria-busy', String(busy));
    renderInstallResults(installResults);
    updateSelection();
  }
  if (msg.type === 'install-results') renderInstallResults(msg.results);
  if (msg.type === 'doctor-running') {
    renderDoctor(null);
    doctor.setAttribute('aria-busy', 'true');
    doctorButton.textContent = '診断中…';
    doctorResult.replaceChildren(element('p', '診断を実行しています。', 'muted'));
  }
  if (msg.type === 'doctor-report') renderDoctor(msg.report);
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
