# Integration Test Instructions — Docs i18n

**Test strategy:** Standard  
**Boundary under test:** FS snapshot → `official-docs` → `api-core` `/api/official-docs/*` → dashboard Docs Shell (mocked transport)

## Key boundaries

1. **api-core ↔ official-docs** — `official-docs-routes.test.ts` mounts real Hono app against workspace docs root
2. **api-core ↔ existing guides API** — same suite asserts `/api/guides` still distinct
3. **dashboard ↔ API contract** — `docs-shell.test.tsx` exercises client paths and payload shapes without importing `@aidlc-guide/official-docs`
4. **dashboard dependency wall** — `dependency-direction.test.ts` locks wire-only rule

## Commands

```bash
bunx vitest run \
  packages/api-core/tests/official-docs-routes.test.ts \
  packages/dashboard/tests/docs-shell.test.tsx \
  packages/dashboard/tests/dependency-direction.test.ts
```

Manual extension demo (post-build, human):

```bash
bun run build:extension
# Open extension → Official Docs → confirm en page + sourceVersion
```

## Deferred (later bolts)

- StageCard → openOfficialDoc deep link (B3 / docs-navigation)
- BridgeRedirectPanel (B4)
- Real upstream tree diff (B5)
