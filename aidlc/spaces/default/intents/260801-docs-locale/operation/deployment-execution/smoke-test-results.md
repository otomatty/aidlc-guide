# Smoke Test Results — Docs i18n Bolt 2

> deployment-execution / 2026-08-02  
> 上流: [deployment-log.md](./deployment-log.md) · [build-test-results.md](../../construction/build-and-test/build-test-results.md) · [cd-config.md](../deployment-pipeline/cd-config.md) · [deployment-strategy.md](../deployment-pipeline/deployment-strategy.md)

## Automated smoke (executed)

| Suite | Command | Result |
|-------|---------|--------|
| official-docs + routes | `bunx vitest run --project node packages/official-docs/tests packages/api-core/tests/official-docs-routes.test.ts` | **50 passed** |
| docs-shell UI | `bunx vitest run packages/dashboard/tests/docs-shell.test.tsx` | **12 passed** |

## AC mapping

| AC | Covered by |
|----|------------|
| keep-path / missing_ja / anchorApplied | official-docs tests |
| missing_ja→200 / not_found→404 | official-docs-routes |
| UI notice / AnchorApplier / 404≠notice | docs-shell tests |

## Manual smoke (deferred)

[extension-manual-scenarios.md](../../construction/docs-shell/code-generation/extension-manual-scenarios.md) — human Extension Docs Shell scenarios (FR-B2-5.2).

## Review

**Verdict:** READY — automated smoke green.
