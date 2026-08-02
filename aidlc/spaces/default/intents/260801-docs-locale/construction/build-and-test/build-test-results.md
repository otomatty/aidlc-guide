# Build & Test Results — Docs i18n Bolt 2

> build-and-test execution / 2026-08-02  
> 上流: [official-docs code-summary](../official-docs/code-generation/code-summary.md) · [docs-shell code-summary](../docs-shell/code-generation/code-summary.md) · [official-docs plan](../official-docs/code-generation/code-generation-plan.md) · [docs-shell plan](../docs-shell/code-generation/code-generation-plan.md)

## Build / typecheck

| Step | Result |
|------|--------|
| `bunx biome check` (touched Bolt 2 paths) | PASS |
| `bunx tsc --noEmit` (root) | PASS |
| `bunx tsc --noEmit -p packages/dashboard` | PASS |

## Unit / integration

| Suite | Result |
|-------|--------|
| `vitest --coverage --project node` | **783 passed**, 1 skipped — PASS (incl. NFR-B2-1 thresholds) |
| `docs-shell.test.tsx` | **12 passed** — PASS |
| `official-docs-routes.test.ts` (via node project) | PASS (`missing_ja`→200, `not_found`→404) |

## NFR-B2-1 coverage (from `coverage/coverage-summary.json`)

| File | Branches | Stmts | Funcs | Lines |
|------|---------:|------:|------:|------:|
| `resolve.ts` | 97.05 | 100 | 100 | 100 |
| `roots.ts` | 100 | 100 | 100 | 100 |
| `markdown.ts` | 100 | 100 | 100 | 100 |

## Full `bun run check`

| Area | Result |
|------|--------|
| Biome / tsc / node coverage floors | PASS when run in isolation |
| `packages/dashboard/tests/timings.test.tsx` | **FAIL** — 6 fake-timer polls timeout ~20s (reproduced alone; pre-existing, not Bolt 2) |

## Assessment

Bolt 2 library + Docs Shell automated DoD is **met**. Full-repo `bun run check` remains blocked by unrelated timings flake on this host — track separately; do not regress Bolt 2 to “fix” timings.

## Review

**Verdict:** READY for Bolt 2 scope; full-check flake documented.
