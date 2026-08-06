# Integration Test Instructions — Docs i18n Bolt 4

> build-and-test / 2026-08-05 · Test Strategy: **Standard**  
> 上流: [code-summary](../docs-navigation/code-generation/code-summary.md) · [code-generation-plan](../docs-navigation/code-generation/code-generation-plan.md)

## Boundaries

| Boundary | Test |
|----------|------|
| dashboard ✗ `@aidlc-guide/official-docs` | `dependency-direction.test.ts` |
| Webview → host `open-official-doc` | dashboard + extension open-official-doc tests |
| Host → Docs Shell inject | Bolt 3 reuse (extension tests; no Bolt 4 host change) |

## How to run

```bash
bunx vitest run packages/dashboard/tests/dependency-direction.test.ts
bunx vitest run packages/dashboard/tests/open-official-doc.test.tsx
bunx vitest run packages/vscode-extension/tests/open-official-doc.test.ts
```

## Manual integration (Demo)

See [demo-record.md](../docs-navigation/code-generation/demo-record.md) — Extension: StageCard / Bridge → Open in Docs → Shell.

## Review

**Status:** Automated boundaries executed; Demo pending human
