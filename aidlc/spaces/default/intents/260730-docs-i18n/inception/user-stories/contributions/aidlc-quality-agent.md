**Collaborator:** aidlc-quality-agent

## Contribution

Blind spoke on `stories.md` / `personas.md` from a testability lens. Plan answers (Q2=C, Q3=A, Q4=C, Q5=A) are sound for QA: Must stories carry GWT; Should use short checklists; INVEST-thin slices map cleanly to unit/integration seams. Personas P1–P3 correctly own the surfaces we will automate (reader, deep link, ops). Gaps below are about making acceptance **executable** and closing NFR-2/NFR-3 that requirements already made Must but stories do not yet voice.

### What is already testable (keep)

| Story | Why QA can automate |
|-------|---------------------|
| US-01 | File-tree + manifest JSON field asserts (non-empty `sourceVersion`, `source`, `capturedAt`) — fixture/repo inspection |
| US-03 | Two distinct When/Then branches (anchor present → scroll; missing → page top + locale stays ja) — three FR-U2.3 conditions covered |
| US-04 | Three independent asserts: en body, visible non-color-only notice, locale control remains ja — matches FR-U2.5 |
| US-05 (shape) | Payload `{locale,path,anchor?}` + no external browser + unmapped → Docs Shell top — contract-testable once command/type string is fixed in Functional Design |

Must GWT format (Q4=C) is the right default; do not dilute Must stories into checklists.

### Ambiguous / hard-to-oracle criteria (tighten before Units)

1. **US-02 — “no network fetch of official docs”**  
   Correct NFR-1 intent, weak oracle. Prefer: spy/deny on host fetch of official upstream URLs **or** assert body bytes come only from bundled tree / `/api/official-docs/:locale/*`. “Offline” alone is not a Vitest assertion.

2. **US-05 — “clear label (not bare Docs)” + “openOfficialDoc-style”**  
   Label rule is good but needs a concrete forbidden pattern (exact string `Docs` alone) and an example allowed pattern already in FR-U3.2. Command/message type name is deferred (requirements Open Question) — AC should say “payload shape + host opens path” and treat the string as a later contract pin, not leave “-style” as the pass criterion.

3. **US-05 — slug matrix by reference only**  
   “Map minimum slugs: per FR-U3.3 list” forces testers to leave the story. Enumerate the seven slugs in the Then (or a linked checklist in the story body) so the acceptance matrix is self-contained: `intent-capture`, `feasibility`, `scope-definition`, `rough-mockups`, `reverse-engineering`, `practices-discovery`, `requirements-analysis`.

4. **US-06 — “excerpt body is not the primary content” / “primary action”**  
   Visual hierarchy language. Prefer observable rules: excerpt body not rendered as main article (or not mounted), and the Docs CTA is the only/default activation path into Docs Shell (role/name assertable).

5. **US-01 — “exist with content”**  
   Empty file vs non-empty tree is undefined. Prefer: at least one content file under each of `docs/guide/en/` and `docs/reference/en/` (or “tree non-empty”) plus manifest schema.

6. **US-07 — process AC mixed into product GWT**  
   “Arrives via a PR touching `docs/**/ja/**`” and “no continuous auto-publish MT pipeline” are workflow/architecture constraints, not extension runtime asserts. Keep ≥1 ja page renderable (product GWT); move PR/no-MT to Constraints or a non-runtime checklist so Construction does not invent flaky “git history” tests.

7. **US-08 / US-09 checklists**  
   Acceptable for Should cuttability, but weak oracles: “usable as input”, “may power nav/glossary”, “does not reintroduce excerpt-as-canonical”. If retained, add one negative assert each (e.g. US-09: canonical body path still US-02/US-06; no excerpt-as-main).

### Gaps vs NFR-2 / NFR-3 (Must in requirements — missing from stories)

Requirements already mandate:

- **NFR-2:** bundled docs reads use `guardPath` + locale content root; **negative tests** in `bun run check`.
- **NFR-3:** locale resolution / content-load module **95% branch coverage**.

No Must story GWT mentions path containment, escape attempts, or the coverage floor. Without a story (or an explicit NFR acceptance story/AC bullet), Units/Build-and-Test can ship reader happy-paths and still miss the practices-affirmed gate.

**Quality ask for the mob merge:**

- Add AC (prefer under US-01 consumer path or a thin companion Must / US-02 deps) that locale-scoped content load **rejects** paths outside the locale content root (`guardPath` / equivalent), and that those negative cases run under `bun run check`.
- State NFR-3 as an acceptance/quality gate for the locale resolver/loader module (Vitest branch threshold on that path), not only as ambient requirements text. US-02/US-03/US-04 already exercise the module — the coverage floor should be named where those stories are accepted.

Also note (secondary, not blocking this spoke): FR-U2.6 (`/api/official-docs/:locale/*`) has no story AC; NFR-7 keyboard/landmarks/locale-label a11y is only partially echoed by US-04’s non-color-only notice. Prefer FR-U2.6 in US-02 Then; leave full NFR-7 to NFR/refined stages unless product wants one a11y bullet on US-02.

### Pyramid hint (for later Construction — not a produce edit)

- Unit-heavy: locale resolve, missing page, missing anchor, `guardPath` negatives, manifest parse (NFR-2/3 home).
- Thin integration: Docs Shell open + TOC select (US-02); locale switch matrix (US-03/US-04); StageCard → postMessage → open path (US-05) once.
- No new e2e framework; Should US-08 format remains deferred (requirements Open Question) — do not invent report-format tests until Functional Design pins output.

## Positions

- AGREE: Q4=C (Must=GWT, Should=checklist) and Q3=A (U1–U5 Must) — right test investment shape for S-docs-1.
- AGREE: US-03 and US-04 GWTs are independently assertable and match FR-U2.3 / FR-U2.5; keep them split (do not merge into one story).
- AGREE: US-08/US-09 as Should with cuttability — checklist form is fine if cut does not weaken Must GWT.
- DISAGREE (gap): Shipping Must stories without NFR-2 negative-test and NFR-3 95% branch acceptance voice — requirements already Must; stories must carry executable AC or an explicit quality-gate bullet.
- DISAGREE (ambiguity): US-02 offline claim, US-06 “primary”, US-05 slug-by-reference, and US-07 process-as-GWT as written — tighten oracles before Units Generation.
- RECOMMEND: Enumerate FR-U3.3’s seven stage slugs inside US-05 acceptance; pin US-02 body source to bundled `/api/official-docs` (or equivalent) rather than prose “offline.”
