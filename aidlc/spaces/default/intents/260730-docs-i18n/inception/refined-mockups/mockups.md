# Refined Mockups — Docs i18n

> ステージ: refined-mockups / 2026-07-31  
> 計画: Q1–Q6 = A（推奨）  
> 上流: [wireframes.md](../../ideation/rough-mockups/wireframes.md) · [user-flow.md](../../ideation/rough-mockups/user-flow.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md) · [team-practices.md](../practices-discovery/team-practices.md)  
> 忠実度: mid — 既存拡張トークン上の構造・状態・ラベル。ピクセルパーフェクト不要。

## Story → Screen Map

| Story | Screen / state | Notes |
|-------|----------------|-------|
| US-02 | **RM1** Docs Shell | Walking skeleton UI |
| US-03 | **RM2a** Locale keep-path | Same shell |
| US-04 | **RM2b** Untranslated | Notice in main |
| US-05 | **RM3** + **RM5** | Deep-link land + StageCard link |
| US-06 | **RM4** Bridge | Primary CTA |
| US-01/07/08/09 | — / optional glossary | No dedicated Webview (US-09 optional aid on RM4) |

---

## RM1 — Docs Shell（US-02 / FR-U2.1–2.2, 2.4, 2.6）

```text
┌─ header (landmark) ─────────────────────────────────────────────┐
│ AIDLC Docs    Locale: [en] [ja*]    sourceVersion: <manifest>   │
│               * = aria-current / pressed on active              │
├─ nav (TOC) ──────────────┬─ main ───────────────────────────────┤
│ Guide                    │ # <h1 page title>                    │
│  · Getting started  ←──  │                                      │
│  · Workflow         sel  │ <markdown body from                  │
│ Reference                │  /api/official-docs/:locale/*>       │
│  · …                     │                                      │
├──────────────────────────┴──────────────────────────────────────┤
│ optional: “Skip to content” target = main                       │
└─────────────────────────────────────────────────────────────────┘
```

**States:** see interaction-spec § Shell states.  
**Narrow Webview:** TOC collapses behind “Contents” toggle; header locale+version stay visible.

---

## RM2a — Locale switch keep-place（US-03）

```text
Before: locale=en  path=/guide/foo  #section in view/focus
Action: activate [ja]
After:  locale=ja  same path
        if #section exists → scroll+focus heading
        else → page top
        Locale control shows ja (visible + aria-current)
```

## RM2b — Untranslated page（US-04）

```text
locale control: ja
main:
  ┌─ role=status ─────────────────────────────────────────────┐
  │ 日本語訳はまだありません — 英語を表示しています              │
  └───────────────────────────────────────────────────────────┘
  # title (en body…)
```

Notice: not color-only; in `main`; status/live region.

---

## RM3 — Deep-link landing（US-05 / W3）

```text
Host opens Docs Shell with {locale, path, anchor?}
→ TOC highlights path
→ if anchor present & exists: focus/scroll heading in main
→ if anchor absent OR not found: page top (US-03 precedent)
→ locale = preference || en
```

## RM5 — StageCard exit（US-05 / W5）

```text
StageCard (existing hierarchy — no new h1)
  …
  [Docs: Intent Capture]   ← not bare "Docs"
```

Seven mapped slugs per stories US-05; unmapped → Shell top.

---

## RM4 — Bridge degrade（US-06）

```text
┌─ main ──────────────────────────────────────────┐
│ ## 公式ドキュメントは拡張内へ                      │
│ Full docs are bundled.                          │
│ [Open in Docs]  ← default / primary activation  │
│ (optional) glossary from bridge-map — US-09     │
│ excerpt markdown NOT mounted as article body    │
└─────────────────────────────────────────────────┘
```

---

## Non-UI (referenced)

| Story | Surface |
|-------|---------|
| US-01 | Repo trees + manifest |
| US-07 | ≥1 ja page + PR constraint |
| US-08 | Diff report (Should) |
| US-09 | Optional glossary on RM4 |

## Out of fidelity

- Pixel polish / marketing illustration  
- Browser Dashboard path  
- Full ja parity UI chrome  
- Auto-MT progress UI  

---

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY  
**Date:** 2026-07-31

### Adversarial sweep — what I tried to break

**Coverage check — Must UI stories vs screens**

| Story | Mapped screen | FR coverage | Verdict |
|-------|--------------|-------------|---------|
| US-02 | RM1 Docs Shell | FR-U2.1, 2.2, 2.4, 2.6 | PASS |
| US-03 | RM2a locale keep-path | FR-U2.3 | PASS |
| US-04 | RM2b untranslated | FR-U2.5 + NFR-7 notice | PASS |
| US-05 | RM3 deep-link land + RM5 StageCard | FR-U3.1–3.3 | PASS |
| US-06 | RM4 Bridge degrade | FR-U4.1, 4.2 | PASS |
| US-01/07/08/09 | Non-UI / optional | — | Correct omission |

All five Must UI stories have a screen; non-UI stories are correctly excluded. No orphaned screens.

**FR-U2 line-by-line:**
- FR-U2.1 (offline): RM1 body served from `/api/official-docs/:locale/*`; interaction-spec loading/empty states preclude runtime upstream fetch. PASS.
- FR-U2.2 (shell layout): RM1 ASCII wireframe shows header + nav(TOC) + main. PASS.
- FR-U2.3 (locale keep-path + anchor): RM2a gives three-branch oracle — same path, anchor exists → scroll, anchor absent → page top; locale control stays ja. PASS.
- FR-U2.4 (sourceVersion): RM1 header shows `sourceVersion: <manifest>`. PASS.
- FR-U2.5 (untranslated): RM2b shows `role=status` notice + en body + locale=ja. All three conditions testable. PASS.
- FR-U2.6 (API route): RM1 body annotation names `/api/official-docs/:locale/*`; design-system-mapping naming table repeats it. PASS.

**FR-U3 line-by-line:**
- FR-U3.1 (deep link payload): RM3 names `{locale, path, anchor?}`; interaction-spec `OpenOfficialDocLink.payload` confirms shape. PASS.
- FR-U3.2 (label not bare "Docs"): RM5 shows `[Docs: Intent Capture]`; interaction-spec `label` prop rule stated. PASS.
- FR-U3.3 (seven slugs + fallback): RM5 text "Seven mapped slugs per stories US-05; unmapped → Shell top." References upstream US-05 which enumerates them. Map data is a Functional Design artifact; the UI contract (fallback to top) is stated. PASS.

**FR-U4 line-by-line:**
- FR-U4.1/4.2 (excerpt not primary; canonical = bundled): RM4 "excerpt markdown NOT mounted as article body"; `[Open in Docs]` is primary CTA. PASS.
- FR-U4.3 (bridge-map Should): RM4 optional glossary via US-09; interaction-spec `BridgeRedirectPanel.withGlossary` state. PASS.

**NFR-7 (Should):**
- A1 keyboard TOC→body: interaction-spec `DocsToc` keyboard section + accessibility-checklist A1. PASS.
- A2 h1 + nav + main: RM1 annotates h1, interaction-spec names landmarks. accessibility-checklist A2. PASS.
- A3 visible locale label + aria-current: LocaleControl a11y table. accessibility-checklist A3. PASS.

**Shell states (interaction-spec):** loading / empty / error / ready / partial — all five named with triggers and UI descriptions. US-04 maps to `partial`. PASS.

**Component specs completeness:** All five components have state table, props, a11y table. LocaleControl responsive table covers narrow/wide. PASS.

**Design-system alignment:** Token mapping table ties every UI need to existing VS Code CSS variables or existing primitives. No new design system introduced. `MarkdownSurface` reuse explicit. PASS.

**W1–W5 upstream continuity:** RM1–RM5 match or narrow W1–W5 in all material behaviors; no regression from rough-mockup stage. PASS.

---

### Observations — non-blocking

**OB-1 — Narrow Webview breakpoint unspecified (px/rem).**  
RM1 and design-system-mapping say "narrow Webview → TOC collapses" but give no CSS px threshold. For a VS Code panel at mid-fidelity this is acceptable (developer will choose a reasonable value, e.g. 480 px); but Functional Design should pin it to prevent inconsistency between LocaleControl truncation and TOC collapse triggering at different widths. Not a question that blocks engineering start.

**OB-2 — LocaleControl `switching` state visual treatment not specified.**  
The state table notes "brief busy while load" but does not say whether the control is disabled, dimmed, or shows an inline spinner. A developer will make a safe default choice (e.g. disable + aria-busy). Record the decision in Functional Design.

**OB-3 — RM2b + anchor combination implicit.**  
RM2b (untranslated en body) does not explicitly state anchor behavior. RM2a's oracle (anchor exists → scroll, else → top) is directly applicable because the en body is served at the same path/anchor. A developer reading both RMs will infer the correct behavior. One-line clarification in Units Generation recommended; does not block.

**OB-4 — DocsToc narrow-mode toggle ARIA label not stated.**  
interaction-spec DocsToc collapsed state is named but the "Contents" toggle button's accessible name is not specified. Standard disclosure-button pattern applies; not a blocker. Units Generation should assert the accessible name.

---

### Summary

Every Must UI story (US-02–US-06) has a wireframe screen with testable states. All FR-U2–U4 sub-requirements and NFR-7 criteria are represented and machine-checkable. Component specs are actionable. Four observations are documentation-quality notes, not engineering blockers. Application Design and Construction can start without returning with blocking UI questions.

**READY**
