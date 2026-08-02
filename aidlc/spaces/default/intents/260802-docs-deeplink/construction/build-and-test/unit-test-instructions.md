# Unit Test Instructions — Docs i18n Bolt 3

> build-and-test / 2026-08-02 · Test Strategy: **Standard**  
> 上流: [code-summary](../docs-navigation/code-generation/code-summary.md) · [code-generation-plan](../docs-navigation/code-generation/code-generation-plan.md)

## Framework

- vitest (workspace packages)
- Testing Library for React (dashboard)

## How to run

```bash
bunx vitest run packages/vscode-extension/tests/open-official-doc.test.ts
bunx vitest run packages/dashboard/tests/open-official-doc.test.tsx
bunx vitest run packages/dashboard/tests/docs-shell.test.tsx
bunx vitest run packages/official-docs/tests/stage-map.test.ts
```

## Coverage expectations (Bolt 3)

| Area | Expectation |
|------|-------------|
| Host validate / persist / inject / ignore | open-official-doc.test.ts |
| Payload builder / a11y name / no open-doc | open-official-doc.test.tsx |
| DocsShell locale deep-link | docs-shell.test.tsx (FR-B3-4.3) |
| STAGE_DOC_MAP lock (7 slugs) | stage-map.test.ts — **do not edit map** |
| No new 95% branch floor | NFR-B3-3 |

## Review

**Status:** Executed — see build-test-results.md
