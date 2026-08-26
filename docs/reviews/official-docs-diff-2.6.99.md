# Official docs diff report

- generatedAt: `2026-08-26T02:59:22.215Z`
- workspace: `.`
- upstream: `../awslabs/aidlc-workflows`
- snapshotManifest: source=`aidlc-workflows` sourceVersion=`2.6.99` capturedAt=`2026-08-26T02:58:44Z`

## Summary

| Status | Count |
|--------|------:|
| added | 0 |
| removed | 2 |
| modified | 0 |
| unchanged | 87 |

## Added (in upstream, not in snapshot en)

_None._

## Removed (in snapshot en, not in upstream)

- `guide/getting-started.md` — ja present (orphan translation?)
- `reference/scopes.md` — ja absent

## Modified (content hash differs)

_None._

## Unchanged

87 file(s) identical between upstream and snapshot `en`.

## Translate-PR checklist

- [ ] Review **added** and **modified** English pages above
- [ ] Add or refresh `docs/guide|reference/ja/**` counterparts (US-07)
- [x] Bump `docs/official-docs.manifest.json` `sourceVersion` / `capturedAt` when snapshot is updated
- [ ] Keep runtime offline — do not add fetch of upstream into the extension (NFR-1)
