# Official docs diff report

- generatedAt: `2026-08-24T06:39:38.752Z`
- workspace: `.`
- upstream: `../awslabs/aidlc-workflows`
- snapshotManifest: source=`aidlc-workflows` sourceVersion=`2.6.36` capturedAt=`2026-08-21T09:19:25Z`

## Summary

| Status | Count |
|--------|------:|
| added | 1 |
| removed | 2 |
| modified | 37 |
| unchanged | 46 |

## Added (in upstream, not in snapshot en)

- `guide/workflow-profiles.md` — ja missing — needs translation

## Removed (in snapshot en, not in upstream)

- `guide/getting-started.md` — ja present (orphan translation?)
- `reference/scopes.md` — ja absent

## Modified (content hash differs)

- `guide/00-introduction.md` — ja present — review for refresh
- `guide/01-getting-started.md` — ja present — review for refresh
- `guide/02-your-first-workflow.md` — ja present — review for refresh
- `guide/04-phases-and-stages.md` — ja present — review for refresh
- `guide/05-scopes-and-depth.md` — ja present — review for refresh
- `guide/06-agents.md` — ja present — review for refresh
- `guide/07-interaction-modes.md` — ja present — review for refresh
- `guide/08-knowledge.md` — ja present — review for refresh
- `guide/09-rules-and-the-learning-loop.md` — ja present — review for refresh
- `guide/10-state-and-audit.md` — ja present — review for refresh
- `guide/11-session-management.md` — ja present — review for refresh
- `guide/12-cli-commands.md` — ja present — review for refresh
- `guide/13-customization.md` — ja present — review for refresh
- `guide/14-artifacts-reference.md` — ja present — review for refresh
- `guide/15-troubleshooting.md` — ja present — review for refresh
- `guide/glossary.md` — ja present — review for refresh
- `guide/harnesses/codex-cli.md` — ja present — review for refresh
- `guide/harnesses/copilot.md` — ja present — review for refresh
- `guide/harnesses/kiro-ide.md` — ja present — review for refresh
- `guide/harnesses/opencode.md` — ja present — review for refresh
- `reference/00-overview.md` — ja present — review for refresh
- `reference/01-architecture.md` — ja present — review for refresh
- `reference/03-orchestrator.md` — ja present — review for refresh
- `reference/04-stage-protocol.md` — ja present — review for refresh
- `reference/05-agent-system.md` — ja present — review for refresh
- `reference/06-hooks-and-tools.md` — ja present — review for refresh
- `reference/10-knowledge-system.md` — ja present — review for refresh
- `reference/11-contributing.md` — ja present — review for refresh
- `reference/12-state-machine.md` — ja present — review for refresh
- `reference/13-runtime-graph.md` — ja present — review for refresh
- `reference/14-claude-features.md` — ja present — review for refresh
- `reference/15-stage-definition.md` — ja present — review for refresh
- `reference/16-artifact-vocabulary.md` — ja present — review for refresh
- `reference/17-skill-system.md` — ja present — review for refresh
- `reference/18-plugin-mechanism.md` — ja present — review for refresh
- `reference/agents/README.md` — ja present — review for refresh
- `reference/kiro-ide-hook-payload.md` — ja present — review for refresh

## Unchanged

46 file(s) identical between upstream and snapshot `en`.

## Translate-PR checklist

- [ ] Review **added** and **modified** English pages above
- [ ] Add or refresh `docs/guide|reference/ja/**` counterparts (US-07)
- [ ] Bump `docs/official-docs.manifest.json` `sourceVersion` / `capturedAt` when snapshot is updated
- [ ] Keep runtime offline — do not add fetch of upstream into the extension (NFR-1)
