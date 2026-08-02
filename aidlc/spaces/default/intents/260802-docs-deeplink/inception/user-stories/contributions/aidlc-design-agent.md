**Collaborator:** aidlc-design-agent

## Contribution

UX / persona fidelity review of Bolt 3 user-stories (`260802-docs-deeplink`) against `personas.md` (P2 primary), `requirements.md` FR-B3-1…6 / NFR-B3-2, and Ideation wireframes W1a / W2a + Flow A. Scope stay: StageCard → Docs Shell deep link only; no Bridge / Bolt 2 locale redesign.

**Mob Round 2:** Lead folded Round 1 design OBJECTs into US-B3-01 / US-B3-03 GWT (keyboard activate + top/unmapped focus). Re-reviewed revised `stories.md` — prior gaps closed; no new UX objections.

### Personas — P2 primary fidelity

- **P2 Dana** is correctly ranked #1 for Bolt 3 (Q1=A). Job (“StageCard を見せながら説明する”) maps 1:1 to Flow A / W1a→W2a. Pain (external browser / bare `Docs` / top-only land) is addressed by US-B3-01, US-B3-02, US-B3-03, US-B3-05 — keep Dana as the UI-facing owner of those stories.
- **P1 Akira** correctly stays secondary: no dedicated Bolt 3 story needed; P1 success is the readable Shell after Dana’s land (locale + body via US-B3-01). Do not invent a separate “reader opens docs” path.
- **P3 Mori** correctly owns US-B3-04 / US-B3-06 (map freeze + check/demo). No Webview persona inflation.

Priority P2 > P1 > P3 matches the Bolt 3 north star. No persona set change.

### Story × surface map (design stance)

| Story | Surface | Persona | UX stance |
|-------|---------|---------|-----------|
| US-B3-01 | W1a → W2a mapped land | P2 | Payload + Shell + one-shot + locale; Tab+Enter/Space activate; focus to heading/`h1`/`main` on all land cases |
| US-B3-02 | W1a label | P2 | Correct ban on bare `Docs`; accessible name includes stage |
| US-B3-03 | W2a unmapped → top | P2 | Dead-end prevention; focus into Shell `main`/chrome after open |
| US-B3-04 | map module | P3 | Non-UI scope guard — no UX concern |
| US-B3-05 | legacy path off | P2 | Correct interaction-path invariant (no browser/IDE open) |
| US-B3-06 | check + demo | P3 | Demo on intent-capture matches Flow A success — good |

INVEST split (label / mapped / unmapped / map / legacy / verify) matches Q5=A and keeps user-visible states separable for refined-mockups and QA.

### Round 1 OBJECT disposition (resolved)

1. **US-B3-01 keyboard activation** — GWT now states pointer **or** keyboard: Tab to the link, then Enter/Space. Matches W1a operable entry.
2. **US-B3-01 top-land focus** — missing-anchor and no-anchor cases now assert focus to page `h1` or `main`; general open step also moves focus into Shell. Matches W2a.
3. **US-B3-03 unmapped→top focus** — GWT now places keyboard focus in Shell `main` (or Shell chrome entry). Matches W2a keyboard-entry rule.

No further Must GWT gaps from a design stance.

### What not to change

- Do not add a browser Dashboard acceptance path (NFR-B3-2).
- Do not merge US-B3-01 and US-B3-03 — mapped land vs unmapped top are distinct user-visible states.
- Do not expand 7-slug map or revive Bridge / keep-path stories (Q6=D).
- US-B3-02 thin label story is correct; do not overload it with openOfficialDoc wiring.
- Message type/command string staying Open for Functional Design (FR-B3-1.4) is fine for UX stories.

## Positions

- AGREE: P2 Dana primary / P1 secondary / P3 tertiary ranking — Bolt 3 north star is StageCard deep link; matches Q1=A and personas.md.
- AGREE: Must split US-B3-01…06 (mapped open, label, unmapped top, map freeze, legacy off, verify+demo) — INVEST grain matches Flow A / W1a–W2a and FR-B3-1…6.
- AGREE: US-B3-01 forbids external browser / `target=_blank`, requires one-shot deep-link, locale preference||`en`, keyboard activate (Tab+Enter/Space), and focus/scroll for anchor + top-land (`h1`/`main`) — core P2 success.
- AGREE: US-B3-02 requires stage name in accessible name and rejects bare `Docs` — matches FR-B3-2.1 / W1a scanability.
- AGREE: US-B3-03 unmapped→top places focus in Shell `main`/chrome — Round 1 focus OBJECT closed.
- AGREE: No remaining design OBJECTs after Round 1 integration.
