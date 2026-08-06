# Build Instructions — Docs i18n Bolt 4

> build-and-test / 2026-08-05  
> 上流: [docs-navigation code-summary](../docs-navigation/code-generation/code-summary.md) · [code-generation-plan](../docs-navigation/code-generation/code-generation-plan.md)

## Prerequisites

| Item | Notes |
|------|-------|
| Runtime | bun on PATH |
| Install | `bun install` at repo root |
| Host | Local-only VS Code / Cursor extension (NFR-B4-3) |

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

## Bolt 4 focused verify (faster)

```bash
bunx vitest run \
  packages/dashboard/tests/open-official-doc.test.tsx \
  packages/dashboard/tests/components.test.tsx \
  packages/dashboard/tests/dependency-direction.test.ts \
  packages/vscode-extension/tests/open-official-doc.test.ts
```

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Full `bun run check` fails in `timings.test.tsx` | Pre-existing fake-timer flake (out of Bolt 4 scope) |
| Excerpt accordion still visible | StageCard still mounts `docs-excerpt` — see FR-B4-1 |
| CTA still says `Docs: …` | OpenOfficialDocLink not on Bolt 4 label |

## Review

**Status:** Documented
