# Code Summary — Unit: docs-shell (Construction Bolt 2 / UI)

> code-generation / docs-shell (ui) / 2026-08-02

## What shipped

Brownfield finish of Bolt 2 Docs Shell UI contracts in `packages/dashboard`: keep-path locale switch (no jump to TOC first entry), AnchorApplier for `anchorApplied` scrolled/top/none, 404≠UntranslatedNotice, strengthened `missing_ja` + LocaleControl-stays-ja coverage, soft FR-B2-S1 h1, and FR-B2-5.2 extension manual checklist artifact.

## Files touched

| Path | Change |
|------|--------|
| `packages/dashboard/src/components/DocsShell.tsx` | keep-path effect; notice gated off on error; sr-only article `h1`; wire `requestedAnchor` into page fetch; mount AnchorApplier |
| `packages/dashboard/src/components/docs-shell/AnchorApplier.tsx` | **new** — honor `anchorApplied` (scroll/focus heading or article top) |
| `packages/dashboard/tests/docs-shell.test.tsx` | keep-path + sparse-ja; notice+aria-current ja; 404≠notice; AnchorApplier unit tests; soft h1; boundary source scan |
| `…/code-generation/extension-manual-scenarios.md` | FR-B2-5.2 manual checklist |
| `…/code-generation/code-generation-plan.md` | checkboxes marked done |
| `…/code-generation/code-summary.md` | this file |

Application code under `packages/` only. Plan/summary/manual artifacts under this intent record.

## Decisions

1. **keep-path:** selection effect only seeds `selectedPath` when `null` (initial open). Never rewrites to `entries[0]` when the current path is absent from the new locale TOC (FR-B2-1.1 / 1.3). TOC highlight remains `path ∈ TOC` only (`DocsToc` `data-active`).
2. **AnchorApplier:** local GitHub-style `slugifyHeading` (no `@aidlc-guide/official-docs` import). `requestedAnchor` state is passed on fetch and preserved across locale switch; deep-link UI to *set* the fragment is out of scope for this bolt (response field + state seam ready).
3. **404 ≠ notice:** UntranslatedNotice renders only when `pageView` is not error **and** `notice === "missing_ja"`.
4. **FR-B2-S1 h1 (Should):** cheap path — sr-only `<h1 data-testid="docs-article-h1">` with `page.title` in the article. MarkdownSurface still demotes markdown `#` → `<h3>` because PanelShell owns chrome `<h2>` (a11y outline for artifact panels). Soft test asserts the article h1; **not blocked** for Bolt Must.

## Soft-fail / Should notes

| Item | Status |
|------|--------|
| US-B2-S1 / FR-B2-S1 h1 | **Implemented (cheap):** sr-only article h1 from `page.title`. Soft test green. Full natural markdown h1 would require MarkdownSurface heading-offset API — deferred, not required for Bolt Must. |

## Security / boundary

- Docs Shell files do **not** import `@aidlc-guide/official-docs` or `reader-core` (asserted in `docs-shell.test.tsx` + existing `dependency-direction.test.ts`).
- No new dashboard dependencies (P-B2-DS-1).

## Verification

- `bunx vitest run packages/dashboard/tests/docs-shell.test.tsx` — **12 passed**
- `bunx biome check` on touched files — clean
- `bunx tsc --noEmit -p packages/dashboard` — clean
- Full `bun run check` may still flake on unrelated `timings.test.tsx` — out of unit scope (same note as official-docs code-summary)

## Deviations

- None vs approved plan behavior for docs-shell Must items.
- Anchor deep-link *entry* (setting `requestedAnchor` from URL/UI) left as wired state only; AnchorApplier + fetch query param covered by unit tests.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02

### Evidence checked

| Check | Result |
|-------|--------|
| keep-path (no jump to TOC first when path absent from new locale TOC) | `DocsShell` effect preserves `selectedPath` when non-null (`lines 47–59`); sparse-ja test asserts ja fetch for kept path and no TOC highlight |
| AnchorApplier `scrolled` / `top` / `none` | `AnchorApplier.tsx` implements all three; unit tests mock `scrollIntoView` for each |
| 404 ≠ UntranslatedNotice | `showNotice = !pageError && page?.notice === "missing_ja"`; 404 test asserts no `untranslated-notice` |
| Notice iff `missing_ja` + `role="status"`; LocaleControl stays `ja` | `UntranslatedNotice` gates on `notice === "missing_ja"` and `role="status"`; integration test asserts `aria-current` on `locale-ja` while notice shown |
| No `official-docs` / `reader-core` imports | Source scan test over DocsShell + `docs-shell/*`; no import matches (comment-only reference in AnchorApplier) |
| Component IDs vs frontend-components | `DocsShell`, `LocaleControl`, `UntranslatedNotice`, `DocsToc`, `AnchorApplier` present; `DocsBody` maps to `MarkdownSurface` in article (per logical-components) |
| Plan checkboxes | All steps marked `[x]` in `code-generation-plan.md` |
| Tests | `bunx vitest run packages/dashboard/tests/docs-shell.test.tsx` — 12 passed (re-run at review) |

### Findings

None blocking. Cross-references to business-logic-model U1/U2, security-design S-B2-DS-1..4, and logical-components diagram are satisfied in code and tests.

### Notes (non-blocking)

1. **DocsBody** is a logical ID only — article body is `MarkdownSurface` inside `DocsShell`; matches logical-components “Markdown surface (lazy path)” mapping, not a separate file.
2. **`requestedAnchor` entry** (URL/UI → state) is wired for fetch + AnchorApplier but not exposed in UI; documented in summary/plan as post-bolt seam — response-driven anchor apply is covered.
3. **FR-B2-5.2 extension manual checklist** exists with unchecked execution boxes; plan explicitly defers human run — artifact requirement met.
4. **FR-B2-S1 h1** shipped as sr-only article h1 (Should, soft-tested); acceptable per plan/summary.
