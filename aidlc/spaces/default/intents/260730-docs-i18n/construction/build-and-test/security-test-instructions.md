# Security Test Instructions — Docs i18n

**Lead input:** aidlc-devsecops-agent (NFR-2 path safety)

## In-scope checks (automated today)

Covered by unit/integration suites — not a separate SAST job in Bolt 1:

| Threat | Assertion location |
|--------|-------------------|
| Path escape / outside-root | `resolve.test.ts` → `path_rejected` |
| Invalid locale | resolve + route tests |
| Dashboard FS / Node builtins | `dependency-direction.test.ts` |
| Raw HTML injection in UI | `dependency-direction.test.ts` (S-UI-3) |

## Commands

```bash
bunx vitest run packages/official-docs/tests/resolve.test.ts packages/api-core/tests/official-docs-routes.test.ts packages/dashboard/tests/dependency-direction.test.ts
```

## Deferred

- Broader SAST/DAST in ci-pipeline stage
- AuthN/Z N/A (local extension surface, GET-only docs)
