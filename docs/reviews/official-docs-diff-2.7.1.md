# Official docs diff report

- generatedAt: `2026-09-02T03:05:24.459Z`
- workspace: `.`
- upstream: `awslabs/aidlc-workflows@a277af218f0d`
- snapshotManifest: source=`aidlc-workflows` sourceVersion=`2.7.0` capturedAt=`2026-09-01T07:38:23Z`

## Summary

| Status | Count |
|--------|------:|
| added | 0 |
| removed | 2 |
| modified | 1 |
| unchanged | 103 |

## Added (in upstream, not in snapshot en)

_None._

## Removed (in snapshot en, not in upstream)

- `guide/getting-started.md` — ja present (orphan translation?)
- `reference/scopes.md` — ja absent

## Modified (content hash differs)

- `reference/06-hooks-and-tools.md` — ja present — review for refresh

## Unchanged

103 file(s) identical between upstream and snapshot `en`.

## Translate-PR checklist

- [ ] Review **added** and **modified** English pages above
- [ ] Add or refresh `docs/<section>/ja/**` counterparts (US-07)
- [ ] Bump `docs/official-docs.manifest.json` `sourceVersion` / `capturedAt` when snapshot is updated
- [ ] Keep runtime offline — do not add fetch of upstream into the extension (NFR-1)
