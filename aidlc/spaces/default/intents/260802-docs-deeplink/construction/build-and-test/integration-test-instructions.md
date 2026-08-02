# Integration Test Instructions — Docs i18n Bolt 3

> build-and-test / 2026-08-02 · Test Strategy: **Standard**  
> 上流: [code-summary](../docs-navigation/code-generation/code-summary.md) · [code-generation-plan](../docs-navigation/code-generation/code-generation-plan.md)

## Boundaries under test

| Boundary | How |
|----------|-----|
| api-core stage map route | `packages/api-core/tests/official-docs-routes.test.ts` — mapped vs null |
| Dashboard ✗ official-docs | `packages/dashboard/tests/dependency-direction.test.ts` |
| Host → webview inject shape | Host unit tests assert `docs-shell-deeplink` payload |

## How to run

```bash
bunx vitest run packages/api-core/tests/official-docs-routes.test.ts
bunx vitest run packages/dashboard/tests/dependency-direction.test.ts
```

## Manual integration (Must demo)

See [demo-record.md](../docs-navigation/code-generation/demo-record.md): intent-capture StageCard → Docs Shell in extension host.

## Review

**Status:** Automated boundaries executed; manual demo human
