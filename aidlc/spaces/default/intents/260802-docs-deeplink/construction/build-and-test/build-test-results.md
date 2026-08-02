# Build / Test Results — Docs i18n Bolt 3

> build-and-test / 2026-08-02  
> 上流: [code-summary](../docs-navigation/code-generation/code-summary.md) · [code-generation-plan](../docs-navigation/code-generation/code-generation-plan.md)

## Build

| Step | Result |
|------|--------|
| `biome check --write` (2 format fixes on new tests) | Pass |
| `tsc --noEmit` (root) | Pass |
| `tsc --noEmit -p packages/dashboard` | Pass |
| `tsc --noEmit -p packages/vscode-extension` | Pass |

## Full `bun run check`

| Result | Detail |
|--------|--------|
| **Fail** | Pre-existing `packages/dashboard/tests/timings.test.tsx` — 6 tests timed out at 20s (fake timers). Unrelated to Bolt 3 deep-link. Same flake called out in Bolt 2 build-and-test. |

## Bolt 3 focused suite (DoD)

```text
Test Files  6 passed (6)
Tests       45 passed (45)
```

Files:

- `packages/vscode-extension/tests/open-official-doc.test.ts`
- `packages/dashboard/tests/open-official-doc.test.tsx`
- `packages/dashboard/tests/docs-shell.test.tsx`
- `packages/dashboard/tests/dependency-direction.test.ts`
- `packages/official-docs/tests/stage-map.test.ts`
- `packages/api-core/tests/official-docs-routes.test.ts`

## Manual

| Item | Status |
|------|--------|
| [demo-record.md](../docs-navigation/code-generation/demo-record.md) intent-capture → Shell | Pending human |

## Review

**Verdict:** Bolt 3 automated acceptance met; full-check blocked by timings flake.
