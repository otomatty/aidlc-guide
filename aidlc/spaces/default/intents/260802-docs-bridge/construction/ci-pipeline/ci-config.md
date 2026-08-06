# CI Config — Docs i18n Bolt 4

> ci-pipeline / 2026-08-05  
> 上流: [build-and-test-summary.md](../build-and-test/build-and-test-summary.md) · [build-test-results.md](../build-and-test/build-test-results.md) · [docs-navigation code-summary](../docs-navigation/code-generation/code-summary.md)  
> Q1–Q4 = A

## Tooling

| Item | Choice |
|------|--------|
| CI | GitHub Actions |
| Workflow | [`.github/workflows/check.yml`](../../../../../../.github/workflows/check.yml) |
| Local truth | `bun run check` (team.md — local gate is the gate) |
| Matrix | ubuntu-latest, windows-latest, macos-latest |

## Pipeline shape (existing — no Bolt 4 YAML change)

```text
checkout → setup-bun → bun install --frozen-lockfile → bun run check
```

`bun run check` = Biome + tsc (root/dashboard/extension) + `vitest run --coverage` + audit-shard script + `bun audit`.

## Bolt 4 delta in CI

No new workflow file. Bridge degrade coverage lands via existing vitest discovery:

- `packages/dashboard/tests/open-official-doc.test.tsx` — CTA `Open in Docs` + emit
- `packages/dashboard/tests/components.test.tsx` — excerpt non-mount
- `packages/dashboard/tests/dependency-direction.test.ts`
- `packages/vscode-extension/tests/open-official-doc.test.ts` — host reuse

No new 95% branch floor (NFR-B4-2).

## Deploy / artifacts

N/A cloud. Extension packaging remains local (worktree + PR → `main`).

## Review

**Verdict:** READY
