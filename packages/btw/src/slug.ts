/**
 * cwd -> Claude Code project-directory slug (business-logic-model.md, BR-2).
 *
 * The rule is a single-character substitution: each of `\` `/` `:` `.` becomes
 * `-`. Deliberately a pure string transform with no `node:path` normalisation —
 * normalising here would rewrite a POSIX path when run on Windows (and vice
 * versa), which would break the very cross-platform contract it is meant to
 * serve. Callers pass an already-absolute path (`process.cwd()`).
 *
 *   C:\work\aidlc-guide     -> C--work-aidlc-guide
 *   /Users/dev/aidlc-guide  -> -Users-dev-aidlc-guide
 *
 * This mirrors an internal Claude Code convention (external-dependency-map E3);
 * when it drifts, `resolve.ts` surfaces the computed path verbatim so the user
 * can diff it against the real directory.
 */
export function projectSlug(cwd: string): string {
  return cwd.replace(/[\\/:.]/g, "-");
}
