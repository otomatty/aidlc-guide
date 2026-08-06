# Quality Gates — Docs i18n Bolt 4

> ci-pipeline / 2026-08-05  
> 上流: [build-and-test-summary.md](../build-and-test/build-and-test-summary.md) · [build-test-results.md](../build-and-test/build-test-results.md) · [docs-navigation code-summary](../docs-navigation/code-generation/code-summary.md)

## Merge gates (PR → main)

| Gate | Mechanism | Bolt 4 relevance |
|------|-----------|------------------|
| Format / lint | Biome in `bun run check` | StageCard / OpenOfficialDocLink |
| Types | `tsc --noEmit` (+ dashboard / extension) | UI CTA + non-mount |
| Unit / integration | Vitest | non-mount + CTA emit + host reuse + boundary |
| Coverage floors | Existing thresholds only | **No new** Bolt 4 95% floor (NFR-B4-2) |
| Supply chain | `bun audit` | deps |
| OS matrix | GHA ubuntu / windows / macos | path quirks |

## Bolt 4 behavioral gates (inside vitest)

| Gate | Location |
|------|----------|
| Excerpt non-mount | `packages/dashboard/tests/components.test.tsx` |
| CTA `Open in Docs` + emit | `packages/dashboard/tests/open-official-doc.test.tsx` |
| Host validate reuse | `packages/vscode-extension/tests/open-official-doc.test.ts` |
| No dashboard→official-docs | `packages/dashboard/tests/dependency-direction.test.ts` |

## Known non-gate (document only)

| Item | Notes |
|------|-------|
| `timings.test.tsx` flake | Can fail full check locally; pre-existing; track outside Bolt 4 |
| FR-B4-3.1 Extension manual demo | [demo-record.md](../docs-navigation/code-generation/demo-record.md) — human |

## Review

**Verdict:** READY
