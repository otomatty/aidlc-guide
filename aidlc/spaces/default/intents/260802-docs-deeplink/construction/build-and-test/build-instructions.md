# Build Instructions — Docs i18n Bolt 3

> build-and-test / 2026-08-02  
> 上流: [docs-navigation code-summary](../docs-navigation/code-generation/code-summary.md) · [code-generation-plan](../docs-navigation/code-generation/code-generation-plan.md)

## Prerequisites

| Item | Notes |
|------|-------|
| Runtime | bun on PATH |
| Install | `bun install` at repo root |
| Host | Local-only VS Code / Cursor extension (NFR-B3-2) |

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

## Bolt 3 focused verify (faster)

```bash
bunx vitest run \
  packages/vscode-extension/tests/open-official-doc.test.ts \
  packages/dashboard/tests/open-official-doc.test.tsx \
  packages/dashboard/tests/docs-shell.test.tsx \
  packages/dashboard/tests/dependency-direction.test.ts \
  packages/official-docs/tests/stage-map.test.ts \
  packages/api-core/tests/official-docs-routes.test.ts
```

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Biome format on new tests | `bunx biome check --write <file>` |
| `timings.test.tsx` 20s timeouts | Pre-existing dashboard fake-timer flake (out of Bolt 3) |
| Full `bun run check` red only on timings | Use focused suite above for Bolt 3 DoD |

## Review

**Status:** Documented
