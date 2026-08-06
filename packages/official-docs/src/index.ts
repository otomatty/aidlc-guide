/**
 * `@aidlc-guide/official-docs` — locale-scoped load/resolve for bundled
 * aidlc-workflows docs under `docs/guide|<reference>/<locale>/`.
 *
 * Public DocPath convention: `guide/getting-started.md` or
 * `reference/scopes.md` (relative to `docs/`, never includes locale).
 *
 * Dashboard must not import this package (structural ban — consumers are
 * api-core / docs-shell). No network I/O (BR-OD-9).
 */

export const OFFICIAL_DOCS_MANIFEST_REL = "docs/official-docs.manifest.json";

export type {
  BuildDiffReportInput,
  DiffEntry,
  DiffReport,
  DiffStatus,
} from "./diff-report.ts";
export {
  buildDiffReport,
  formatDiffReport,
  resolveUpstreamDocsRoot,
  walkContentFiles,
} from "./diff-report.ts";
export { readManifest } from "./manifest.ts";
export { extractTitle, headingExists, slugifyHeading } from "./markdown.ts";
export { resolvePage } from "./resolve.ts";
export { isLocale, localeContentRoot, parseDocPath } from "./roots.ts";
export { MAPPED_STAGE_SLUGS, mapStageToDoc } from "./stage-map.ts";
export { listToc } from "./toc.ts";
export type {
  AnchorApplied,
  DocPath,
  DocSection,
  Locale,
  Manifest,
  OfficialDocsReason,
  PageNotice,
  ResolvedPage,
  ResolvePageInput,
  StageDocRef,
  TocNode,
  TocTree,
} from "./types.ts";
