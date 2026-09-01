import { tmpdir } from "node:os";
import path from "node:path";
import {
  commands,
  type ExtensionContext,
  env,
  Uri,
  ViewColumn,
  type WebviewPanel,
  window,
  workspace,
} from "vscode";
import { detectHarnesses, HARNESS_LABELS, type HarnessId } from "./harness-detect.ts";
import { resolveOfficialDocsRoot } from "./official-docs-root.ts";
import {
  applyWorkflowsUpdate,
  downloadWorkflowsArchive,
  extractDownloadedArchive,
  findExtractedRepoRoot,
} from "./workflows-apply.ts";
import {
  isSnoozedForPin,
  readPinnedManifestInfo,
  resolveWorkflowsStatus,
  UPDATE_WORKFLOWS_COMMAND,
  WORKFLOWS_SNOOZE_KEY,
} from "./workflows-version.ts";

const GETTING_STARTED_REL = path.join("docs", "guide", "en", "01-getting-started.md");
const GETTING_STARTED_URL =
  "https://github.com/awslabs/aidlc-workflows/blob/v2/docs/guide/en/01-getting-started.md";

const HARNESS_IDS = new Set<string>(Object.keys(HARNESS_LABELS));

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function panelHtml(
  workspaceVersion: string,
  pin: string,
  harnesses: { id: HarnessId; label: string }[],
  collision: boolean,
  applyEnabled: boolean,
): string {
  const rows = harnesses
    .map(
      (h) =>
        `<label><input type="checkbox" name="harness" value="${esc(h.id)}" checked /> ${esc(h.label)}</label>`,
    )
    .join("<br />");
  const collisionNote = collision
    ? '<p class="warn">Copilot と opencode が両方検出されました。どちらも <code>.aidlc/</code> を使うので、同時には更新しません。どちらか一方のチェックを外してください。</p>'
    : "";
  const empty =
    harnesses.length === 0
      ? "<p>検出されたハーネスはありません。新規インストールはしません。</p>"
      : "";
  const currentNote = applyEnabled
    ? ""
    : '<p class="warn">ワークスペースは想定版以上です。ダウングレードはしません。</p>';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>AIDLC Guide — Update Workflows</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 1rem 1.25rem; line-height: 1.5; }
    button { margin: 0.25rem 0.5rem 0.25rem 0; padding: 0.4rem 0.8rem; cursor: pointer; }
    .ok { color: #2a7; }
    .warn { color: #c80; }
    pre { background: #8882; padding: 0.75rem; white-space: pre-wrap; min-height: 6rem; }
    label { display: inline-block; margin: 0.2rem 0; }
  </style>
</head>
<body>
  <h1>AIDLC Guide — Update Workflows</h1>
  <p>ワークスペース <strong>${esc(workspaceVersion)}</strong> → この Guide の想定版 <strong>${esc(pin)}</strong></p>
  <p>検出されたハーネスだけを、Guide が読める版まで上げます。入っていないハーネスは作りません。共有 <code>aidlc/</code> シェルは一度だけ更新し、<code>team.md</code> / <code>project.md</code> / Intent は残します。</p>
  ${collisionNote}
  ${currentNote}
  ${empty}
  <p>${rows}</p>
  <button id="apply"${applyEnabled ? "" : " disabled"}>このバージョンまで上げる</button>
  <button id="docs">公式手順を開く</button>
  <pre id="log"></pre>
  <script>
    const vscode = acquireVsCodeApi();
    const logEl = document.getElementById('log');
    document.getElementById('apply').addEventListener('click', () => {
      const applyBtn = document.getElementById('apply');
      applyBtn.disabled = true;
      const selected = [...document.querySelectorAll('input[name="harness"]:checked')].map((el) => el.value);
      vscode.postMessage({ type: 'apply', selected });
    });
    document.getElementById('docs').addEventListener('click', () => {
      vscode.postMessage({ type: 'open-docs' });
    });
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg && msg.type === 'log' && typeof msg.line === 'string') {
        logEl.textContent += msg.line + '\\n';
      }
      if (msg && msg.type === 'apply-done') {
        document.getElementById('apply').disabled = ${applyEnabled ? "false" : "true"};
      }
    });
  </script>
</body>
</html>`;
}

function parseSelected(raw: unknown): HarnessId[] {
  if (!Array.isArray(raw)) return [];
  const out: HarnessId[] = [];
  for (const item of raw) {
    if (typeof item === "string" && HARNESS_IDS.has(item)) {
      out.push(item as HarnessId);
    }
  }
  return out;
}

async function openGettingStarted(docsRoot: string): Promise<void> {
  const local = path.join(docsRoot, GETTING_STARTED_REL);
  try {
    await commands.executeCommand("vscode.open", Uri.file(local));
  } catch {
    await env.openExternal(Uri.parse(GETTING_STARTED_URL));
  }
}

async function runApply(
  panel: WebviewPanel,
  workspaceRoot: string,
  pin: string,
  upstreamSha: string | null,
  selected: HarnessId[],
  collision: boolean,
): Promise<void> {
  const log = (line: string) => {
    void panel.webview.postMessage({ type: "log", line });
  };

  if (pin === "不明") {
    log("Guide の想定版が読めません。公式手順から手動で更新してください。");
    return;
  }

  log(`aidlc-workflows ${pin} を取得しています…`);
  const downloaded = await downloadWorkflowsArchive(pin, fetch, upstreamSha);
  if (!downloaded.ok) {
    if (downloaded.reason === "not-found") {
      log(
        `取得に失敗しました（この版 ${pin} のアーカイブが upstream に見つかりません${
          upstreamSha === null ? "。マニフェストに upstreamSha がありません" : ""
        }）。公式手順から手動で更新してください。`,
      );
      return;
    }
    const reason =
      downloaded.reason === "timeout"
        ? "タイムアウト"
        : downloaded.reason === "network"
          ? "ネットワークエラー"
          : "HTTP エラー";
    log(
      `取得に失敗しました（${reason}）。オフラインでも拡張は使えます。公式手順を開いてください。`,
    );
    return;
  }
  log(
    downloaded.source === "commit"
      ? `取得しました（コミット ${upstreamSha?.slice(0, 12)}）。`
      : `取得しました（タグ v${pin.replace(/^[vV]/, "")}）。`,
  );

  const work = path.join(tmpdir(), `aidlc-workflows-${Date.now()}`);
  const archivePath = path.join(work, "aidlc-workflows.tar.gz");
  const extractDir = path.join(work, "extract");
  const workUri = Uri.file(work);
  try {
    await workspace.fs.createDirectory(workUri);
    await workspace.fs.writeFile(Uri.file(archivePath), downloaded.bytes);
    log("アーカイブを展開しています…");
    const extracted = await extractDownloadedArchive(archivePath, extractDir);
    log(extracted.log);
    if (!extracted.ok) return;

    const distRoot = findExtractedRepoRoot(extractDir);
    if (distRoot === null) {
      log("展開結果に dist/ がありません。公式手順を開いてください。");
      return;
    }

    log("選択したハーネスを更新しています…");
    try {
      const result = await applyWorkflowsUpdate({
        workspaceRoot,
        distRoot,
        pin,
        selected,
        aidlcDirCollision: collision,
      });
      for (const line of result.log) log(line);
      if (result.ok) {
        log("完了しました。");
      } else {
        const failed =
          result.failed.length > 0 ? result.failed.join(", ") : (result.reason ?? "error");
        log(`失敗しました（${failed}）。残ったハーネスは公式手順で更新してください。`);
      }
    } catch (cause) {
      log(
        `失敗しました（${cause instanceof Error ? cause.message : String(cause)}）。残ったハーネスは公式手順で更新してください。`,
      );
    }
  } finally {
    try {
      await workspace.fs.delete(workUri, { recursive: true });
    } catch {
      // tmp cleanup is best-effort
    }
  }
}

export async function openWorkflowsUpdatePanel(
  context: ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const docsRoot = resolveOfficialDocsRoot(context.extensionPath, workspaceRoot);
  const status = resolveWorkflowsStatus(workspaceRoot, docsRoot);
  const upstreamSha = readPinnedManifestInfo(docsRoot)?.upstreamSha ?? null;
  const detected = detectHarnesses(workspaceRoot);
  const pin =
    status.kind === "missing" || status.kind === "unparseable"
      ? (status.pin ?? "不明")
      : status.pin;
  const workspaceVersion =
    status.kind === "older" || status.kind === "current-or-newer"
      ? status.workspace
      : status.kind === "unparseable"
        ? (status.raw ?? "解釈できません")
        : "未検出";

  const panel = window.createWebviewPanel(
    "aidlcGuide.updateWorkflows",
    "AIDLC Guide — Update Workflows",
    ViewColumn.One,
    { enableScripts: true },
  );
  panel.webview.html = panelHtml(
    workspaceVersion,
    pin ?? "不明",
    detected.harnesses,
    detected.aidlcDirCollision,
    detected.harnesses.length > 0 && (status.kind === "older" || status.kind === "missing"),
  );

  let applyInFlight = false;
  panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (typeof message !== "object" || message === null) return;
    const msg = message as Record<string, unknown>;
    if (msg.type === "open-docs") {
      await openGettingStarted(docsRoot);
      return;
    }
    if (msg.type === "apply") {
      if (applyInFlight) {
        void panel.webview.postMessage({ type: "log", line: "更新はすでに実行中です。" });
        return;
      }
      applyInFlight = true;
      try {
        const selected = parseSelected(msg.selected);
        await runApply(
          panel,
          workspaceRoot,
          pin ?? "不明",
          upstreamSha,
          selected,
          detected.aidlcDirCollision,
        );
      } finally {
        applyInFlight = false;
        void panel.webview.postMessage({ type: "apply-done" });
      }
    }
  });
}

let promptJob: Promise<void> | undefined;

export async function maybePromptWorkflowsUpdate(
  context: ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  promptJob ??= promptWorkflowsUpdateOnce(context, workspaceRoot);
  return promptJob;
}

async function promptWorkflowsUpdateOnce(
  context: ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const docsRoot = resolveOfficialDocsRoot(context.extensionPath, workspaceRoot);
  const status = resolveWorkflowsStatus(workspaceRoot, docsRoot);
  if (status.kind !== "older") return;
  if (isSnoozedForPin(context.workspaceState.get(WORKFLOWS_SNOOZE_KEY), status.pin)) return;
  const pick = await window.showInformationMessage(
    `AIDLC Guide: ワークスペースの aidlc-workflows（${status.workspace}）が、この Guide の想定版（${status.pin}）より古いです。`,
    "アップデートする",
    "後で",
  );
  if (pick === "後で") {
    await context.workspaceState.update(WORKFLOWS_SNOOZE_KEY, status.pin);
    return;
  }
  if (pick === "アップデートする") {
    await openWorkflowsUpdatePanel(context, workspaceRoot);
  }
}

export { UPDATE_WORKFLOWS_COMMAND };
