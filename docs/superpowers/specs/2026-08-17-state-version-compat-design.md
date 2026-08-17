# State Version 7/8 browse compatibility

- **Date**: 2026-08-17
- **Status**: approved (scope: 7 and 8)
- **Surfaces**: AIDLC Guide reader only (read-only). Engine advance/migration is out of scope.

## Decision

Parse registered State Versions 7 and 8. Keep on-disk slugs. Alias docs lookup only (`application-design` → `domain-design`). Do not invent a `contract-design` row on v7. Unregistered versions stay `{unsupported}`.

## Contract

- `CURRENT_STATE_VERSION = 8`
- `SUPPORTED_STATE_VERSIONS = [7, 8]`
- `WorkflowModel.stateVersion` is the number on disk
- `schemaCompatibility`: `current` (8) | `legacy` (7)
- v7 adds `LEGACY_STATE_WARNING` (browse-only; no migration)
- Version knowledge stays in `parse/` except the docs slug alias table

## Implementation order (blocked on packages/ writes)

1. `packages/shared-types/src/index.ts` — version registry + helpers
2. `packages/reader-core/src/parse/state.ts` — accept 7 and 8
3. `packages/docs-bridge/src/resolve.ts` — slug alias
4. Dashboard / MCP copy
5. Tests + v7 golden fixture
