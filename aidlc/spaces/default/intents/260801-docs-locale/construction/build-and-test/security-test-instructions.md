# Security Test Instructions — Docs i18n Bolt 2

> build-and-test / 2026-08-02  
> 上流: [official-docs code-summary](../official-docs/code-generation/code-summary.md) · [docs-shell code-summary](../docs-shell/code-generation/code-summary.md) · [official-docs plan](../official-docs/code-generation/code-generation-plan.md) · [docs-shell plan](../docs-shell/code-generation/code-generation-plan.md)

## Automated controls

| Control | Command / location |
|---------|-------------------|
| Path escape → `path_rejected` | `packages/official-docs/tests/resolve.test.ts` |
| UI must not import official-docs / reader-core | `docs-shell.test.tsx` boundary + `dependency-direction.test.ts` |
| notice only from wire `missing_ja` | docs-shell + resolve tests |
| No network deps in official-docs | package.json review |
| `bun audit` | part of `bun run check` |

## Commands

```bash
bunx vitest run --project node packages/official-docs/tests/resolve.test.ts
bunx vitest run packages/dashboard/tests/docs-shell.test.tsx
bun audit
```

## Review

**Verdict:** READY
