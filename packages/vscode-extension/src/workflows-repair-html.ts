export const repairHtml = `
<section aria-labelledby="repair-heading">
<h2 id="repair-heading">更新前の問題と修正</h2>
<p>診断は作業用コピーで行います。AI 修正では、診断情報と必要な .gitignore の内容を選択した AI に送ります。CLI のログインと利用枠を使用します。</p>
<button id="diagnose">問題を再診断</button>
<button id="copy-diagnosis" disabled>診断情報をコピー</button>
<p id="problem-summary" role="status">診断結果はここに表示されます。</p>
<div id="problems"></div>
<label for="repair-tool">修正に使うハーネス</label>
<select id="repair-tool" disabled><option value="">利用可能な CLI を確認してください</option></select>
<button id="probe-tools">CLI を確認</button><button id="repair" disabled>AIで修正</button>
<button id="cancel-repair" disabled>修正を中止</button>
<p id="repair-status" role="status"></p>
<p>公式配布物と一致する設定と、除外ルールを保持できる古い .gitignore を自動修正します。独自変更のある設定は確認事項として残します。修正前のファイルはバックアップします。</p>
</section>`;

// All diagnostic strings enter the DOM through textContent, never innerHTML.
export const repairScript = `
let problems = [];
let repairRunning = false;
const toolSelect = document.getElementById('repair-tool');
function repairButtons() {
  document.getElementById('diagnose').disabled = busy;
  document.getElementById('probe-tools').disabled = busy;
  document.getElementById('copy-diagnosis').disabled = busy || !problems.length;
  document.getElementById('repair').disabled = busy || !problems.length || !toolSelect.value;
  document.getElementById('cancel-repair').disabled = !repairRunning;
  toolSelect.disabled = busy || toolSelect.options.length === 0;
}
toolSelect.addEventListener('change', repairButtons);
for (const id of ['diagnose', 'repair', 'probe-tools']) document.getElementById(id).addEventListener('click', () => {
  busy = true; repairRunning = id === 'repair'; buttons(); repairButtons();
  vscode.postMessage({ type: id, tool: toolSelect.value });
});
document.getElementById('cancel-repair').addEventListener('click', () => vscode.postMessage({ type: 'cancel-repair' }));
document.getElementById('copy-diagnosis').addEventListener('click', () => vscode.postMessage({ type: 'copy-diagnosis' }));
window.addEventListener('message', ({ data: msg }) => {
  if (msg.type === 'problems') {
    problems = msg.problems;
    document.getElementById('problem-summary').textContent = msg.message || (problems.length + ' 件の問題があります。');
    const groups = new Map();
    for (const [index, problem] of problems.entries()) {
      const key = problem.harness + ':' + problem.kind;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ problem, index });
    }
    document.getElementById('problems').replaceChildren(...Array.from(groups.values(), entries => {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = entries[0].problem.label + '：' + entries.length + ' 件 — ' + entries[0].problem.guidance;
      details.append(summary);
      const list = document.createElement('ul');
      for (const { problem, index } of entries) {
        const item = document.createElement('li');
        const label = document.createElement('span'); label.textContent = problem.path + '：' + problem.detail;
        item.append(label);
        if (problem.path && problem.path !== '設定全体') {
          const button = document.createElement('button'); button.textContent = 'ファイルを開く';
          button.addEventListener('click', () => vscode.postMessage({ type: 'problem-file', index }));
          item.append(button);
        }
        list.append(item);
      }
      details.append(list); return details;
    }));
  }
  if (msg.type === 'repair-tools') {
    toolSelect.replaceChildren(...msg.tools.map(tool => {
      const option = document.createElement('option'); option.value = tool.available ? tool.tool : '';
      option.disabled = !tool.available;
      option.textContent = tool.label + (tool.available ? '' : '：' + (tool.detail || '利用できません'));
      return option;
    }));
    const first = msg.tools.find(tool => tool.available); toolSelect.value = first ? first.tool : '';
  }
  if (msg.type === 'repair-done') {
    busy = false; repairRunning = false;
    document.getElementById('repair-status').textContent = msg.message;
    if (msg.ready) apply.textContent = '更新を再開して最終確認';
    buttons();
  }
  repairButtons();
});
`;
