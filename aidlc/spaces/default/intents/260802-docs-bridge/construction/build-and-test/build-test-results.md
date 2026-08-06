# Build / Test Results — Docs i18n Bolt 4

> build-and-test / 2026-08-05  
> 上流: [code-summary](../docs-navigation/code-generation/code-summary.md) · [code-generation-plan](../docs-navigation/code-generation/code-generation-plan.md)

## Build

| Step | Result |
|------|--------|
| `biome check` (changed files) | Pass |
| `tsc --noEmit` (root) | Pass |
| `tsc --noEmit -p packages/dashboard` | Pass |
| `tsc --noEmit -p packages/vscode-extension` | Pass |

## Full `bun run check`

| Result | Detail |
|--------|--------|
| **Fail** | Pre-existing `packages/dashboard/tests/timings.test.tsx` — 6 tests timed out at 20s (fake timers). Unrelated to Bolt 4 Bridge degrade. Same flake as Bolt 2/3 build-and-test. |
| Otherwise | biome OK; 1158 tests passed / 6 failed / 1 skipped (91 files) |

## Bolt 4 focused suite (DoD)

```text
Test Files  4 passed (4)
Tests       51 passed (51)
```

Files:

- `packages/dashboard/tests/open-official-doc.test.tsx`
- `packages/dashboard/tests/components.test.tsx`
- `packages/dashboard/tests/dependency-direction.test.ts`
- `packages/vscode-extension/tests/open-official-doc.test.ts`

## Manual

| Item | Status |
|------|--------|
| [demo-record.md](../docs-navigation/code-generation/demo-record.md) Bridge → Open in Docs → Shell | Pending human |

## Review

**Verdict:** Bolt 4 automated acceptance met; full-check blocked by timings flake.
