# Code Summary — Unit: official-docs (Construction Bolt 1 / walking skeleton)

> code-generation / official-docs / 2026-08-02

## What shipped

Brownfield finish of Bolt 2 library contracts for `packages/official-docs`: NFR-B2-1 coverage floors, keep-path + `missing_ja` assertions, anchor enum edges, locale-scoped TOC sparse-ja check, and api-core HTTP status mapping for the resolve seam.

## Files touched

| Path | Change |
|------|--------|
| `vitest.config.ts` | Thresholds for `resolve.ts` / `roots.ts` / `markdown.ts` (≥95); `allowExternal` + `skipFull: false` + `all: true` so floors cannot silently skip |
| `packages/official-docs/src/markdown.ts` | Drop dead `?? "\`"` on fence char (use `charAt(0)`) — unreachable branch was blocking floor |
| `packages/official-docs/tests/resolve.test.ts` | Keep-path / whitespace-anchor / en-fallback `path_rejected` (guardPath mock) / manifest empty `sourceVersion` comments |
| `packages/official-docs/tests/markdown.test.ts` | Empty h1, tilde fences, fenced-heading ignore, mismatched fence close |
| `packages/official-docs/tests/roots.test.ts` | Null/whitespace reject, backslash normalize, `isDocSection`, root helpers |
| `packages/official-docs/tests/toc.test.ts` | Sparse-ja inventory equals en paths (locale-scoped tree) |
| `packages/api-core/tests/official-docs-routes.test.ts` | `missing_ja` → HTTP 200; `not_found` → 404 |

Application code remains under `packages/` only. Plan/summary artifacts under this intent record.

## Decisions

1. **Manifest missing → ok + empty `sourceVersion` (Bolt 1 preserved).**  
   Design Errors table mentions `empty_content`, but brownfield page resolve already treats a missing manifest as soft-degrade (empty version string) with an existing test. No switch to `empty_content` for page resolve in this bolt (plan Step 5).

2. **Windows coverage `allowExternal: true`.**  
   On this host, Vite `config.root` may use `C:/…` while V8 `fileURLToPath` yields `c:/…`. Vitest `isIncluded` then treats every workspace file as outside the root and reports 0% coverage. `allowExternal` restores collection so the new floors are enforceable. Documented in `vitest.config.ts`.

3. **api-core stays a pass-through seam.**  
   `officialDocsPage` still returns `resolvePage`’s `ReadResult<ResolvedPage>` unchanged; status mapping uses existing `statusForResult` (`not_found` → 404, ok/`missing_ja` → 200). No wire renames.

## Coverage (NFR-B2-1 floors)

Measured via `vitest run --coverage --project node` → `coverage/coverage-summary.json` (thresholds enforced; no ERROR for these globs):

| File | Stmts | Branches | Funcs | Lines |
|------|------:|---------:|------:|------:|
| `packages/official-docs/src/resolve.ts` | 100 | 97.05 | 100 | 100 |
| `packages/official-docs/src/roots.ts` | 100 | 100 | 100 | 100 |
| `packages/official-docs/src/markdown.ts` | 100 | 100 | 100 | 100 |

Config: `coverage.allowExternal: true` (Windows drive-letter), `skipFull: false`, `all: true` so threshold globs cannot silently skip unattributed modules.

## Security / boundary

- `packages/official-docs/package.json` deps: workspace `@aidlc-guide/core-utils` + `@aidlc-guide/shared-types` only — **no network clients**.
- Path-escape → `path_rejected` remains in `resolve.test.ts`.

## Verification

- Biome + `tsc --noEmit` (root): clean for touched files.
- Node vitest project + coverage floors: green (783 passed | 1 skipped); NFR-B2-1 thresholds OK per `coverage-summary.json`.
- Full `bun run check`: Biome/tsc/node coverage OK; **dashboard** `timings.test.tsx` (6 fake-timer polls) fails on this host — pre-existing / environmental, unrelated to official-docs. Unit DoD for Bolt 1 library is the node coverage floors + contract tests.

## Deviations

- None vs approved plan behavior for official-docs.
- Full-suite dashboard timings flake noted above; out of unit scope.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02 (re-review after NFR-B2-1 attribution fix)

**Prior blocker cleared.** `roots.ts` and `markdown.ts` now appear in `coverage/coverage-summary.json` with full attribution after `vitest.config.ts` changes (`allowExternal: true`, `skipFull: false`, `all: true`). Independent `bunx vitest run --coverage --project node --coverage.reporter=json-summary` exit 0; thresholds enforced:

| File | Stmts | Branches | Funcs | Lines |
|------|------:|---------:|------:|------:|
| `resolve.ts` | 100 | 97.05 | 100 | 100 |
| `roots.ts` | 100 | 100 | 100 | 100 |
| `markdown.ts` | 100 | 100 | 100 | 100 |

**Contract tests verified (unchanged):**

- **Keep-path:** `resolve.test.ts` — `missing_ja` fallback preserves requested `path` (`reference/scopes.md`).
- **missing_ja:** ok result with `localeRequested: ja`, `localeServed: en`, `notice: "missing_ja"`.
- **HTTP 200 / 404:** `official-docs-routes.test.ts` — `missing_ja` → 200 via `statusForResult` ok branch; `not_found` → 404.

No new architectural findings. Developer can proceed without further guidance for Bolt 1 library scope.

