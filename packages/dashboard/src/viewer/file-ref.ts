/**
 * Recognising a file reference inside an inline code span, so that the artifact
 * dialect's `packages/btw/src/plan.ts:20` becomes a jump instead of decoration.
 *
 * A leaf module with **no imports**, for the same reason `artifact-path.ts` is
 * one: `MarkdownSurface` runs this over every code span it renders, and the
 * rule has to be testable without dragging a renderer into the test.
 *
 * Deliberately *syntactic*. Whether the file exists — and where it is, when the
 * artifact cites only a basename — is the extension host's question, answered
 * on click. Asking it at render time would mean one round-trip per code span on
 * the first-paint path (P-AV-1).
 */

export interface FileRef {
  /** POSIX, repo-relative or partial. Never absolute, never contains `..`. */
  path: string;
  /** 1-based. `null` when the reference names no line. */
  line: number | null;
}

/**
 * An allow-list rather than a "looks like a dotted name" rule, because the
 * corpus is full of dotted things that are not files: `127.0.0.1`, `0.0.0.0`,
 * `node:path`. Extensions the artifacts actually cite, and no others.
 */
const EXTENSION = /\.(?:tsx?|jsx?|mjs|cjs|json|md|css|html?|ya?ml|toml|sh|sql)$/i;

/**
 * Files whose name carries no extension at all. A closed list rather than a
 * rule, because "has no extension" also describes `guardPath`, `main`, `live`
 * and `--host`, and "starts with a dot" also describes `.then`, `.parse`,
 * `.local` and `.ts.net` — every one of them a code span in the corpus. A fixed
 * set cannot grow a false positive; a heuristic here would be nothing but.
 *
 * `.gitignore` alone is cited 19 times.
 */
const EXTENSIONLESS = new Set([
  ".editorconfig",
  ".env",
  ".gitattributes",
  ".gitignore",
  ".npmrc",
  ".nvmrc",
  "Dockerfile",
  "Makefile",
]);

/** Matched against the basename, so `packages/x/.gitignore` counts too. */
function namesAFile(target: string): boolean {
  return EXTENSION.test(target) || EXTENSIONLESS.has(target.slice(target.lastIndexOf("/") + 1));
}

/** `:20`, `:88-91`, `:88-91,188-195` — the artifact dialect's line suffixes. */
const LINE_SUFFIX = /:(\d+)[-,\d]*$/;

/** POSIX path characters only. Anything else is prose, not a path. */
const PATH_CHARS = /^[\w./-]+$/;

export function parseFileRef(text: string): FileRef | null {
  const trimmed = text.trim();
  // A code span containing whitespace is a command or a sentence
  // (`bun run check`, `GET /api/workflow`), and one containing a glob
  // (`packages/*`, `*-questions.md`) names a set rather than a file.
  if (trimmed === "" || /\s/.test(trimmed) || /[*?]/.test(trimmed)) return null;

  const suffix = LINE_SUFFIX.exec(trimmed);
  // A multi-range citation (`:88-91,188-195`) jumps to the first line named:
  // one of them has to win, and the first is the one the sentence is about.
  const line = suffix === null ? null : Number(suffix[1]);
  const cited = suffix === null ? trimmed : trimmed.slice(0, suffix.index);
  // `./util/guard-path.ts` means `util/guard-path.ts`. Dropping the prefix is
  // what `open-doc` already does host-side, and it keeps this in step with
  // `file-ref-target.ts`, which refuses a `.` segment — without the strip the
  // citation would render as a link and then warn when clicked. Only the
  // leading pair goes: `./../x` still becomes `../x` and is refused below.
  const target = cited.replace(/^\.\//, "");

  if (line !== null && (!Number.isSafeInteger(line) || line < 1)) return null;
  if (!PATH_CHARS.test(target) || !namesAFile(target)) return null;

  // The client-side half of path containment: an absolute path or a `..`
  // segment would resolve outside the workspace. `file-ref-target.ts` in the
  // extension repeats this, because a webview is not a trusted caller — this
  // one stops the UI from *offering* a jump that the host would then refuse.
  const segments = target.split("/");
  if (target.startsWith("/")) return null;
  if (segments.includes("..") || segments.includes(".") || segments.includes("")) return null;

  return { path: target, line };
}
