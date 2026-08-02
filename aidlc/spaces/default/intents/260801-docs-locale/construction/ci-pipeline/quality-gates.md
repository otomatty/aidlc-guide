# Quality Gates — Docs i18n Bolt 2

> ci-pipeline / 2026-08-02  
> 上流: [build-and-test-summary.md](../build-and-test/build-and-test-summary.md) · [build-test-results.md](../build-and-test/build-test-results.md) · [official-docs code-summary](../official-docs/code-generation/code-summary.md) · [docs-shell code-summary](../docs-shell/code-generation/code-summary.md)

## Merge gates (PR → main)

| Gate | Mechanism | Bolt 2 relevance |
|------|-----------|------------------|
| Format / lint | Biome in `bun run check` | Touched TS/TSX |
| Types | `tsc --noEmit` (+ dashboard / extension) | Docs Shell + official-docs |
| Unit / integration | Vitest node + dashboard projects | resolve/routes + docs-shell |
| Coverage floors | vitest thresholds (NFR-B2-1) | resolve / roots / markdown ≥95% |
| Supply chain | `bun audit` | deps |
| OS matrix | GHA ubuntu / windows / macos | path / coverage Windows quirks |

## Bolt 2 behavioral gates (inside vitest)

| Gate | Location |
|------|----------|
| keep-path / missing_ja / anchorApplied | `packages/official-docs/tests/*` |
| missing_ja → HTTP 200; not_found → 404 | `packages/api-core/tests/official-docs-routes.test.ts` |
| UI notice / AnchorApplier / 404≠notice / boundary | `packages/dashboard/tests/docs-shell.test.tsx` |

## Known non-gate (document only)

| Item | Notes |
|------|-------|
| `timings.test.tsx` flake | Can fail full check locally; pre-existing; track outside Bolt 2 |
| FR-B2-5.2 Extension manual | Human checklist — not CI |

## Review

**Verdict:** READY
