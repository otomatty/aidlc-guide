**Collaborator:** aidlc-design-agent

## Contribution

UX / persona-fidelity review of the personas + 15-story draft. The persona set is clean and the three north-star journeys are covered end-to-end. My assessment focuses on untraced UX-critical requirements, worst-case states, and accessibility — the corners a story map most often drops.

### Personas — accurate and distinct (agree)
P1/P2/P3 map 1:1 to intent-statement, goals/pains are genuinely different (orientation vs. context-hygiene vs. live-follow), and the dependency framing "driver runs → novice understands → participant follows" is right. No change needed to personas.md.

### Journey coverage — the three spines are present
- S-1 novice orientation: US-01→05 ✓
- Driver context-hygiene: US-06→09 ✓
- Participant live-follow: US-10→12 ✓

### Gaps (UX-critical, ranked)

1. **Accessibility triple-encoding has no story AC (highest).** project.md carries a *mandated, learned* rule (cid:rough-mockups:c2): stage status must be color **+ symbol (✔◐◔○⊘) + text label** across **all** surfaces (Dashboard / participant view / matrix), for WCAG 2.1 AA / color-blind independence. FR-4.2 encodes it. **No story asserts it as acceptance criteria** — US-01 (Now strip), US-05 (matrix), US-10/11 (participant) all display status but none require the triple encoding. A mandated a11y rule with zero test hook will not get built or verified. Fix: add the triple-encoding assertion to the ACs of US-01, US-05, US-10 (or one cross-cutting a11y story). This is not optional per the project layer.

2. **FR-4.2 Stage rail is an orphan FR.** US-01→05 cover FR-4.1/4.3/4.4/4.6 but the Stage rail itself (the one-row EXECUTE-stage list with click-to-artifact) is traced by no story. For the novice's "全体像" job this is the primary spatial map. Either fold it into US-01's scope explicitly or give it its own story.

3. **FR-4.5 SKIP comprehension is an orphan FR — and a named UX ask.** The task brief itself calls out "SKIP-stage comprehension." A novice seeing a collapsed/absent stage will ask "is this broken or skipped?" — understanding *why a stage is SKIP* is core to "understanding the whole picture." FR-4.5 (fold + scope-derived reason) has no story. Add one (novice: "I want to see which stages are skipped and why, so I don't think the workflow is broken").

4. **First-run / empty state is missing (worst-case UX).** Every story's Given assumes "アクティブインテント" exists. There is no story for the novice opening the Dashboard against a workspace with **zero intents / no active-intent cursor** — the literal first-run moment for the persona whose whole pain is "understanding without asking." US-15 covers *broken* records and FR-1.4 covers *multiple/unresolved* cursors, but neither covers *empty*. "Design for the worst case": add an empty/first-run story with guidance-not-blank-screen AC.

5. **Driver's "share my state" + security-warning UX has no driver-owned story (persona-fidelity + security-UX).** P2's stated goal includes "自分の状態を参加者に見せたい," and Mandated/NFR-7 requires the `--host` path to print a startup warning *naming what is exposed* (artifacts may contain pasted secrets). Today the driver's act of starting Mob mode lives only as a *precondition* inside US-10 ("ドライバーが `dashboard --host` 起動"), with no AC that the driver **sees and comprehends** the exposure warning. That warning is a data-disclosure decision point — it deserves a driver story whose AC verifies the warning is shown and readable before LAN bind.

### INVEST issues (UX angle)
- **US-12 fails "Small/Testable":** it bundles three genuinely different participant journeys (tunnel / VS Code Live Share / fully-async git) behind an OR in one AC. These are distinct experiences with distinct failure modes; a tester can't cleanly pass/fail an OR. Recommend splitting into 3 (or at minimum 3 separate ACs).
- **US-09 is a foundation/tooling story dressed as a persona story** — acceptable as the driver's actual instrument, but its "Valuable-to-user" framing is thin. Fine to keep; just flag it as infrastructure so delivery-planning sequences it as such.
- **AC voice:** several ACs are phrased from the system/DOM side rather than the user's experience (US-11 "編集UIがDOMに存在せず" is QA-phrasing). Keep the testable DOM assertion, but lead with the experienced outcome ("participant sees a read-only badge and finds no editable control") so the AC reads from the user's vantage. Minor.

### Not raised as blockers
Keyboard navigation / screen-reader support is nowhere in the stories or NFRs. For a read-only viewer it's lower-stakes, but WCAG 2.1 AA (which the project invokes) implies keyboard reachability. Worth a line in refined-mockups rather than a story here.

## Positions

- AGREE: personas.md — three personas are accurate, distinct, and correctly equal-weighted; no change.
- AGREE: the three north-star journeys (S-1 / context-hygiene / live-follow) are covered by US-01..12.
- OBJECT [knowledge]: the mandated color+symbol+label triple-encoding (project.md cid:rough-mockups:c2, FR-4.2) has no story AC — an expert can settle this: a Mandated a11y rule must be a verifiable AC on the status-displaying stories. Add it.
- OBJECT [knowledge]: FR-4.2 (Stage rail) and FR-4.5 (SKIP fold + reason) are orphan FRs with no story trace; inception traceability requires every FR trace to a story. Add coverage.
- OBJECT [judgment]: no empty/first-run (zero-intent) story exists; both positions legitimate, but for the novice persona the first-launch worst-case state is high-value and I'd add it.
- OBJECT [judgment]: the driver's "share my state" moment + the NFR-7 exposure-warning comprehension deserve a driver-owned story rather than living as a precondition inside US-10.
- OBJECT [judgment]: US-12 bundles three distinct participant mechanisms behind an OR, weakening INVEST Small/Testable; recommend split, but a single doc-driven story is a defensible choice.
