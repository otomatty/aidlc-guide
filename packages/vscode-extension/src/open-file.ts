import {
  commands,
  Position,
  Range,
  RelativePattern,
  Selection,
  TextEditorRevealType,
  Uri,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import { fileRefTarget, rankCandidates, recordFileTarget } from "./file-ref-target.ts";

/**
 * The `open-file` half of the webview channel: a file citation out of a
 * generated artifact (`packages/btw/src/plan.ts:20`, or often just
 * `AnswerEditor.tsx:168`) turned into a cursor in an editor.
 *
 * Kept apart from `open-doc`, which resolves bridge-map paths against
 * `docsRepoPath`. These resolve against the workspace and may be fragments.
 */

/** A citation matching more than this is a word, not a reference; stop looking. */
const MAX_MATCHES = 50;

async function exists(uri: Uri): Promise<boolean> {
  try {
    await workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function reveal(uri: Uri, line: number | null, beside: boolean): Promise<void> {
  if (line === null) {
    if (beside) {
      await commands.executeCommand("vscode.open", uri, { viewColumn: ViewColumn.Beside });
    } else {
      await commands.executeCommand("vscode.open", uri);
    }
    return;
  }

  const doc = await workspace.openTextDocument(uri);
  const editor = await window.showTextDocument(doc, {
    preview: true,
    ...(beside ? { viewColumn: ViewColumn.Beside } : {}),
  });

  // An artifact outlives the edits made after it was written, so a cited line
  // can now be past the end. Clamp rather than throw: landing in the right file
  // at the last line beats an error message.
  const at = new Position(Math.min(line - 1, Math.max(doc.lineCount - 1, 0)), 0);
  editor.selection = new Selection(at, at);
  editor.revealRange(new Range(at, at), TextEditorRevealType.InCenter);
}

export type OpenFileBase = "workspace" | "record";

export async function openFileRef(
  workspaceRoot: string,
  rel: string,
  line: number | null,
  options: { beside?: boolean; base?: OpenFileBase; recordDir?: string } = {},
): Promise<void> {
  const beside = options.beside === true;
  if (options.base === "record") {
    if (options.recordDir === undefined) {
      void window.showWarningMessage(`レコードを解決できません: ${rel}`);
      return;
    }
    const recordTarget = await recordFileTarget(options.recordDir, rel);
    if (recordTarget === null) {
      void window.showWarningMessage(`開けないパスです: ${rel}`);
      return;
    }
    await reveal(Uri.file(recordTarget), line, beside);
    return;
  }

  const target = fileRefTarget(workspaceRoot, rel);
  if (target === null) {
    void window.showWarningMessage(`開けないパスです: ${rel}`);
    return;
  }

  // Scoped to this dashboard's root, not the window's. A bare `string` glob
  // searches every folder of a multi-root workspace, so a citation missing from
  // this root but present in an unrelated one would open that file as if it
  // were authoritative — and `direct` is root-scoped, so the two halves would
  // disagree about which repo the artifact is describing.
  //
  // Always run, even when `direct` exists: a partial citation can be both a
  // real root-relative path and a suffix of a deeper one, and only the search
  // can say whether the root reading was the only one.
  const found = await workspace.findFiles(
    new RelativePattern(Uri.file(workspaceRoot), target.glob),
    "**/node_modules/**",
    MAX_MATCHES,
  );

  const byPath = new Map(found.map((uri) => [uri.fsPath, uri]));
  const direct =
    target.direct !== null && (await exists(Uri.file(target.direct))) ? target.direct : null;
  if (direct !== null && !byPath.has(direct)) byPath.set(direct, Uri.file(direct));

  const candidates = rankCandidates(direct, [...found.map((uri) => uri.fsPath)]);
  const first = candidates[0];
  if (first === undefined) {
    void window.showWarningMessage(`ファイルが見つかりません: ${rel}`);
    return;
  }
  if (candidates.length === 1) {
    await reveal(byPath.get(first) ?? Uri.file(first), line, beside);
    return;
  }

  // Basenames the artifacts share across packages (`cli.ts`, `index.ts`,
  // `code-summary.md`) are genuinely ambiguous — the citation does not carry
  // enough to pick one, so the human does, the same way Ctrl+P works. The
  // root-relative reading is offered first, but it is offered, not assumed.
  const picked = await window.showQuickPick(
    candidates.map((fsPath) => {
      const uri = byPath.get(fsPath) ?? Uri.file(fsPath);
      return { label: workspace.asRelativePath(uri), uri };
    }),
    { title: `${rel} — ${candidates.length} 件`, placeHolder: "開くファイルを選択してください" },
  );
  if (picked !== undefined) await reveal(picked.uri, line, beside);
}
