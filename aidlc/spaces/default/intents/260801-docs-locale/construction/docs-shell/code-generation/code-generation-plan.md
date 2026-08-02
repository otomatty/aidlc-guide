# Code Generation Plan — Unit: docs-shell (Construction Bolt 2 / UI)

> code-generation / docs-shell (ui) / 2026-08-02  
> Brownfield: finish Bolt 2 UI contracts in `packages/dashboard` Docs Shell.  
> Stories: US-B2-01 / US-B2-02 (UI) + US-B2-03 scenarios; Should US-B2-S1  
> Test strategy: **Standard**  
> Note: Engine advanced here after `official-docs` code-gen READY. Delivery bolt-plan labels this Construction Bolt 2 (UI).

## Baseline (already present)

- `DocsShell`, `LocaleControl`, `UntranslatedNotice` (`role="status"`), `DocsToc`, `MarkdownSurface`
- Tests: locale switch, `missing_ja` notice + `role="status"`
- Wire via existing dashboard fetch → api-core (no `official-docs` import in UI)

## Gaps vs Bolt 2 DoD

1. **keep-path:** on locale change, if path missing from new TOC, effect currently jumps to `entries[0]` — violates FR-B2-1.1 / FR-B2-1.3 (keep path; TOC highlight optional)
2. **AnchorApplier:** `anchorApplied` scrolled/top/none not applied in UI
3. **404 ≠ notice:** error path must never show UntranslatedNotice
4. **h1 Should (US-B2-S1):** non-fail attempt
5. **Extension scenarios (FR-B2-5.2):** record manual checklist artifact (not automated)

## Plan steps

### Step 1: keep-path locale switch — US-B2-01 · FR-B2-1.1/1.3

- [x] Change DocsShell selection effect: never rewrite `selectedPath` to another doc on locale change; keep requested path even when absent from TOC
- [x] TOC highlight: selected iff path ∈ current TOC; else no highlight (body still loads that path)
- [x] Tests: switch en↔ja with path present in both → same path; sparse-ja path → keep path, notice/`missing_ja` as wire says

### Step 2: AnchorApplier — US-B2-01 · FR-B2-3

- [x] Implement AnchorApplier (or equivalent effect) driven by `page.anchorApplied`:
  - `scrolled` → scroll/focus matching heading
  - `top` → scroll/focus h1 / article top
  - `none` → noop
- [x] Pass anchor into page fetch if URL/state supports it (minimal: honor response field after load)
- [x] Unit/component tests for the three outcomes (jsdom scrollIntoView mocks OK)

### Step 3: Error vs notice — US-B2-02 · ADR-B2-001

- [x] Ensure `pageView.kind === "error"` renders `AreaError` only — UntranslatedNotice stays off
- [x] Test: stub 404/`not_found` → no `untranslated-notice`

### Step 4: UntranslatedNotice contract — US-B2-02

- [x] Keep render iff `notice==="missing_ja"`; `role="status"`; LocaleControl stays on `localeRequested`
- [x] Strengthen test: `aria-current` remains `ja` while notice shown

### Step 5: h1 Should — US-B2-S1 (non-fail)

- [x] Prefer h1 for page title in MarkdownSurface / DocsShell article when cheap
- [x] Test soft: assert h1 if implemented; do not fail Bolt if blocked by MarkdownSurface constraints — document in summary

### Step 6: Boundary / deps — S-B2-DS-1

- [x] Confirm dashboard Docs Shell files do not import `@aidlc-guide/official-docs` / `reader-core`
- [x] No new heavy first-paint deps (P-B2-DS-1)

### Step 7: Extension manual scenarios — FR-B2-5.2

- [x] Write checklist under this unit’s code-generation dir: `extension-manual-scenarios.md` (keep-path / missing_ja notice / missing-anchor→top)
- [x] Execution can be deferred to human; artifact records the scenarios

### Step 8: Convergence

- [x] Dashboard vitest project green for docs-shell tests
- [x] Biome + tsc for touched packages
- [x] Note: full `bun run check` may still flake on unrelated `timings.test.tsx` — do not block unit on that flake; fix only if trivial

### Step 9: Artifacts

- [x] Mark plan checkboxes
- [x] Write `code-summary.md`

## Out of scope

- Changing official-docs library contracts (Bolt 1 done)
- Cloud / CDN
- Workflow engine changes
