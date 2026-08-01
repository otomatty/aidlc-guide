# Code Generation Plan — docs-shell

Bolt 1 / US-02 thin walking skeleton for the Official Docs Shell in `@aidlc-guide/dashboard`.

- [x] Wire types in `@aidlc-guide/shared-types` (no dashboard → official-docs import)
- [x] `fetchOfficialDocsManifest` / `Toc` / `Page` helpers in `services/api.ts`
- [x] In-webview route (`docsShellOpen`) + header `OfficialDocsButton`
- [x] `DocsShell` layout: SourceVersionBadge + LocaleControl + DocsToc + MarkdownSurface
- [x] `UntranslatedNotice` when `notice === "missing_ja"`
- [x] Vitest: happy path / locale switch / missing_ja notice
- [x] `data-testid` on interactive controls
