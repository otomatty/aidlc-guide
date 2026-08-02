# Deployment Log — Docs i18n Bolt 2

> deployment-execution / 2026-08-02  
> 上流: [cd-config.md](../deployment-pipeline/cd-config.md) · [deployment-strategy.md](../deployment-pipeline/deployment-strategy.md) · [environment-inventory.md](../environment-provisioning/environment-inventory.md) · [build-test-results.md](../../construction/build-and-test/build-test-results.md)

## Execution mode

**Local release candidate validation** — no cloud CD job ran (project DECIDED).

| Timestamp (UTC) | Action | Result |
|-----------------|--------|--------|
| 2026-08-02T02:05:00Z | Pre-check: Bolt 2 suites selected | OK |
| 2026-08-02T02:05:21Z | `vitest` official-docs + official-docs-routes | 50 passed |
| 2026-08-02T02:05:24Z | `vitest` docs-shell | 12 passed |
| — | `bun run build:extension` / VSIX install | **Not run** (optional human; see FR-B2-5.2 checklist) |
| — | Marketplace / AWS deploy | N/A |

## Artifacts shipped in workspace

- `packages/official-docs` (resolve/roots/markdown + tests)
- `packages/api-core` route tests for notice/404
- `packages/dashboard` DocsShell keep-path / AnchorApplier / notice
- `vitest.config.ts` NFR-B2-1 thresholds

## Review

**Verdict:** READY
