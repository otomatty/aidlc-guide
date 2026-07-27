import path from "node:path";

/**
 * The part of "open this reference" that does not need an editor: whether a
 * webview-supplied path may be opened at all, and what to search for when it is
 * only a fragment of one.
 *
 * Split out from `open-file.ts` so it can be tested — this package's `vscode`
 * imports are not loadable under vitest, and this is the half worth testing.
 *
 * It repeats a containment check `viewer/file-ref.ts` already makes in the
 * dashboard. That is not redundancy: the dashboard's copy stops the UI from
 * offering an impossible jump, and this one is the trust boundary. A webview is
 * not a trusted caller, so the path arrives here unvalidated by definition.
 */

export interface FileRefTarget {
  /** Absolute path to try literally, or `null` when the reference is a fragment. */
  direct: string | null;
  /** `workspace.findFiles` include pattern for the fallback search. */
  glob: string;
}

/** POSIX path characters only — the dialect the artifacts are written in. */
const SAFE = /^[\w./-]+$/;

/** `true` when `candidate` is strictly under `root`. */
export function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function fileRefTarget(workspaceRoot: string, rel: string): FileRefTarget | null {
  if (rel === "" || rel.startsWith("/") || !SAFE.test(rel)) return null;
  const segments = rel.split("/");
  if (segments.includes("..") || segments.includes("") || segments.includes(".")) return null;

  // `path.resolve` and `path.relative` are what keep this correct on both
  // Windows and macOS (C-T4/NFR-4); nothing here assumes a separator.
  const absolute = path.resolve(workspaceRoot, rel);
  return {
    // A bare `cli.ts` resolves to `<root>/cli.ts`, which is contained but is
    // almost never the file meant — 30 artifacts cite `cli.ts` and none of them
    // mean the repo root. Only a reference that already carries a directory is
    // worth trying literally; everything else goes straight to the search.
    direct: segments.length > 1 && isInside(workspaceRoot, absolute) ? absolute : null,
    glob: `**/${rel}`,
  };
}
