# User Stories — Docs i18n Bolt 4

> ステージ: user-stories (Inception) / 作成日: 2026-08-03  
> Intent: `260802-docs-bridge`  
> 根拠: [requirements.md](../requirements-analysis/requirements.md)（FR-B4-1…4 READY）  
> 上流: codekb `business-overview` / `component-inventory` · [team-practices.md](../practices-discovery/team-practices.md)  
> Mob: design / developer / quality contributions integrated（インライン）

## Epics（FR 対応）

| Epic | FR / NFR | Priority |
|------|----------|----------|
| E4 Bridge degrade | FR-B4-1, FR-B4-2 | Must |
| E4b Verify | FR-B4-3, NFR-B4-1…3 | Must |
| E4c Glossary (optional) | FR-B4-4 | Should |

入力: [requirements.md](../requirements-analysis/requirements.md)、[personas.md](./personas.md)

---

## Must Have

### US-B4-01 — Excerpt を記事として載せない  
**Epic:** E4 · **Persona:** P1 · **FR:** FR-B4-1.1, FR-B4-1.2 · **NFR:** NFR-B4-3  
**Sizing:** Small

As a driver,  
I want Legacy Bridge / StageCard docs UI to stop mounting excerpt as an article,  
so that I am not led to treat Bridge as a second canonical doc.

**Acceptance (GWT):**
- Given the **VS Code / Cursor extension** Dashboard shows Legacy Bridge or StageCard docs UI for a stage that has a non-null `doc.excerpt` from the API  
  When the panel renders  
  Then no excerpt article region is present (`data-testid="docs-excerpt"` absent, or equivalent named test id absent)  
  And assistive tech does not expose a primary document body composed of that excerpt on the Bridge surface
- Given the API still returns `excerpt`  
  When the UI renders  
  Then the UI still does **not** mount it as article content (FR-B4-1.2)

**INVEST:** Independent of CTA wiring; Valuable; Testable via DOM / Testing Library.  
**Deps:** none for non-mount; can land before/with US-B4-02.  
**Surface:** Extension Webview only (NFR-B4-3).

### US-B4-02 — Open in Docs is primary CTA → open-official-doc  
**Epic:** E4 · **Persona:** P1 · **FR:** FR-B4-2.1–2.4 · **NFR:** NFR-B4-1, NFR-B4-3  
**Sizing:** Medium

As a driver,  
I want Open in Docs to be the primary action that opens Docs Shell via the existing host contract,  
so that the canonical docs experience stays inside the extension.

**Acceptance (GWT):**
- Given Bridge / StageCard docs UI is shown  
  When I inspect the primary action  
  Then Open in Docs (accessible name pinned in Functional Design) is the primary CTA (visual hierarchy + keyboard tab order reach it as the main docs action)  
  And it is not merely a secondary/ghost control while another docs action dominates
- Given I activate Open in Docs (pointer **or** keyboard: Tab → Enter/Space)  
  When the host handles the message  
  Then the message type is `open-official-doc` with payload shape per FR-B3-1.1 (reuse; do not invent a parallel type)  
  And Docs Shell opens inside the host  
  And `openExternal` / `window.open` / `target=_blank` are **not** invoked  
  And no outbound fetch to remote official-docs URLs is initiated (NFR-B4-1)
- Given a mapped stage  
  When I activate Open in Docs  
  Then Shell lands per Bolt 3 FR-B3-4 (path/locale/anchor/one-shot) as applicable

**Construction pins:** Final visible label / accessible name → Functional Design (FR-B4-2.4). Reuse `packages/vscode-extension/src/open-official-doc.ts` and dashboard `OpenOfficialDocLink` patterns where possible.

**INVEST:** Depends on host contract existing (Bolt 3); Valuable; Testable via message spy + Shell open.  
**Deps:** Bolt 3 openOfficialDoc + Docs Shell.  
**Surface:** Extension only.

### US-B4-03 — Demo + automated check coverage  
**Epic:** E4b · **Persona:** P1 / P3 · **FR:** FR-B4-3.1, FR-B4-3.2 · **NFR:** NFR-B4-2  
**Sizing:** Small

As a maintainer,  
I want Demo plus automated UI/contract tests in `bun run check`,  
so that Bridge degrade does not regress.

**Acceptance (GWT):**
- Given US-B4-01 and US-B4-02 are implemented  
  When I run `bun run check`  
  Then tests covering excerpt non-mount and CTA → `open-official-doc` are included and failing them turns check red (NFR-B4-2 / team-practices)
- Given a manual Demo session  
  When I follow Legacy Bridge → Open in Docs → Docs Shell  
  Then Shell opens without external browser and the session demonstrates “canonical docs = bundled Docs only” (FR-B4-3.1)

**INVEST:** Verification story; Valuable; Testable.  
**Deps:** US-B4-01, US-B4-02.

---

## Should Have

### US-B4-S1 — Glossary / 補助 may remain  
**Epic:** E4c · **Persona:** P2 · **FR:** FR-B4-4.1, FR-B4-4.2  
**Sizing:** Tiny / optional

As a beginner,  
I want optional glossary/aid UI to remain if useful,  
so that Bridge can still help without being canonical.

**Acceptance (GWT):**
- Given US-09 aids are present or absent  
  When evaluating Bolt 4 DoD  
  Then absence does **not** fail Must stories US-B4-01…03  
  And if present, aids must not reintroduce excerpt-as-article (US-B4-01 still holds)

**INVEST:** Optional; cuttable.  
**Deps:** US-B4-01.

---

## Won't (this Bolt)

- Re-implement StageCard deep-link map (B3 / #29)
- B5 upstream diff report (#31)
- Locale/untranslated rework
- Terminal inject / chat post / cloud hosting / workflows engine changes

## Traceability

| Story | FR / NFR |
|-------|----------|
| US-B4-01 | FR-B4-1.* |
| US-B4-02 | FR-B4-2.*, NFR-B4-1, NFR-B4-3 |
| US-B4-03 | FR-B4-3.*, NFR-B4-2 |
| US-B4-S1 | FR-B4-4.* |

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY  
**Date:** 2026-08-03  
**Note:** Inline product-lead checklist (Task API limit).

### What holds

- Every Must FR-B4-1…3 and NFR-B4-1…3 maps to US-B4-01…03 AC.
- US-09 is Should (US-B4-S1) and non-failing for DoD.
- GWT AC are testable; open-official-doc reuse explicit.
- Won't aligns with requirements Out of Scope.
