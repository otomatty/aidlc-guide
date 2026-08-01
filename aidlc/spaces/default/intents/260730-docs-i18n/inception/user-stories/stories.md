# User Stories — Docs i18n

> ステージ: user-stories / 2026-07-31  
> 計画: Q2=C（FR epic × フロー粒度）/ Q3=A（Must=U1–U5）/ Q4=C（Must=GWT）/ Q5=A（INVEST）  
> 根拠: [requirements.md](../requirements-analysis/requirements.md)  
> Mob Round 1: design / developer / quality contributions integrated 2026-07-31

## Epics（FR 対応）

| Epic | FR | Priority |
|------|-----|----------|
| E1 Snapshot | FR-U1 | Must |
| E2 Reader + i18n | FR-U2 | Must |
| E3 Deep link | FR-U3 | Must |
| E4 Bridge | FR-U4 | Must |
| E5 Translate ops | FR-U5 | Must |
| E6 Diff report | FR-U6 | Should |
| E4b bridge-map aid | FR-U4.3 | Should |

---

## Must Have

### US-01 — Ingest official docs snapshot  
**Epic:** E1 · **Persona:** P3（実装はチーム）· **FR:** FR-U1.1, FR-U1.2

As a documentation maintainer,  
I want official guide+reference content and a version manifest in the repo,  
so that the extension can serve offline docs with a known `sourceVersion`.

**Acceptance (GWT):**
- Given a snapshot job/process has run  
  When I inspect the repo  
  Then `docs/guide/en/` and `docs/reference/en/` exist  
  And each tree contains at least one non-empty content file  
  And those trees are **not** under product `docs/guides/` (distinct root)  
  And `docs/official-docs.manifest.json` contains non-empty `sourceVersion`, `source`, `capturedAt`.

**INVEST:** Independent of UI; Valuable; Testable via file presence.  
**Deps:** none (first).

### US-02 — Open Docs Shell and read a page (walking skeleton)  
**Epic:** E2 · **Persona:** P1 · **FR:** FR-U2.1, FR-U2.2, FR-U2.4, FR-U2.6 · **NFR:** NFR-1, NFR-2, NFR-3  
**Sizing note (Q5=A):** First Bolt / vertical slice — honest multi-day; not a 1–2 day UI-only story.

As a novice engineer,  
I want to open the Docs Shell in the extension and read a page from the TOC,  
so that I can learn without leaving the IDE or going online.

**Acceptance (GWT):**
- Given the extension is running with snapshot content (US-01)  
  When I open Docs Shell  
  Then the header shows **locale control** and `sourceVersion` from the manifest  
  And a TOC (nav) lists pages and selecting an entry renders the body in **main**  
- When I load a known path via the content API  
  Then the body is served from `/api/official-docs/:locale/*`  
  And `/api/guides` and `/api/docs-settings` remain distinct (no collision)  
  And body bytes come from the bundled tree (no runtime fetch of official upstream URLs — NFR-1)  
- Given a path that escapes the locale content root  
  When content load runs  
  Then `guardPath` (or equivalent) rejects it  
  And that negative case is covered under `bun run check` (NFR-2)  
- And the locale resolver / content-load module meets **95% branch coverage** (NFR-3).

**Deps:** US-01.  
**NFR-7 (Should a11y):** keyboard TOC→body + landmarks — detail in refined-mockups / NFR stage; not blocking this GWT.

### US-03 — Switch locale keeping path; fallback anchor  
**Epic:** E2 · **Persona:** P1 · **FR:** FR-U2.3

As a novice engineer,  
I want to switch en↔ja on the same page,  
so that I can keep reading without losing my place when possible.

**Acceptance (GWT):**
- Given I am on `/guide/foo#section` in locale=en  
  When I switch to ja and the ja page exists with `#section`  
  Then I stay on the same path  
  And the viewport/focus moves to that heading  
  And the locale control remains visibly on ja  
- When `#section` is missing on ja  
  Then I open the same path at page top  
  And the locale control stays on ja.

**Deps:** US-02.

### US-04 — Untranslated page notice  
**Epic:** E2 · **Persona:** P1 · **FR:** FR-U2.5 · **NFR:** NFR-7 (notice)

As a novice engineer,  
I want a clear notice when Japanese is missing for a page,  
so that I understand why I see English while ja is selected.

**Acceptance (GWT):**
- Given locale=ja and no ja file for the path  
  When the page loads  
  Then English body is shown in main  
  And a visible notice in main states translation is missing (not color-only)  
  And the notice is exposed to assistive tech (`role="status"` or equivalent live region)  
  And the locale control remains on ja.

**Deps:** US-02.

### US-05 — Deep link from StageCard  
**Epic:** E3 · **Persona:** P2 · **FR:** FR-U3.1–U3.3

As a driver,  
I want a StageCard link that opens related official docs in the extension,  
so that I can explain the current stage without a browser.

**Acceptance (GWT):**
- Given Dashboard shows a mapped stage  
  When I activate the docs link  
  Then the label is not the bare string `Docs` alone (e.g. `Docs: Intent Capture` is OK)  
  And the host issues an openOfficialDoc-style command/postMessage with `{locale, path, anchor?}`  
  And `locale` is last-used preference if set, otherwise default `en`  
  And Docs Shell opens that path without an external browser  
  And if `anchor` is present and exists, main scrolls/focuses that heading; if absent, page top  
- Given the static stage→docs map  
  When I inspect it  
  Then each of these slugs resolves to a non-empty `path` (+ optional `anchor`):  
  `intent-capture`, `feasibility`, `scope-definition`, `rough-mockups`, `reverse-engineering`, `practices-discovery`, `requirements-analysis`  
- Given an unmapped stage  
  When I activate the link  
  Then Docs Shell opens at top.

**Deps:** US-02.  
**Open:** final command/message type string → Functional Design.

### US-06 — Bridge redirects to bundled docs  
**Epic:** E4 · **Persona:** P1 · **FR:** FR-U4.1, FR-U4.2

As a novice engineer,  
I want the old excerpt UI to send me to bundled Docs,  
so that I always read the canonical body in one place.

**Acceptance (GWT):**
- Given I open the legacy Bridge excerpt surface  
  When it renders  
  Then excerpt markdown is **not** mounted as the main article body  
  And an “Open in Docs” (or equivalent) control is the default/primary activation into Docs Shell  
  And optional short non-canonical note (e.g. “Full docs are bundled.”) may appear; glossary/nav aids stay on US-09.

**Deps:** US-02.

### US-07 — Bootstrap ja + ongoing translate PRs  
**Epic:** E5 · **Persona:** P3 · **FR:** FR-U5.1, FR-U5.2

As a documentation maintainer,  
I want at least one ja page shipped and later updates only via reviewable PRs,  
so that learners get Japanese without an auto-MT pipeline.

**Acceptance (GWT):**
- Given bootstrap is done  
  When I open locale=ja on that page  
  Then US-02 rendering succeeds for ≥1 page under `docs/guide/ja/` or `docs/reference/ja/`.

**Constraints / verification (not runtime GWT):**
- Later ja changes land via PR touching `docs/**/ja/**` (or equivalent) for human review (FR-U5.1).
- No continuous auto-publish MT pipeline (Out of Scope / O1) — process check at delivery, not a Vitest absence assert.

**Deps:** US-01, US-02.

---

## Should Have

### US-08 — Upstream diff report  
**Epic:** E6 · **Persona:** P3 · **FR:** FR-U6.1 · **Priority:** Should

As a documentation maintainer,  
I want a diff report when upstream docs change,  
so that I know what to translate next.

**Acceptance (checklist):**
- [ ] Report can be generated from upstream vs current snapshot  
- [ ] Output is usable as input to a translate PR (US-07)  
- [ ] May be cut without blocking S-docs-1  

**Deps:** US-01, US-07.  
**Open:** report format → Functional Design.

### US-09 — Keep bridge-map as nav/glossary aid  
**Epic:** E4b · **Persona:** P1 · **FR:** FR-U4.3 · **Priority:** Should

As a novice engineer,  
I want short glossary/nav hints from bridge-map where useful,  
so that I still get local learner cues without treating excerpts as canonical.

**Acceptance (checklist):**
- [ ] bridge-map may power nav/glossary aids  
- [ ] Does not reintroduce excerpt-as-canonical body (negative: US-06 still holds)  
- [ ] Cuttable independently of US-06  

---

## Could / Won’t

| ID | Note |
|----|------|
| Could | Full ja parity for every en page |
| Won’t | Auto-MT pipeline, separate CMS, cloud docs host, browser-only Dashboard path |

## Dependency Graph

```text
US-01 → US-02 (Bolt/skeleton) → US-03, US-04, US-05, US-06
US-01 + US-02 → US-07 → US-08 (Should)
US-06 ⊥ US-09 (Should; independent cut)
```

## Mob integration triage (Round 1)

| Objection | Source | Disposition |
|-----------|--------|-------------|
| US-02 chrome under-specified | design | **Accepted** — header locale + TOC/main in GWT |
| US-03/04 focus + status region | design | **Accepted** |
| US-05 landing focus with anchor | design | **Accepted** |
| FR-U2.6 missing from stories | developer, quality | **Accepted** — Then under US-02 |
| US-02 INVEST-Small / sizing | developer | **Accepted** — mark as walking skeleton Bolt (no split) |
| US-01 tree vs `docs/guides/` | developer, quality | **Accepted** |
| US-05 slug matrix + locale source | developer, quality | **Accepted** — seven slugs enumerated; locale = preference \|\| `en` |
| NFR-1/2/3 technical AC | developer, quality | **Accepted** — on US-02 |
| US-07 no-MT as GWT | developer, quality | **Accepted** — demoted to Constraints |
| US-06 “primary” oracle | quality | **Accepted** — not-mounted + default activation |
| Split US-02 into API vs UI | developer option (b) | **Deferred** — sizing note preferred over story sprawl |
| Full NFR-7 keyboard on US-02 | design/quality | **Deferred** to refined-mockups / NFR (Should) |

---

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY  
**Date:** 2026-07-31

### What holds

**Mob integration is substantive, not cosmetic.** Every developer and quality OBJECT from Round 1 is traceable to a concrete Then in the final stories:

| Objection | Resolved evidence |
|-----------|-------------------|
| FR-U2.6 absent from stories | US-02 `Then` names `/api/official-docs/:locale/*` and asserts no collision with `/api/guides` / `/api/docs-settings` |
| US-01 tree vs `docs/guides/` | US-01 `Then` explicitly excludes product `docs/guides/` root |
| US-02 chrome under-specified | US-02 `Then` requires header locale control + `sourceVersion` + TOC nav + body in `main` |
| US-03/04 focus + status region | US-03 `viewport/focus moves to that heading`; US-04 `role="status"` or equivalent live region |
| US-05 slug matrix by reference only | Seven slugs enumerated verbatim in US-05 `Then` block |
| US-05 locale source | `locale = last-used preference if set, otherwise default en` stated in GWT |
| NFR-1 offline oracle weak | US-02 `Then` states "body bytes come from the bundled tree (no runtime fetch of official upstream URLs)" — spy/intercept-assertable |
| NFR-2 containment negative test | US-02 `guardPath (or equivalent) rejects` escape path + `bun run check` hook named |
| NFR-3 coverage floor | US-02 `Then` names 95% branch coverage on locale resolver / content-load module |
| US-07 no-MT as GWT | Demoted to Constraints / verification note — bootstrap (≥1 ja page renderable) is the product GWT |
| US-06 "primary" oracle | Not-mounted + default/primary activation stated; not visual-hierarchy language |
| US-02 INVEST sizing | Explicitly marked walking skeleton Bolt, multi-day honest |

**Q1 — Would a developer know what to build?**  
Yes for all seven Must stories. US-01 names file roots, manifest schema, and the `docs/guides/` exclusion. US-02 is large but intentionally the vertical skeleton; TOC/body/header layout, API route, NFR guards all named. US-03/US-04/US-06 are INVEST-thin. US-05 gives payload shape, label rule, seven-slug matrix, locale source, and fallback. US-07 gives a testable bootstrap floor plus an explicit constraint for the no-MT rule.

**Q2 — Could QA write tests from these ACs?**  
Yes for every Must story. File-tree + manifest field asserts (US-01). Route serving + collision check + network spy + path traversal + coverage threshold (US-02). Three-branch anchor matrix (US-03). ARIA live region + en body + locale=ja sticky (US-04). Slug matrix + payload shape + preference/default locale + anchor scroll (US-05). Not-mounted + CTA role assert (US-06). ≥1 ja page render via US-02 path (US-07).

**Q3 — Is anything implied but never stated?**  
One narrow case: US-05 states "if `anchor` is present **and exists**, main scrolls/focuses that heading; if **absent**, page top" — where "absent" refers to the anchor being missing from the payload. The edge case of anchor present in payload but not found on target page is not explicitly specified. However, US-03 defines identical behavior for this scenario (locale-switch case: `#section` missing → page top, locale control stays). A developer has the rule from US-03; they will not need to return with a blocking question. QA can reference US-03 as the precedent. Low-severity, non-blocking.

**Q4 — Does every item deliver user or business value?**  
Yes. US-01–US-07 each trace to an FR. US-08/US-09 are correctly Should with cuttability noted. No gold-plating, no scope creep visible.

**Q5 — Are boundaries clear?**  
In/out/deferred is explicit. NFR-5 VSIX size, diff-report format, and `openOfficialDoc` command-name string are correctly deferred to NFR stage / Functional Design. Could/Won't table covers full ja parity, auto-MT, CMS, cloud host.

### Findings (non-blocking observations)

1. **US-05 anchor-present-but-not-found** (not in triage): The AC covers `anchor` present+exists → scroll, and absent from payload → top. If anchor is present in payload but the heading does not exist on the target page, behavior is not stated. US-03 provides clear analogous precedent (same anchor, different locale, missing → page top). Recommend a one-line clarification in Units Generation; does not block engineering start.

2. **US-02 `guardPath` "rejects" is not resolution-typed**: Any rejection (404, thrown error, empty body) satisfies NFR-2's intent. For testability, Units Generation should pick one observable response. Not blocking — any rejection is an improvement over no guard.

3. **NFR-4 / NFR-6 not voiced in story ACs**: Cross-platform path/startup (NFR-4) and VSIX package hygiene (NFR-6) are not in any story GWT. These are Build-and-Test / CI Pipeline concerns, not user-story behaviors. No action needed here.

**Engineering and Units Generation can start from these stories without returning with blocking questions.**
