# Code Summary — docs-shell

> 2026-07-31 · Bolt 1 / US-02 thin walking skeleton

## Delivered

| Path | Purpose |
|------|---------|
| `packages/shared-types/src/index.ts` | Wire types: `OfficialDocsManifest` / `Toc` / `Page` / `Locale` |
| `packages/dashboard/src/services/api.ts` | `fetchOfficialDocsManifest` / `Toc` / `Page` |
| `packages/dashboard/src/store/state.ts` | `docsShellOpen` route flag |
| `packages/dashboard/src/store/reducer.ts` | `docs-shell` action + route exclusivity |
| `packages/dashboard/src/components/OfficialDocsButton.tsx` | Header entry |
| `packages/dashboard/src/components/DocsShell.tsx` | Panel: header + TOC + article |
| `packages/dashboard/src/components/docs-shell/*` | LocaleControl, DocsToc, UntranslatedNotice, SourceVersionBadge |
| `packages/dashboard/src/components/Header.tsx` | Mount OfficialDocsButton |
| `packages/dashboard/src/app/App.tsx` | Mount DocsShell; park home when open |
| `packages/dashboard/tests/docs-shell.test.tsx` | Happy path / locale / missing_ja |
| `packages/dashboard/tests/dependency-direction.test.ts` | Ban `@aidlc-guide/official-docs` |

## Behaviour

1. Open Shell → fetch manifest + TOC for locale; auto-select first TOC entry and load page
2. TOC select → `GET /api/official-docs/:locale/<docPath>` → MarkdownSurface
3. LocaleControl en|ja → keep path; refetch TOC + page
4. Header shows `sourceVersion` (page, else manifest)
5. `notice === "missing_ja"` → UntranslatedNotice (`role="status"`)

## Constraints respected

- No dashboard import of `@aidlc-guide/official-docs` or `reader-core`
- Reuses PanelShell, MarkdownSurface, VS Code / theme tokens
- GET-only via existing transport

## Verification

```text
bunx vitest run --project dashboard packages/dashboard/tests/docs-shell.test.tsx packages/dashboard/tests/dependency-direction.test.ts
# Test Files  2 passed (2)
# Tests       10 passed (10)

bunx tsc --noEmit -p packages/dashboard
# exit 0
```

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-07-31
