# Smoke Test Results — Docs i18n Bolt 4

> deployment-execution / 2026-08-06  
> 上流: [deployment-log.md](./deployment-log.md) · [build-test-results.md](../../construction/build-and-test/build-test-results.md) · [cd-config.md](../deployment-pipeline/cd-config.md) · [deployment-strategy.md](../deployment-pipeline/deployment-strategy.md)  
> Q2 = A

## Automated smoke (executed)

| Suite | Result |
|-------|--------|
| Bolt 4 focused (4 files) | **51 passed** |

Files: `open-official-doc.test.tsx` · `components.test.tsx` · `dependency-direction.test.ts` · `open-official-doc.test.ts` (extension)

## AC mapping

| AC | Covered by |
|----|------------|
| Excerpt non-mount (FR-B4-1) | components.test.tsx |
| CTA `Open in Docs` + emit (FR-B4-2) | open-official-doc.test.tsx |
| Host reuse | extension open-official-doc.test.ts |
| Boundary | dependency-direction.test.ts |

## Manual smoke (deferred)

[demo-record.md](../../construction/docs-navigation/code-generation/demo-record.md) — FR-B4-3.1 human (Q3 = A).

## Review

**Verdict:** READY — automated smoke green.
