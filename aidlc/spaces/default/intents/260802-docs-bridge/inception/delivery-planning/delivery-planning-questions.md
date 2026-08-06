# Delivery Planning — Clarifying Questions

**Intent:** `260802-docs-bridge` (docs-i18n Bolt 4)  
**Unit:** `docs-navigation` (single code unit)  
**Answered:** Yes — recommended defaults `1,1,1,1,1` (2026-08-04)

---

## Q1. Construction bolt shape

How should Construction be sequenced for the single unit?

1. **One Construction bolt** — Functional Design → NFR Design → Infrastructure Design → Code Generation → Build and Test → Outcomes Pack for `docs-navigation` (recommended for single-unit Bolt 4)
2. **Split UI vs host** — two bolts (dashboard first, then host/webview) even though units-generation kept one unit
3. **Other** — describe

[Answer]: 1

---

## Q2. Worktree / branch practice

Practices say prefer worktree + PR into main. Confirm for this intent:

1. **Worktree + PR into `main`** — recommended; matches `project.md` / `team.md`
2. **Branch on existing clone only** — no worktree
3. **Direct main** — not recommended

[Answer]: 1

---

## Q3. US-09 (Should) in the plan

US-B4-S1 is Should / cuttable. How should Delivery Planning treat it?

1. **In plan as optional slice** — scheduled after Must acceptance; explicitly droppable without blocking bolt complete (recommended)
2. **Defer entirely** — omit from bolt plan; track only as backlog note
3. **Promote to Must** — include as required for bolt complete

[Answer]: 1

---

## Q4. Demo vs production wiring order

Functional Design will finalize CTA a11y naming. For Construction sequencing:

1. **Demo-first then production** — prove non-mount + Open in Docs + Demo CTA against fixture, then wire production Bridge path (recommended)
2. **Production-first** — wire live Bridge host path before Demo polish
3. **Parallel** — Demo and production in same Code Generation pass with no preferred order

[Answer]: 1

---

## Q5. Risk buffer

Biggest delivery risks: CTA a11y name still open; host/webview vs dashboard dual surface; US-09 cut decision late; B3 contract drift.

1. **Accept risks as documented** — track in risk-and-sequencing; no extra buffer bolt (recommended for small feature bolt)
2. **Add explicit contingency day** — pad schedule before Outcomes Pack
3. **Hard gate before Code Generation** — require Functional Design CTA name + a11y checklist sign-off before codegen starts (already natural via stage order)

[Answer]: 1
