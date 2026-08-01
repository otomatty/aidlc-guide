**Collaborator:** aidlc-design-agent

## Contribution

UX / persona review of the user-stories draft for `260730-docs-i18n`, checked against `requirements.md` FR-U2–U4 and Ideation wireframes W1–W5. Do not expand scope; tighten story fidelity so refined-mockups and QA can assert the same screen states the wireframes already fixed.

### Personas — realism and priority

- **P1 Akira** is correctly the north-star reader: IDE-bound, offline, en/ja same TOC, untranslated without losing place. Pain (“英語公式へ飛ばされる／ブラウザ往復”) maps cleanly to Docs Shell + Bridge degrade.
- **P2 Dana** is a real second job, not a duplicate of Akira: explain-in-flow from Dashboard StageCard without breaking the mob. Keep Dana UI-facing; do not merge into P1 stories.
- **P3 Mori** correctly stays ops/PR-centric (US-01/US-07/US-08). No Webview persona inflation — matches wireframes’ deliberate omission of a U5 screen.

Priority P1 > P2 > P3 matches S-docs-1. No persona set change.

### Story coverage — Docs Shell / locale / deep link / Bridge

| Surface | Wireframe | Stories | Design stance |
|---------|-----------|---------|---------------|
| Docs Shell chrome | W1 | US-02 | Present but under-specified vs FR-U2.2 / W1 |
| Locale keep-path + anchor | W2 | US-03 | Strong GWT; add focus/control persistence cues |
| Untranslated notice | W2 | US-04 | Strong; align notice a11y with W2 |
| Deep link land | W3 / W5 | US-05 | Payload + label good; landing focus thin |
| Bridge degrade | W4 | US-06 | Primary CTA correct; optional glossary = US-09 |
| bridge-map aid | W4 optional | US-09 Should | Correctly cuttable; must not revive excerpt-as-body |

Epic×flow cut (Q2=C) and Must = FR-U1–U5 (Q3=A) are the right UX slice: reader + deep link + Bridge before ops polish.

### Gaps to fold into stories (integrable)

1. **US-02 — Docs Shell chrome (FR-U2.2 / W1)**  
   Current GWT asserts offline body + `sourceVersion` only. Add that the Shell shows **locale control + `sourceVersion` in the header**, **TOC (nav) selects a page**, and **body renders in main** — the three-pane scan pattern learners need. Keyboard reachability of TOC → body (NFR-7) can stay one Then-line or an explicit “refined-mockups details” note; do not leave chrome implied.

2. **US-03 — locale switch UX**  
   Path/anchor GWT matches FR-U2.3. Add: after switch, **locale control remains on the chosen locale** (visible current state), and when `#section` exists, **viewport/focus moves to that heading** (W2 a11y). Missing-anchor → page top is already correct.

3. **US-04 — notice fidelity**  
   en body + non-color-only notice + locale stays ja is correct and matches W2’s mandatory notice. Strengthen GWT with notice in **main** and **not color-only** (already present) plus a status/live-region expectation (`role="status"` or equivalent) so SR users hear the same explanation sighted users see — NFR-7 / W2.

4. **US-05 — deep-link land (W3 / W5)**  
   Clear label (not bare “Docs”), `{locale,path,anchor?}`, no external browser, unmapped → Shell top: all good. Add: on mapped land with `anchor`, **main scrolls/focuses the target heading**; without anchor, **Shell opens at page top** (already for unmapped; state for mapped-without-anchor too). Locale in payload may be last-used or default en per W3 — stories need not pick a policy if FR leaves it open, but acceptance should not imply a fixed locale the UI never shows.

5. **US-06 — Bridge**  
   “excerpt not primary + Open in Docs primary” matches W4 / FR-U4.1–U4.2. Optionally name a short non-canonical note (“Full docs are bundled.”) so the empty-excerpt state is not a blank panel. Keep glossary/nav on US-09 only.

### What not to change

- Do not force full ja parity into Must (Could row is right).
- Do not invent a browser Dashboard path.
- Do not merge US-03 and US-04 — happy-path keep-place vs untranslated notice are different user-visible states.
- US-09 independence from US-06 is correct for cutability.

## Positions

- AGREE: Three personas (Akira / Dana / Mori) with P1 as S-docs-1 beneficiary — realistic jobs and no Webview story for Mori.
- AGREE: Must stories US-02–US-06 cover Docs Shell, locale, deep link, and Bridge at flow grain matching W1–W5 and FR-U2–U4.
- AGREE: US-03 vs US-04 split (anchor keep vs missing-ja notice) and US-06 vs US-09 cut (canonical Docs vs optional bridge-map aid).
- AGREE: US-05 forbids bare “Docs” labels and requires extension-internal open with `{locale,path,anchor?}` — matches W5 / FR-U3.1–U3.2.
- OBJECT: US-02 GWT under-specifies Docs Shell chrome — add header locale control + TOC/main layout (FR-U2.2 / W1), not only offline render and `sourceVersion`.
- OBJECT: US-03/US-04 omit focus and status-region cues from W2/NFR-7 — fold heading focus after locale switch and `role="status"` (or equivalent) for the missing-ja notice into Must GWT.
- OBJECT: US-05 landing a11y is incomplete — assert scroll/focus to target heading when `anchor` is present (W3), symmetric with US-03’s anchor behaviour.
