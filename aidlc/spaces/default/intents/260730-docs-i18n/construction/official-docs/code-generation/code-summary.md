# Code Summary — official-docs

> 2026-07-31

## Delivered

| Path | Purpose |
|------|---------|
| `packages/official-docs/src/types.ts` | Domain types + DocPath convention docs |
| `packages/official-docs/src/roots.ts` | `parseDocPath`, locale/content-root helpers |
| `packages/official-docs/src/markdown.ts` | `extractTitle` / `headingExists` / `slugifyHeading` |
| `packages/official-docs/src/manifest.ts` | `readManifest` |
| `packages/official-docs/src/resolve.ts` | `resolvePage` |
| `packages/official-docs/src/toc.ts` | `listToc` |
| `packages/official-docs/src/stage-map.ts` | `mapStageToDoc` (7 FR-U3.3 slugs) |
| `packages/official-docs/src/index.ts` | Public exports |
| `packages/official-docs/tests/*.test.ts` | Unit tests (manifest, resolve, toc, stage-map, roots, markdown) |
| `packages/official-docs/tests/content-snapshot.test.ts` | Kept (US-01 / US-07 presence) |

## Public API

- `readManifest(workspaceRoot)` → `ReadResult<Manifest>` (`empty_content` when missing/invalid)
- `resolvePage({ workspaceRoot, locale, path, anchor? })` → `ReadResult<ResolvedPage>`
- `listToc(workspaceRoot, locale)` → `ReadResult<TocTree>`
- `mapStageToDoc(stageSlug)` → `StageDocRef | null`

**DocPath:** `guide/…` or `reference/…` relative to `docs/` (locale is a separate argument). On disk: `docs/<section>/<locale>/<rest>`.

## Verification

```text
bunx vitest run --project node packages/official-docs/tests
# Test Files  7 passed (7)
# Tests       33 passed (33)
```

Also: `bunx biome check packages/official-docs` clean; `bunx tsc --noEmit` clean.

## Constraints respected

- No imports from `dashboard`
- No app code under `aidlc/` record dirs
- FS reads go through `guardPath` + `readBounded` / `withResult`
- Locales limited to `en` | `ja`; no network I/O

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-07-31

Implementation matches FD/NFR layout: Result-shaped resolve/load, containment via core-utils, ja fallback notice, seven-slug stage map, and Vitest coverage of happy + error paths. Architecture-reviewer may refine this verdict.
