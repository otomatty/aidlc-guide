# CI Config — Docs i18n Bolt 3

> ci-pipeline / 2026-08-02  
> 上流: [build-and-test-summary.md](../build-and-test/build-and-test-summary.md) · [build-test-results.md](../build-and-test/build-test-results.md) · [docs-navigation code-summary](../docs-navigation/code-generation/code-summary.md)  
> Q1–Q4 = A

## Tooling

| Item | Choice |
|------|--------|
| CI | GitHub Actions |
| Workflow | [`.github/workflows/check.yml`](../../../../../../.github/workflows/check.yml) |
| Local truth | `bun run check` (team.md — local gate is the gate) |
| Matrix | ubuntu-latest, windows-latest, macos-latest |

## Pipeline shape (existing — no Bolt 3 YAML change)

```text
checkout → setup-bun → bun install --frozen-lockfile → bun run check
```

`bun run check` = Biome + tsc (root/dashboard/extension) + `vitest run --coverage` + audit-shard script + `bun audit`.

## Bolt 3 delta in CI

No new workflow file. Deep-link coverage lands via existing vitest discovery:

- `packages/vscode-extension/tests/open-official-doc.test.ts`
- `packages/dashboard/tests/open-official-doc.test.tsx`
- DocsShell locale deep-link cases in `docs-shell.test.tsx`
- stage-map lock + api-core stage route tests

No new 95% branch floor (NFR-B3-3).

## Active intent env

Workflow may set `AIDLC_ACTIVE_INTENT` for live-workspace smoke. Bolt 3 record is `260802-docs-deeplink` — **optional** follow-up to pin when smoke needs this intent; not required for unit tests above.

## Deploy / artifacts

N/A cloud. Extension packaging remains local.

## Review

**Verdict:** READY
