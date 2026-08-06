# Build / Test Results — Docs i18n

**Executed:** 2026-08-01T04:52Z (approx)  
**Host:** local workspace `aidlc-guide`

## Build

| Step | Command | Status | Notes |
|------|---------|--------|-------|
| Typecheck root | `bunx tsc --noEmit` | SUCCESS | exit 0 |
| Typecheck dashboard | `bunx tsc --noEmit -p packages/dashboard` | SUCCESS | exit 0 |
| Content snapshot | filesystem + manifest parse | SUCCESS | `fixture-2026-07-31` |
| Diff report | `bun scripts/official-docs-diff.ts --upstream <path>` | SUCCESS | Markdown translate-PR report (Bolt 5) |

## Unit + integration tests

```text
bunx vitest run \
  packages/official-docs \
  packages/api-core/tests/official-docs-routes.test.ts \
  packages/dashboard/tests/docs-shell.test.tsx \
  packages/dashboard/tests/dependency-direction.test.ts

 Test Files  11 passed (11)
      Tests  48 passed (48)
   Duration  ~12s
```

### Breakdown

| File | Result |
|------|--------|
| official-docs/* (9 files) | all passed |
| api-core/official-docs-routes.test.ts | 4 passed |
| dashboard/docs-shell.test.tsx | 4 passed |
| dashboard/dependency-direction.test.ts | 6 passed |

## Failures

None.

## Coverage

Not collected in this focused run (`vitest run` without `--coverage`). Coverage available via root `bun run check` when needed.

## Attempts / fixes

No repair loop required — first focused run green.
