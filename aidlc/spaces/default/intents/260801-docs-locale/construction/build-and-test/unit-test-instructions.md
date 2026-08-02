# Unit Test Instructions — Docs i18n Bolt 2

> build-and-test / Standard strategy / 2026-08-02  
> 上流: [official-docs code-summary](../official-docs/code-generation/code-summary.md) · [docs-shell code-summary](../docs-shell/code-generation/code-summary.md) · [official-docs plan](../official-docs/code-generation/code-generation-plan.md) · [docs-shell plan](../docs-shell/code-generation/code-generation-plan.md)

## Framework

Vitest 4 (node project + dashboard jsdom project). Coverage via `@vitest/coverage-v8`.

## Commands

```bash
# Library + api-core (node)
bunx vitest run --project node packages/official-docs/tests
bunx vitest run --project node packages/api-core/tests/official-docs-routes.test.ts

# UI
bunx vitest run packages/dashboard/tests/docs-shell.test.tsx

# NFR-B2-1 floors (must be full node project so thresholds resolve)
bunx vitest run --coverage --project node
```

## Coverage targets (Must)

| File | Floor |
|------|------:|
| `packages/official-docs/src/resolve.ts` | ≥95% branches/stmts/funcs/lines |
| `packages/official-docs/src/roots.ts` | ≥95% |
| `packages/official-docs/src/markdown.ts` | ≥95% |

## Key cases

**official-docs:** keep-path, `missing_ja`, anchor scrolled/top/none, path_rejected, not_found, listToc sparse-ja  
**docs-shell:** keep-path locale switch, notice+`role=status`, 404≠notice, AnchorApplier, LocaleControl stays ja, boundary import scan

## Review

**Verdict:** READY
