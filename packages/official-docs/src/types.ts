/**
 * Domain types for `@aidlc-guide/official-docs`.
 *
 * DocPath convention (public API): POSIX path relative to `docs/`, always
 * prefixed with `guide/` or `reference/` — e.g. `guide/getting-started.md`,
 * `reference/scopes.md`. Locale is never embedded in DocPath; it is a separate
 * argument. On disk the file lives at
 * `docs/<guide|reference>/<locale>/<rest-of-DocPath>`.
 */

export type Locale = "en" | "ja";

export type DocSection = "guide" | "reference";

/** Public doc path: `guide/…` or `reference/…` (see file header). */
export type DocPath = string;

export type AnchorApplied = "scrolled" | "top" | "none";

export type PageNotice = "missing_ja";

export interface Manifest {
  sourceVersion: string;
  source: string;
  capturedAt: string;
}

export interface ResolvedPage {
  localeRequested: Locale;
  localeServed: Locale;
  path: DocPath;
  bodyMarkdown: string;
  title?: string;
  notice?: PageNotice;
  sourceVersion: string;
  anchorApplied: AnchorApplied;
}

export interface TocNode {
  id: string;
  title: string;
  path: DocPath;
  children: TocNode[];
}

/** Guide + reference TOC trees for one locale. */
export interface TocTree {
  guide: TocNode[];
  reference: TocNode[];
}

export interface StageDocRef {
  path: DocPath;
  anchor?: string;
}

export interface ResolvePageInput {
  workspaceRoot: string;
  /** Must be `en` | `ja` at runtime; invalid values → `path_rejected`. */
  locale: Locale | (string & {});
  path: DocPath;
  anchor?: string;
}

/** Result reasons used by this package (component-methods.md). */
export type OfficialDocsReason = "not_found" | "path_rejected" | "empty_content";
