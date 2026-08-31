# Official docs diff report

- generatedAt: `2026-08-31T01:58:12.936Z`
- workspace: `.`
- upstream: `awslabs/aidlc-workflows@82d2e304206c`
- snapshotManifest: source=`aidlc-workflows` sourceVersion=`2.6.124` capturedAt=`2026-08-31T01:48:09Z`

## Summary

| Status | Count |
|--------|------:|
| added | 17 |
| removed | 2 |
| modified | 0 |
| unchanged | 87 |

## Added (in upstream, not in snapshot en)

- `harness-engineering/00-overview.md` — ja missing — needs translation
- `harness-engineering/01-anatomy-of-a-stage.md` — ja missing — needs translation
- `harness-engineering/02-adding-a-stage.md` — ja missing — needs translation
- `harness-engineering/03-adding-an-agent.md` — ja missing — needs translation
- `harness-engineering/04-scopes.md` — ja missing — needs translation
- `harness-engineering/05-rules-and-the-loop.md` — ja missing — needs translation
- `harness-engineering/06-sensors.md` — ja missing — needs translation
- `harness-engineering/07-team-knowledge.md` — ja missing — needs translation
- `harness-engineering/08-construction-and-swarm.md` — ja missing — needs translation
- `harness-engineering/09-porting-to-a-new-harness.md` — ja missing — needs translation
- `harness-engineering/10-authoring-a-plugin.md` — ja missing — needs translation
- `overview/README.md` — ja missing — needs translation
- `overview/roadmap.md` — ja missing — needs translation
- `rfcs/IMPLEMENTATION-PLAN.html` — ja missing — needs translation
- `rfcs/IMPLEMENTATION-PLAN.md` — ja missing — needs translation
- `rfcs/kiro-ide-hooks-fix-plan.html` — ja missing — needs translation
- `rfcs/reviewer-reliability-and-stage-decomposition.md` — ja missing — needs translation

## Removed (in snapshot en, not in upstream)

- `guide/getting-started.md` — ja present (orphan translation?)
- `reference/scopes.md` — ja absent

## Modified (content hash differs)

_None._

## Unchanged

87 file(s) identical between upstream and snapshot `en`.

## Translate-PR checklist

- [ ] Review **added** and **modified** English pages above
- [ ] Add or refresh `docs/<section>/ja/**` counterparts (US-07)
- [ ] Bump `docs/official-docs.manifest.json` `sourceVersion` / `capturedAt` when snapshot is updated
- [ ] Keep runtime offline — do not add fetch of upstream into the extension (NFR-1)
