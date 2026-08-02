# Smoke Test Results — Docs i18n Bolt 3

> deployment-execution / 2026-08-02  
> 上流: [deployment-log.md](./deployment-log.md) · [build-test-results.md](../../construction/build-and-test/build-test-results.md) · [cd-config.md](../deployment-pipeline/cd-config.md) · [deployment-strategy.md](../deployment-pipeline/deployment-strategy.md)  
> Q2 = A

## Automated smoke (executed)

| Suite | Result |
|-------|--------|
| Bolt 3 focused (6 files) | **45 passed** |

Files: `open-official-doc.test.ts` · `open-official-doc.test.tsx` · `docs-shell.test.tsx` · `dependency-direction.test.ts` · `stage-map.test.ts` · `official-docs-routes.test.ts`

## AC mapping

| AC | Covered by |
|----|------------|
| Mapped / unmapped / ignore | host open-official-doc tests |
| Payload / a11y / no open-doc | dashboard open-official-doc tests |
| Locale deep-link | docs-shell tests |
| Map lock / stage API | stage-map + routes |
| Boundary | dependency-direction |

## Manual smoke (deferred)

[demo-record.md](../../construction/docs-navigation/code-generation/demo-record.md) — FR-B3-6.2 human (Q3 = A).

## Review

**Verdict:** READY — automated smoke green.
