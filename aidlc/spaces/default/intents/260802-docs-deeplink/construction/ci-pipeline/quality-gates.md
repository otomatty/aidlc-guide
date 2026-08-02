# Quality Gates — Docs i18n Bolt 3

> ci-pipeline / 2026-08-02  
> 上流: [build-and-test-summary.md](../build-and-test/build-and-test-summary.md) · [build-test-results.md](../build-and-test/build-test-results.md) · [docs-navigation code-summary](../docs-navigation/code-generation/code-summary.md)

## Merge gates (PR → main)

| Gate | Mechanism | Bolt 3 relevance |
|------|-----------|------------------|
| Format / lint | Biome in `bun run check` | Touched TS/TSX |
| Types | `tsc --noEmit` (+ dashboard / extension) | open-official-doc + StageCard / Shell |
| Unit / integration | Vitest | host + dashboard deep-link + map/route |
| Coverage floors | Existing Bolt 2 thresholds only | **No new** Bolt 3 95% floor (NFR-B3-3) |
| Supply chain | `bun audit` | deps |
| OS matrix | GHA ubuntu / windows / macos | path quirks |

## Bolt 3 behavioral gates (inside vitest)

| Gate | Location |
|------|----------|
| Mapped / unmapped / ignore host | `packages/vscode-extension/tests/open-official-doc.test.ts` |
| Payload / a11y / no open-doc | `packages/dashboard/tests/open-official-doc.test.tsx` |
| Deep-link locale apply | `packages/dashboard/tests/docs-shell.test.tsx` |
| Map lock 7 slugs | `packages/official-docs/tests/stage-map.test.ts` |
| Stage API mapped/null | `packages/api-core/tests/official-docs-routes.test.ts` |
| No dashboard→official-docs | `packages/dashboard/tests/dependency-direction.test.ts` |

## Known non-gate (document only)

| Item | Notes |
|------|-------|
| `timings.test.tsx` flake | Can fail full check locally; pre-existing; track outside Bolt 3 |
| FR-B3-6.2 Extension manual demo | [demo-record.md](../docs-navigation/code-generation/demo-record.md) — human |

## Review

**Verdict:** READY
