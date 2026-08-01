# Code Generation Plan — content-snapshot

> Unit: content-snapshot (packaging) · 2026-07-31 · Standard test strategy

## Steps

- [x] Create `docs/guide/en/` + `docs/reference/en/` with non-empty content (US-01)
- [x] Create `docs/official-docs.manifest.json` with sourceVersion/source/capturedAt (US-01 / FR-U1.2)
- [x] Bootstrap ≥1 ja page under `docs/guide/ja/` (US-07)
- [x] Keep product `docs/guides/` untouched (distinct root)
- [x] Add Vitest presence tests under `packages/official-docs/tests/content-snapshot.test.ts`
- [x] Scaffold `@aidlc-guide/official-docs` package.json (workspace entry for tests; resolve later)
- [ ] Optional: upstream ingest script (deferred — fixture trees satisfy Bolt 1)

## Story traceability

| Story | Steps |
|-------|-------|
| US-01 | en trees + manifest |
| US-07 | ja bootstrap page |
