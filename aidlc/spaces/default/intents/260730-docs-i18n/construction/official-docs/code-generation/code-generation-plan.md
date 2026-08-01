# Code Generation Plan — official-docs

> Unit: official-docs (library) · 2026-07-31 · Standard test strategy

## Steps

- [x] Implement `readManifest` via `guardPath` + `readBounded` on `docs/official-docs.manifest.json`
- [x] Implement `resolvePage` (locale validate, DocPath parse, containment, ja→en `missing_ja`, anchors)
- [x] Implement `listToc` (guide + reference; en structure authoritative when ja sparse)
- [x] Implement `mapStageToDoc` static table for seven FR-U3.3 slugs
- [x] Export public API from `packages/official-docs/src/index.ts` (keep `OFFICIAL_DOCS_MANIFEST_REL`)
- [x] Add Vitest suites under `packages/official-docs/tests/` (keep `content-snapshot.test.ts`)
- [x] Run `bunx vitest run --project node packages/official-docs/tests` green
- [x] Biome + `tsc --noEmit` clean for the package

## Module layout (nfr-design/logical-components.md)

| File | Responsibility |
|------|----------------|
| `types.ts` | Manifest, ResolvedPage, TocTree, StageDocRef, DocPath convention |
| `roots.ts` | Locale / DocPath parse + content-root helpers |
| `markdown.ts` | Title + GitHub-style anchor match |
| `manifest.ts` | `readManifest` |
| `resolve.ts` | `resolvePage` |
| `toc.ts` | `listToc` |
| `stage-map.ts` | `mapStageToDoc` |
| `index.ts` | Public surface |

## Story / FR traceability

| Story / FR | Coverage |
|------------|----------|
| FR-U1.2 / US-01 | `readManifest` + content-snapshot tests |
| FR-U2.3 / US-03 | `anchorApplied` scrolled / top / none |
| FR-U2.5 / US-04 | ja missing → en + `notice: missing_ja` |
| FR-U3.3 / US-05 | seven-slug `mapStageToDoc` + null unmapped |
| NFR-2 | `path_rejected` on `../` escape; all reads via `guardPath` |
| NFR-1 | No network I/O in package |
| NFR-3 | Resolve/load branch tests (manifest, resolve, toc, roots, markdown) |
