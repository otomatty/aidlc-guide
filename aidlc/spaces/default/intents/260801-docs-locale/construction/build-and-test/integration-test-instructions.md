# Integration Test Instructions — Docs i18n Bolt 2

> build-and-test / Standard strategy / 2026-08-02  
> 上流: [official-docs code-summary](../official-docs/code-generation/code-summary.md) · [docs-shell code-summary](../docs-shell/code-generation/code-summary.md) · [official-docs plan](../official-docs/code-generation/code-generation-plan.md) · [docs-shell plan](../docs-shell/code-generation/code-generation-plan.md)

## Boundaries under test

| Seam | How |
|------|-----|
| official-docs → api-core | `packages/api-core/tests/official-docs-routes.test.ts` — `missing_ja`→200, `not_found`→404, wire pass-through |
| api-core → docs-shell | Dashboard fetch stubs + DocsShell integration tests (wire fields only) |

## Commands

```bash
bunx vitest run --project node packages/api-core/tests/official-docs-routes.test.ts
bunx vitest run packages/dashboard/tests/docs-shell.test.tsx
```

## Manual (FR-B2-5.2)

See [extension-manual-scenarios.md](../docs-shell/code-generation/extension-manual-scenarios.md) — Extension Docs Shell keep-path / notice / missing-anchor. Human-executed; not gated in CI for this bolt.

## Review

**Verdict:** READY
