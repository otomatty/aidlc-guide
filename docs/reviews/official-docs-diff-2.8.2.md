# Official docs diff report

- generatedAt: `2026-09-14T03:06:01.159Z`
- workspace: `.`
- upstream: `awslabs/aidlc-workflows@355903d6dc8e`
- snapshotManifest: source=`aidlc-workflows` sourceVersion=`2.8.0` capturedAt=`2026-09-09T05:08:59Z`

## Summary

| Status | Count |
|--------|------:|
| added | 3 |
| removed | 3 |
| modified | 34 |
| unchanged | 344 |

## Added (in upstream, not in snapshot en)

- `overview/releases/2.8.1.md` — ja missing — needs translation
- `overview/releases/2.8.2.md` — ja missing — needs translation
- `overview/releases/2.8.6.md` — ja missing — needs translation

## Removed (in snapshot en, not in upstream)

- `guide/getting-started.md` — ja present (orphan translation?)
- `overview/release-highlights.md` — ja present (orphan translation?)
- `reference/scopes.md` — ja absent

## Modified (content hash differs)

- `guide/00-introduction.md` — ja present — review for refresh
- `guide/01-getting-started.md` — ja present — review for refresh
- `guide/05-scopes-and-depth.md` — ja present — review for refresh
- `guide/06-agents.md` — ja present — review for refresh
- `guide/08-knowledge.md` — ja present — review for refresh
- `guide/10-state-and-audit.md` — ja present — review for refresh
- `guide/12-cli-commands.md` — ja present — review for refresh
- `guide/13-customization.md` — ja present — review for refresh
- `guide/15-troubleshooting.md` — ja present — review for refresh
- `guide/18-install-and-lifecycle.md` — ja missing — needs translation
- `guide/glossary.md` — ja present — review for refresh
- `guide/harnesses/kiro-ide.md` — ja present — review for refresh
- `harness-engineering/01-anatomy-of-a-stage.md` — ja present — review for refresh
- `harness-engineering/02-adding-a-stage.md` — ja present — review for refresh
- `harness-engineering/04-scopes.md` — ja present — review for refresh
- `harness-engineering/05-rules-and-the-loop.md` — ja present — review for refresh
- `overview/changelog.md` — ja missing — needs translation
- `overview/README.md` — ja present — review for refresh
- `reference/00-overview.md` — ja present — review for refresh
- `reference/01-architecture.md` — ja present — review for refresh
- `reference/03-orchestrator.md` — ja present — review for refresh
- `reference/04-stage-protocol.md` — ja present — review for refresh
- `reference/04-stages/construction.md` — ja present — review for refresh
- `reference/06-hooks-and-tools.md` — ja present — review for refresh
- `reference/09-testing.md` — ja present — review for refresh
- `reference/10-knowledge-system.md` — ja present — review for refresh
- `reference/11-contributing.md` — ja present — review for refresh
- `reference/12-state-machine.md` — ja present — review for refresh
- `reference/13-runtime-graph.md` — ja present — review for refresh
- `reference/15-stage-definition.md` — ja present — review for refresh
- `reference/16-artifact-vocabulary.md` — ja present — review for refresh
- `reference/17-skill-system.md` — ja present — review for refresh
- `reference/19-supply-chain-security.md` — ja missing — needs translation
- `reference/kiro-ide-hook-payload.md` — ja present — review for refresh

## Unchanged

344 file(s) identical between upstream and snapshot `en`.

## Translate-PR checklist

- [ ] Review **added** and **modified** English pages above
- [ ] Add or refresh `docs/<section>/ja/**` counterparts (US-07)
- [ ] Bump `docs/official-docs.manifest.json` `sourceVersion` / `capturedAt` when snapshot is updated
- [ ] Keep runtime offline — do not add fetch of upstream into the extension (NFR-1)
