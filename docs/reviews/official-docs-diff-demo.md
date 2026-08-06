# Official docs diff report

- generatedAt: `2026-08-06T04:00:00.000Z`
- workspace: `.`
- upstream: `packages/official-docs/tests/fixtures/upstream-docs`
- snapshotManifest: source=`aidlc-workflows` sourceVersion=`fixture-2026-07-31` capturedAt=`2026-07-31T06:40:26Z`

## Summary

| Status | Count |
|--------|------:|
| added | 2 |
| removed | 0 |
| modified | 1 |
| unchanged | 1 |

## Added (in upstream, not in snapshot en)

- `guide/00-introduction.md` — ja missing — needs translation
- `guide/agents/README.md` — ja missing — needs translation

## Removed (in snapshot en, not in upstream)

_None._

## Modified (content hash differs)

- `reference/scopes.md` — ja missing — needs translation

## Unchanged

1 file(s) identical between upstream and snapshot `en`.

## Translate-PR checklist

- [ ] Review **added** and **modified** English pages above
- [ ] Add or refresh `docs/guide|reference/ja/**` counterparts (US-07)
- [ ] Bump `docs/official-docs.manifest.json` `sourceVersion` / `capturedAt` when snapshot is updated
- [ ] Keep runtime offline — do not add fetch of upstream into the extension (NFR-1)
