# Deployment Log — Docs i18n Bolt 3

> deployment-execution / 2026-08-02  
> 上流: [cd-config.md](../deployment-pipeline/cd-config.md) · [deployment-strategy.md](../deployment-pipeline/deployment-strategy.md) · [environment-inventory.md](../environment-provisioning/environment-inventory.md) · [build-test-results.md](../../construction/build-and-test/build-test-results.md)  
> Q1 = A

## Execution mode

**Local release candidate validation** — no cloud CD job ran (NFR-B3-2).

| Timestamp (UTC) | Action | Result |
|-----------------|--------|--------|
| 2026-08-02T08:19:00Z | Pre-check: Bolt 3 focused suite selected | OK |
| 2026-08-02T08:19:39Z | `vitest` open-official-doc + docs-shell + map/route/boundary | **45 passed** |
| — | `bun run build:extension` / VSIX install | **Not run** (optional human; demo-record) |
| — | Marketplace / AWS deploy | N/A |

## Artifacts shipped in workspace

- `packages/vscode-extension` — `open-official-doc` host handler
- `packages/dashboard` — OpenOfficialDocLink / StageCard / DocsShell locale deep-link
- `packages/shared-types` — OpenOfficialDocMessage / DocsShellDeepLink
- Map lock + api-core stage route tests (unchanged STAGE_DOC_MAP)

## Review

**Verdict:** READY
