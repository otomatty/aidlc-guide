# Unit Test Instructions — Docs i18n Bolt 4

> build-and-test / 2026-08-05 · Test Strategy: **Standard**  
> 上流: [code-summary](../docs-navigation/code-generation/code-summary.md) · [code-generation-plan](../docs-navigation/code-generation/code-generation-plan.md)

## Framework

- vitest (workspace packages)
- Testing Library for React (dashboard)

## How to run

```bash
bunx vitest run packages/dashboard/tests/open-official-doc.test.tsx
bunx vitest run packages/dashboard/tests/components.test.tsx
bunx vitest run packages/vscode-extension/tests/open-official-doc.test.ts
```

## Coverage expectations (Bolt 4)

| Area | Expectation |
|------|-------------|
| Excerpt non-mount (FR-B4-1) | `components.test.tsx` — fixture excerpt → `docs-excerpt` absent |
| CTA `Open in Docs` (FR-B4-2.4) | `open-official-doc.test.tsx` a11y |
| Emit `open-official-doc` / no open-doc | `open-official-doc.test.tsx` StageCard path |
| Host validate reuse | `vscode-extension/.../open-official-doc.test.ts` |
| No new 95% branch floor | NFR-B4-2 |

## Review

**Status:** Executed — see build-test-results.md
