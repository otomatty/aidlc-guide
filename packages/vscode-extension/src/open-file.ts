import {
  commands,
  Position,
  Range,
  Selection,
  TextEditorRevealType,
  Uri,
  window,
  workspace,
} from "vscode";
import { fileRefTarget } from "./file-ref-target.ts";

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

async function reveal(uri: Uri, line: number | null): Promise<void> {
  if (line === null) {
    await commands.executeCommand("vscode.open", uri);
    return;
  }
  const doc = await workspace.openTextDocument(uri);
  // An artifact outlives the edits made after it was written, so a cited line
  // can now be past the end. Clamp rather than throw: landing in the right file
  // at the last line beats an error message.
  const at = new Position(Math.min(line - 1, Math.max(doc.lineCount - 1, 0)), 0);
  const editor = await window.showTextDocument(doc, { preview: true });
  editor.selection = new Selection(at, at);
  editor.revealRange(new Range(at, at), TextEditorRevealType.InCenter);
}

export async function openFileRef(
  workspaceRoot: string,
  rel: string,
  line: number | null,
): Promise<void> {
  const target = fileRefTarget(workspaceRoot, rel);
  if (target === null) {
    void window.showWarningMessage(`開けないパスです: ${rel}`);
    return;
  }

  if (target.direct !== null && (await exists(Uri.file(target.direct)))) {
    await reveal(Uri.file(target.direct), line);
    return;
  }

  const matches = await workspace.findFiles(target.glob, "**/node_modules/**", MAX_MATCHES);
  if (matches.length === 0) {
    void window.showWarningMessage(`ファイルが見つかりません: ${rel}`);
    return;
  }
  const only = matches[0];
  if (matches.length === 1 && only !== undefined) {
    await reveal(only, line);
    return;
  }

  // Basenames the artifacts share across packages (`cli.ts`, `index.ts`,
  // `code-summary.md`) are genuinely ambiguous — the citation does not carry
  // enough to pick one, so the human does, the same way Ctrl+P works.
  const picked = await window.showQuickPick(
    matches.map((uri) => ({ label: workspace.asRelativePath(uri), uri })),
    { title: `${rel} — ${matches.length} 件`, placeHolder: "開くファイルを選択してください" },
  );
  if (picked !== undefined) await reveal(picked.uri, line);
}
