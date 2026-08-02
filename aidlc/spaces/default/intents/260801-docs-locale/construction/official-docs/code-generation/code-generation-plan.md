# Code Generation Plan — Unit: official-docs (Construction Bolt 1 / walking skeleton)

> code-generation / official-docs (library) / 2026-08-02  
> Brownfield: finish Bolt 2 contracts in `packages/official-docs` (+ check gates).  
> Stories: US-B2-01 / US-B2-02 (library AC) + US-B2-03 coverage floor  
> Test strategy: **Standard**

## Baseline (already present)

- `resolvePage`: keep-path path field, `missing_ja`, `anchorApplied` ∈ {scrolled,top,none}, path_rejected / not_found
- Tests in `packages/official-docs/tests/resolve.test.ts` (+ roots/markdown/toc)
- Wire types in package + `@aidlc-guide/shared-types`
- Root `bun run check` runs vitest with coverage — **but** 95% branch thresholds today only cover `reader-core` parse, **not** NFR-B2-1 files

## Plan steps

### Step 1: Coverage floor (NFR-B2-1 / US-B2-03) — BR-B2-OD-8

- [x] Add vitest `coverage.thresholds` for:
  - `packages/official-docs/src/resolve.ts`
  - `packages/official-docs/src/roots.ts`
  - `packages/official-docs/src/markdown.ts`
  - each: branches/statements/functions/lines ≥ **95**
- [x] Confirm glob is enforced by `bun run check` (existing `vitest run --coverage`)

### Step 2: Close branch gaps to meet floor — US-B2-03

- [x] Run coverage for official-docs; identify uncovered branches in resolve/roots/markdown
- [x] Add focused unit tests (temp fixtures as needed) until thresholds pass
- [x] Keep Standard strategy: strengthen existing suites (target ≥5 meaningful cases per risk file; no new test harness)

### Step 3: Keep-path + missing_ja contract tests — US-B2-01 / US-B2-02 · BR-B2-OD-1..3

- [x] Assert on `missing_ja` case: `path` equals requested path (never rewritten)
- [x] Assert `localeRequested` stays `ja` when notice is `missing_ja`
- [x] Keep existing: both missing → `not_found` (not notice); en missing → `not_found`

### Step 4: Anchor enum completeness — US-B2-01 · BR-B2-OD-4

- [x] Verify scrolled / top / none (+ `#`-prefixed) remain green
- [x] Add any missing edge (empty/whitespace anchor → `none`) if coverage requires

### Step 5: Manifest / empty_content alignment — BLM F1 · Errors table

- [x] Reconcile design vs brownfield: current code returns ok + empty `sourceVersion` when manifest missing (existing test)
- [x] Prefer **preserve Bolt 1 behavior** unless a design gate re-opens empty_content as Must for page resolve; document decision in code-summary
- [x] If empty_content is required for invalid snapshot only, implement narrowly without breaking happy path

### Step 6: listToc locale-scoped — BR-B2-OD-5

- [x] Confirm `listToc` returns requested-locale tree only (existing toc tests)
- [x] Add/adjust one sparse-ja fixture assertion if missing

### Step 7: Integration seam (pass-through, not a third unit) — FR-B2-4.1

- [x] Verify `api-core` official-docs handler still returns `OfficialDocsPage` wire as-is
- [x] Add/adjust route test: `missing_ja` → HTTP **200** (not 404); `not_found` → **404**
- [x] No wire field renames

### Step 8: Security / boundary hygiene — S-B2-OD-*

- [x] Confirm no network deps in `packages/official-docs/package.json`
- [x] Path escape negatives remain in suite

### Step 9: Convergence

- [x] Biome + tsc + official-docs/reader-core coverage floors green under `vitest run --coverage`
- [x] `bun run check`: fails only on pre-existing dashboard `timings.test.tsx` fake-timer timeouts (reproduced without this diff); official-docs work not implicated — see code-summary
- [x] Mark all plan checkboxes complete in this file after generation

### Step 10: Artifacts

- [x] Update this plan’s checkboxes
- [x] Write `code-summary.md` (files touched, decisions, coverage numbers, deviations)

## Out of scope (Bolt 2 Construction Bolt 2 / docs-shell)

- Dashboard UntranslatedNotice / LocaleControl UI
- Extension manual scenarios (FR-B2-5.2)
- FR-B2-S1 h1 Should
