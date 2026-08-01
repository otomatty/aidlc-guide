**Collaborator:** aidlc-developer-agent

## Contribution

Reviewed Must US-01–US-07 and Should US-08–US-09 for implementability, INVEST sizing (Q5=A ≈ 1–2 days), missing technical acceptance, and dependency order against `requirements.md` (FR-U1–U6, NFR-1–7). Persona set and FR-epic × flow cut (Q1=A / Q2=C / Q3=A) are sound. Dependency graph is mostly correct. Gaps are technical AC holes and one oversized Must story — not persona or priority mistakes.

**What builds cleanly.** US-03 / US-04 / US-06 are thin, independently estimable, and map 1:1 to FR cells with GWT that QA can automate. Parallelism after US-02 (US-03 ‖ US-04 ‖ US-05 ‖ US-06) matches the real package boundaries (locale switch / fallback notice / Dashboard deep-link / Bridge degrade). US-08 / US-09 correctly sit as cuttable Should with independent cut of US-09 from US-06.

**Structural gap — FR-U2.6 has no story AC.** Requirements mandate API `/api/official-docs/:locale/*` (no collision with `/api/guides` / `/api/docs-settings`). No Must story’s Given/When/Then asserts route shape, locale segment, or non-collision. US-02 is the natural owner; without it, Units Generation invents the contract or forgets the anti-collision rule.

**Sizing — US-02 is the walking skeleton, not a 1–2 day story as written.** It bundles Docs Shell chrome (TOC + body + header), offline content serve, and `sourceVersion` display (FR-U2.1/2.2/2.4). That is the first vertical slice (api-core route + guardPath load + Webview shell). Under Q5=A it fails INVEST-Small unless framed as the skeleton Bolt and/or split (content API+load vs Shell UI). Downstream Must stories all hang on it, so under-sizing here slips the whole M-chain.

**Missing technical acceptance (Must).**
- **US-01:** No AC for tree layout `docs/guide|reference/<locale>/` vs existing product `docs/guides/` (project DECIDED reverse-engineering:c2). No AC that ingest is checked-in / reproducible (script or committed tree) with non-empty `sourceVersion`. File-presence alone does not prevent landing under the wrong directory.
- **US-02:** Missing FR-U2.6 route AC; missing NFR-1 explicit “no network fetch of official docs” as a negative assert (stated in prose but not as a Then); missing NFR-2 `guardPath` + locale content-root containment (negative path traversal in `bun run check`). NFR-7 keyboard TOC/body + landmarks are Should a11y but zero AC on US-02 — fine to defer to NFR stage if called out; silent omission will drop them.
- **US-05:** FR-U3.3 lists seven stage slugs but AC only says “per FR-U3.3 list” — no Then that a static map resolves each slug to a non-empty `path` (+ optional `anchor`), and no AC for where `locale` in `{locale,path,anchor?}` comes from (user preference vs default `en`). Unmapped → Docs Shell top is covered. Command name deferred to Functional Design is OK (Open Question).
- **US-07:** Bootstrap (≥1 ja page renderable) is buildable and testable. “No continuous auto-MT pipeline” is a process/negative constraint — weak as a user-story GWT (absence of a pipeline). Keep bootstrap in US-07; treat no-auto-MT as Constraint/NFR check, not a story Then that pretends to observe a missing CI job.

**Deps.** Footer graph is right: US-01 → US-02 → {US-03, US-04, US-05, US-06}; US-01+US-02 → US-07 → US-08; US-06 ⊥ US-09. US-05 correctly does **not** depend on US-03/US-04 (deep link can land en-only). US-08 depending on US-07 is process-ordering (diff feeds translate PR), not a hard code dep — acceptable for Should.

**Otherwise sound.** Q3=A Must = FR-U1–U5 only; U6/U4.3 as Should. GWT on Must / checklist on Should (Q4=C). Untranslated notice keeps locale=ja (FR-U2.5) — implementable without a second story for “locale sticky.”

## Positions

AGREE: Q1=A three personas; Q2=C FR epics × flow stories; Q3=A Must = U1–U5 only; Q4=C GWT on Must / checklist on Should — matches requirements READY and keeps Should cuttable.

AGREE: Dependency spine US-01 → US-02 → parallel reader/deep-link/bridge stories; US-05 independent of US-03/US-04; US-09 cuttable independently of US-06.

AGREE: US-03 / US-04 / US-06 sizing and GWT — INVEST-Small, estimable, testable; ready for Units without split.

AGREE: US-08 / US-09 as Should with thin checklists — correct under Q3=A; format of diff report stays Open Question (Functional Design).

OBJECT [knowledge]: FR-U2.6 (`/api/official-docs/:locale/*`, no collision with `/api/guides` / `/api/docs-settings`) is absent from every Must story AC. Add a Then under **US-02** (or a thin US-02b) that asserts the route serves bundled content for a known path and that the guides/docs-settings routes remain distinct.

OBJECT [judgment]: US-02 fails INVEST-Small under Q5=A as written (Shell chrome + offline serve + version header = walking skeleton). Either (a) mark US-02 explicitly as the first Bolt / skeleton with an honest multi-day size, or (b) split into content load+API (FR-U2.1/U2.6 + NFR-2) and Docs Shell UI (FR-U2.2/U2.4). Do not leave it as “1–2 days” without one of those moves.

OBJECT [judgment]: US-01 missing technical AC for correct tree roots (`docs/guide|reference/<locale>/`, not `docs/guides/`) and a reproducible ingest artifact (manifest fields already listed — add path-layout Then). Without it, Construction can collide with the product guides tree.

OBJECT [judgment]: US-05 missing technical ACs: (1) static map covers all seven FR-U3.3 slugs with non-empty `path` each; (2) `locale` source in the openOfficialDoc-style payload (preference vs default). Label-not-bare-“Docs” and unmapped→top are already adequate.

OBJECT [judgment]: US-02 (or companion NFR story note) should carry NFR-2 containment negative test and NFR-1 offline negative assert as technical acceptance — requirements already require them in `bun run check`; stories that omit them will not drive Units to write the enforcement tests.

OBJECT [judgment]: US-07 should keep bootstrap (≥1 ja page via US-02 path) as the story AC; demote “no continuous auto-MT pipeline” to a Constraint / verification note (process absence), not a primary GWT Then — it fails INVEST-Testable as currently phrased.
