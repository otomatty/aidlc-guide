# Unit Test Instructions — Docs i18n

**Test strategy:** Standard  
**Framework:** Vitest (`bunx vitest` / `bun run test`)

## Scope (Bolt 1)

| Package / area | Specs | Focus |
|----------------|-------|--------|
| `packages/official-docs` | `tests/*.test.ts` | resolvePage, manifest, TOC, stage-map, path reject, content-snapshot |
| `packages/api-core` | `tests/official-docs-routes.test.ts` | FR-U2.6 routes + `/api/guides` non-collision |
| `packages/dashboard` | `tests/docs-shell.test.tsx` | Shell happy path, locale, missing_ja |
| `packages/dashboard` | `tests/dependency-direction.test.ts` | No official-docs import in dashboard |

## Commands

Bolt 1 focused suite:

```bash
bunx vitest run \
  packages/official-docs \
  packages/api-core/tests/official-docs-routes.test.ts \
  packages/dashboard/tests/docs-shell.test.tsx \
  packages/dashboard/tests/dependency-direction.test.ts
```

Full workspace:

```bash
bun run test
```

## Coverage expectations

- Happy path + ≥2 edge/error cases per library surface (resolve / routes)
- NFR-2 negatives: `path_rejected`, invalid locale
- US-01 packaging asserts in `content-snapshot.test.ts`
- Shell: manifest `sourceVersion` visible; locale control present

## Data / env

- Tests use workspace `docs/` fixture trees (no network)
- Dashboard Shell tests mock `getResult` for `/api/official-docs/*`
