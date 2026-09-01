# Official docs diff report

- generatedAt: `2026-09-01T07:38:23.798Z`
- workspace: `.`
- upstream: `awslabs/aidlc-workflows@96b11d390289`
- snapshotManifest: source=`aidlc-workflows` sourceVersion=`2.6.124` capturedAt=`2026-08-31T01:58:12Z`

## Summary

| Status | Count |
|--------|------:|
| added | 0 |
| removed | 2 |
| modified | 8 |
| unchanged | 96 |

## Added (in upstream, not in snapshot en)

_None._

## Removed (in snapshot en, not in upstream)

- `guide/getting-started.md` — ja present (orphan translation?)
- `reference/scopes.md` — ja absent

## Modified (content hash differs)

- `guide/01-getting-started.md` — ja present — review for refresh
- `guide/harnesses/codex-cli.md` — ja present — review for refresh
- `guide/harnesses/copilot.md` — ja present — review for refresh
- `guide/harnesses/kiro-cli.md` — ja present — review for refresh
- `guide/harnesses/kiro-ide.md` — ja present — review for refresh
- `guide/harnesses/opencode.md` — ja present — review for refresh
- `overview/roadmap.md` — ja present — review for refresh
- `reference/03-orchestrator.md` — ja present — review for refresh

## Unchanged

96 file(s) identical between upstream and snapshot `en`.

## Translate-PR checklist

- [ ] Review **added** and **modified** English pages above
- [ ] Add or refresh `docs/<section>/ja/**` counterparts (US-07)
- [ ] Bump `docs/official-docs.manifest.json` `sourceVersion` / `capturedAt` when snapshot is updated
- [ ] Keep runtime offline — do not add fetch of upstream into the extension (NFR-1)
