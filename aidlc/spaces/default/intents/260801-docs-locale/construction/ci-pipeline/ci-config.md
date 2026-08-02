# CI Config — Docs i18n Bolt 2

> ci-pipeline / 2026-08-02  
> 上流: [build-and-test-summary.md](../build-and-test/build-and-test-summary.md) · [build-test-results.md](../build-and-test/build-test-results.md) · [official-docs code-summary](../official-docs/code-generation/code-summary.md) · [docs-shell code-summary](../docs-shell/code-generation/code-summary.md)

## Tooling

| Item | Choice |
|------|--------|
| CI | GitHub Actions |
| Workflow | [`.github/workflows/check.yml`](../../../../../../.github/workflows/check.yml) |
| Local truth | `bun run check` (team.md — local gate is the gate) |
| Matrix | ubuntu-latest, windows-latest, macos-latest |

## Pipeline shape (existing — no Bolt 2 YAML change)

```text
checkout → setup-bun → bun install --frozen-lockfile → bun run check
```

`bun run check` = Biome + tsc (root/dashboard/extension) + `vitest run --coverage` + audit-shard script + `bun audit`.

## Bolt 2 delta in CI

No new workflow file. NFR-B2-1 floors live in `vitest.config.ts` thresholds for:

- `packages/official-docs/src/resolve.ts`
- `packages/official-docs/src/roots.ts`
- `packages/official-docs/src/markdown.ts`

They fail `bun run check` (and therefore Actions) when below 95%.

## Active intent env

Workflow sets `AIDLC_ACTIVE_INTENT: 260730-docs-i18n` for live-workspace smoke. Bolt 2 record is `260801-docs-locale` — **optional follow-up** to dual-pin or update when CI smoke needs the new intent; not required for library/UI unit tests.

## Deploy / artifacts

N/A cloud. Extension packaging remains local (`bun run build:extension` family).

## Review

**Verdict:** READY — reuse existing Actions; floors documented.
