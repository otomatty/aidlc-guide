# Build Instructions — Docs i18n Bolt 2

> build-and-test / 2026-08-02  
> 上流: [official-docs code-summary](../official-docs/code-generation/code-summary.md) · [docs-shell code-summary](../docs-shell/code-generation/code-summary.md) · [official-docs plan](../official-docs/code-generation/code-generation-plan.md) · [docs-shell plan](../docs-shell/code-generation/code-generation-plan.md)

## Prerequisites

| Item | Notes |
|------|-------|
| Runtime | bun on PATH |
| Install | `bun install` at repo root |
| Host | Local-only (no AWS / CDN) |

## Commands

```bash
bun install
bunx biome check .
bunx tsc --noEmit
bunx tsc --noEmit -p packages/dashboard
bunx tsc --noEmit -p packages/vscode-extension
# Full gate (includes vitest --coverage + audit):
bun run check
```

## Bolt 2 focused verify (faster)

```bash
bunx vitest run --coverage --project node
bunx vitest run packages/dashboard/tests/docs-shell.test.tsx
```

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Coverage 0% on Windows | Need `coverage.allowExternal: true` in `vitest.config.ts` |
| `timings.test.tsx` 20s timeouts | Known dashboard fake-timer flake; unrelated to Bolt 2 docs |
| Threshold ERROR on reader-core when filtering packages | Run full `--project node`, not a partial path filter |

## Review

**Verdict:** READY — instructions match monorepo check script.
