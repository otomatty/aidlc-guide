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
  /**
   * The citation read as a root-relative path — the *preferred* candidate, not
   * the answer. `null` when the citation carries no directory to read that way.
   */
  direct: string | null;
  /** `workspace.findFiles` include pattern for the search. */
  glob: string;
}

/** POSIX path characters only — the dialect the artifacts are written in. */
const SAFE = /^[\w./-]+$/;

/** `true` when `candidate` is strictly under `root`. */
export function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function fileRefTarget(workspaceRoot: string, cited: string): FileRefTarget | null {
  // `./util/guard-path.ts` means `util/guard-path.ts`, the same normalisation
  // the `open-doc` handler applies. Only the leading pair: `./../x` becomes
  // `../x` and is refused below with every other escape.
  const rel = cited.replace(/^\.\//, "");
  if (rel === "" || rel.startsWith("/") || !SAFE.test(rel)) return null;
  const segments = rel.split("/");
  if (segments.includes("..") || segments.includes("") || segments.includes(".")) return null;

  // `path.resolve` and `path.relative` are what keep this correct on both
  // Windows and macOS (C-T4/NFR-4); nothing here assumes a separator.
  const absolute = path.resolve(workspaceRoot, rel);
  return {
    // A bare `cli.ts` resolves to `<root>/cli.ts`, which is contained but is
    // almost never the file meant — 30 artifacts cite `cli.ts` and none of them
    // mean the repo root. Only a citation that already carries a directory is
    // worth reading as a root-relative path at all.
    direct: segments.length > 1 && isInside(workspaceRoot, absolute) ? absolute : null,
    glob: `**/${rel}`,
  };
}

/**
 * Order the candidates for a citation: the root-relative reading first when it
 * exists, then everything the search turned up, each path once.
 *
 * Ranking rather than short-circuiting, because a partial citation can be *both*
 * a real root-relative path and a suffix of a deeper one — `services/api.ts`
 * with `<root>/services/api.ts` and `<root>/packages/foo/services/api.ts` both
 * present. Opening the root copy on sight would silently pick a file the
 * artifact may not mean, and silently wrong beats no worse than a prompt.
 */
export function rankCandidates(direct: string | null, found: readonly string[]): string[] {
  const seen = new Set<string>();
  const ranked: string[] = [];
  for (const candidate of direct === null ? found : [direct, ...found]) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    ranked.push(candidate);
  }
  return ranked;
}
