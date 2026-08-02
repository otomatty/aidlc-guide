# User Stories — Docs i18n Bolt 3

> ステージ: user-stories (Inception 2.4) / 作成日: 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 計画: Q1=A / Q2=A / Q3=A / Q4=A / Q5=A / Q6=D  
> 根拠: [requirements.md](../requirements-analysis/requirements.md)（FR-B3-1…6 READY）  
> 親: `260730-docs-i18n` **US-05** 契約を継承し実装分解。Bolt 2（`260801-docs-locale`）は完了前提。  
> Mob Round 1 integrated: design / developer / quality（2026-08-02）

## Epics（FR 対応）

| Epic | FR / NFR | Priority |
|------|----------|----------|
| E3 Deep link | FR-B3-1, FR-B3-2, FR-B3-3, FR-B3-4, FR-B3-5 | Must |
| E3b Verify | FR-B3-6, NFR-B3-1, NFR-B3-2, NFR-B3-3 | Must |

入力アーティファクト: [requirements.md](../requirements-analysis/requirements.md)、codekb `business-overview` / `component-inventory`（Dashboard StageCard / Docs Shell / extension host）。

---

## Must Have

### US-B3-01 — StageCard openOfficialDoc（mapped）  
**Epic:** E3 · **Persona:** P2 · **FR:** FR-B3-1.1–1.3, FR-B3-3.1, FR-B3-4.1–4.4 · **NFR:** NFR-B3-1, NFR-B3-2  
**Sizing:** Medium（dashboard emit + extension host handler + Shell locale land）  
親 US-05 の mapped 経路を実装詳細に分解。

As a driver,  
I want activating a mapped StageCard docs link to open that page in the extension Docs Shell,  
so that I can explain the stage without leaving the IDE or opening an external browser.

**Acceptance (GWT):**
- Given the **VS Code / Cursor extension** Dashboard shows a StageCard for a mapped slug (e.g. `intent-capture`)  
  When I activate the docs link (pointer **or** keyboard: Tab to the link, then Enter/Space)  
  Then the host receives an openOfficialDoc-style message whose payload is `{ locale, path, anchor? }` with **non-empty** `path` (string length ≥ 1; empty/`path: ""` is Fail)  
  And `locale` is last-used official-docs preference if set, otherwise `en`  
  And the deep-link target (or equivalent) carries `locale` so Docs Shell sets the locale control and fetches/shows that locale (FR-B3-4.3)  
  And Docs Shell opens with display path = payload.path  
  And `openExternal` / `window.open` / `target=_blank` are **not** invoked (named spy/observable)  
  And no outbound HTTP/`fetch` to remote official-docs URLs is initiated during activation (named network spy; NFR-B3-1)  
  And deep-link is one-shot: after first apply, the pending deep-link target is cleared (no re-apply on re-render)  
  And keyboard focus moves into Docs Shell (heading when scrolled; otherwise page `h1` or `main` landing)
- Given payload includes `anchor` and the heading exists  
  When Shell lands  
  Then viewport/focus moves to that heading  
- Given payload includes `anchor` but the heading is missing  
  When Shell lands  
  Then the page opens at top **and** focus moves to page `h1` or `main`  
- Given payload has no `anchor`  
  When Shell lands  
  Then the page opens at top **and** focus moves to page `h1` or `main`

**Construction pins (Open → Functional Design may name exact APIs):**
- **Map consumption:** `packages/dashboard` must **not** import `@aidlc-guide/official-docs` (dependency-direction). StageCard obtains `STAGE_DOC_MAP` paths via an allowed boundary (host-side resolve, api-core lookup, or shared-types re-export — **not** bridge `doc.deepLink` as the official map).
- **Locale preference:** pin one store for “last-used official-docs locale” (host `globalState` / AppState / equivalent). In-session DocsShell-only `useState` is insufficient if preference must survive reopen unless FD documents that as the chosen surface.
- **Message type / command string:** FR-B3-1.4 → Functional Design.

**INVEST:** Independent of unmapped/label stories; Valuable; Testable via payload + Shell state + spies.  
**Deps:** Bolt 1 Docs Shell + Bolt 2 locale deep-link landing surface.  
**Surface:** Extension only (NFR-B3-2).

### US-B3-02 — StageCard docs label includes stage name  
**Epic:** E3 · **Persona:** P2 · **FR:** FR-B3-2.1  
**Sizing:** Tiny

As a driver,  
I want the StageCard docs link label to include the stage name,  
so that I know which docs I am about to open.

**Acceptance (GWT):**
- Given Dashboard renders a StageCard with a docs link  
  When I inspect the **accessible name** (role/name) of the control  
  Then the name includes the stage display name (e.g. `Docs: Intent Capture`)  
  And the name is **not** exactly the bare string `Docs`

**INVEST:** Independent; Valuable; Testable via accessible-name assertion.  
**Deps:** none (can land with or before US-B3-01 wiring).

### US-B3-03 — Unmapped slug opens Docs Shell at top  
**Epic:** E3 · **Persona:** P2 · **FR:** FR-B3-1.1 (unmapped), FR-B3-3.3  
**Sizing:** Small

As a driver,  
I want an unmapped stage’s docs link to still open Docs Shell at the top,  
so that I am not dropped into a dead or external path.

**Acceptance (GWT):**
- Given Dashboard shows a StageCard whose slug is **not** in the 7-slug map  
  When I activate the docs link  
  Then the host receives a payload with `locale` and **without** `path` or `anchor` keys (omit keys; `path: ""` is **not** unmapped success)  
  And Docs Shell opens in top state (no page selected / selected path empty)  
  And keyboard focus moves to page `h1` or `main` (same target language as US-B3-01 top-land)  
  And `openExternal` / `window.open` / `target=_blank` are not invoked

**INVEST:** Parallelizable AC variant of emit path; Valuable; Testable via payload shape + Shell top.  
**Deps:** Docs Shell open path exists. Map boundary pin same as US-B3-01.

### US-B3-04 — Seven-slug static map (no expansion)  
**Epic:** E3 · **Persona:** P3 · **FR:** FR-B3-3.1, FR-B3-3.2  
**Sizing:** Tiny（既存 `STAGE_DOC_MAP` 回帰ロック）

As a documentation maintainer,  
I want the static stage→docs map to cover exactly the seven agreed slugs,  
so that Bolt 3 does not silently grow scope.

**Acceptance (GWT):**
- Given the static map module (`STAGE_DOC_MAP` or equivalent in `packages/official-docs`)  
  When I inspect it under `bun run check`  
  Then each of these slugs resolves to a non-empty `path` (+ optional `anchor`):  
  `intent-capture`, `feasibility`, `scope-definition`, `rough-mockups`, `reverse-engineering`, `practices-discovery`, `requirements-analysis`  
  And Bolt 3 does not add other slugs to the map set

**INVEST:** Independent; Valuable; Testable via map fixture.  
**Deps:** existing map (no content rewrite required).

### US-B3-05 — Legacy docsOpenHref / IDE open-doc unused on mapped path  
**Epic:** E3 · **Persona:** P2 · **FR:** FR-B3-5.1  
**Sizing:** Tiny（US-B3-01 の negative companion）

As a driver,  
I want mapped StageCard docs activation to use only the openOfficialDoc path,  
so that I never get the old IDE/browser open behavior for mapped stages.

**Acceptance (GWT):**
- Given a mapped StageCard docs link  
  When I activate it  
  Then an openOfficialDoc-style host message **is** emitted  
  And `docsOpenHref` / IDE `open-doc` / equivalent legacy open **is not** invoked (dual-spy)

**INVEST:** Negative twin of US-B3-01; keep separate for check-matrix clarity.  
**Deps:** US-B3-01 wiring.

### US-B3-06 — Verification + demo  
**Epic:** E3b · **Persona:** P3 · **FR:** FR-B3-6.1, FR-B3-6.2 · **NFR:** NFR-B3-3  
**Sizing:** Small

As a documentation maintainer,  
I want map/payload/unmapped→top/label/legacy-off covered under `bun run check` and a recorded demo,  
so that Bolt 3 cannot regress silently.

**Acceptance (GWT):**
- Given the check-gate test matrix below exists  
  When I run `bun run check`  
  Then each row runs as part of the gate and failure turns the check red:

| # | Assertion | Story / FR |
|---|-----------|------------|
| C1 | Seven-slug map key set + non-empty paths | US-B3-04 / FR-B3-3.1–3.2 |
| C2 | Mapped payload: `locale` + non-empty `path` | US-B3-01 / FR-B3-1.1 |
| C3 | Unmapped payload: locale-only; **no** `path`/`anchor` keys; `path: ""` fails | US-B3-03 / FR-B3-1.1 |
| C4 | Unmapped → Shell top state | US-B3-03 / FR-B3-3.3 |
| C5 | Accessible label includes stage name; ≠ `Docs` | US-B3-02 / FR-B3-2.1 |
| C6 | Mapped activate: openOfficialDoc used; legacy open not called | US-B3-05 / FR-B3-5.1 |
| C7 | Mapped activate: no outbound HTTP/`fetch` to remote official-docs URLs | US-B3-01 / NFR-B3-1 |

- Given the extension Dashboard  
  When I manually (or via E2E) activate the **intent-capture** StageCard docs link  
  Then Docs Shell opens on the intent-capture map path  
  And no external browser opened  
  And the demo record file `aidlc/spaces/default/intents/260802-docs-deeplink/construction/docs-navigation/demo-record.md` exists with: date, operator, PASS/FAIL for (1) Shell path matches map (2) no external browser, and optional screenshot link  
  And Construction owner (developer lead for unit `docs-navigation`) writes or updates that file before build-and-test gate  
- And Bolt 3 does **not** introduce a new 95% branch-coverage floor (NFR-B3-3); existing check / Bolt 2 floors remain

**INVEST:** Independent once code exists; Valuable; Testable via check + demo record.  
**Deps:** US-B3-01…05 implemented enough to exercise.  
**Note:** Locale preference / anchor trio / one-shot may be asserted on US-B3-01 unit/integration tests in addition to C1–C7.

---

## Should / Could / Won't

| ID | Note |
|----|------|
| Should | なし（Q3=A — Must 一式） |
| Could | ラベル文言の微調整・a11y 文言ブラッシュアップ |
| Won't | Bridge（B4/#30）、Diff report（B5/#31）、locale keep-path/missing_ja 再実装、7 slug 拡張、runtime fetch |

## Dependency Graph

```text
US-B3-02 (label) ─┐
US-B3-04 (map)   ─┼→ US-B3-01 (mapped open, Medium) → US-B3-05 (legacy off) → US-B3-06 (verify+demo)
US-B3-03 (unmapped) ┘
```

## Traceability

| Story | FR / NFR |
|-------|----------|
| US-B3-01 | FR-B3-1.*, FR-B3-3.1, FR-B3-4.*, NFR-B3-1/2 |
| US-B3-02 | FR-B3-2.1 |
| US-B3-03 | FR-B3-1.1 unmapped, FR-B3-3.3 |
| US-B3-04 | FR-B3-3.1, FR-B3-3.2 |
| US-B3-05 | FR-B3-5.1 |
| US-B3-06 | FR-B3-6.*, NFR-B3-3 |
| Parent US-05 | Inherited via FR-U3 + FR-B3 delta |

## Mob integration notes

| Source | Disposition |
|--------|-------------|
| design: keyboard activate + top/unmapped focus | Folded into US-B3-01 / US-B3-03 GWT |
| developer: map import ban + locale store pin | Construction pins under US-B3-01 |
| developer: US-B3-01 Medium | Sizing annotation added |
| quality: omit-keys unmapped; C5/C6 in check; named spies | Folded into US-B3-03 / US-B3-06 / US-B3-01 |

---

## Review

**Reviewer:** aidlc-product-lead-agent  
**Date:** 2026-08-02 (re-review §12a)  
**Verdict:** READY

### Prior findings — closure status

**F1 — CLOSED.** US-B3-03 GWT now reads "keyboard focus moves to page `h1` or `main` (same target language as US-B3-01 top-land)." Terminology is identical to US-B3-01; QA can write a deterministic assertion.

**F2 — CLOSED.** US-B3-06 demo AC names the exact artifact path (`aidlc/spaces/default/intents/260802-docs-deeplink/construction/docs-navigation/demo-record.md`), specifies required fields (date, operator, PASS/FAIL for two distinct checks, optional screenshot link), and names the owner ("Construction owner — developer lead for unit `docs-navigation`") with a gate deadline (before build-and-test gate).

**F3 — CLOSED.** US-B3-01 GWT now includes "And no outbound HTTP/`fetch` to remote official-docs URLs is initiated during activation (named network spy; NFR-B3-1)." Check matrix row C7 ("Mapped activate: no outbound HTTP/`fetch` to remote official-docs URLs") closes the matrix gap. NFR-B3-1 now has both a GWT clause and a gate row.

### Adversarial sweep — new findings

None. Full FR/NFR traceability verified:

- All FR-B3-1 through FR-B3-6 sub-items trace to a story with testable GWT.
- NFR-B3-1 → US-B3-01 GWT + C7; NFR-B3-2 → US-B3-01 Surface note; NFR-B3-3 → US-B3-06 last bullet.
- C1–C7 check matrix rows map without gaps to story IDs and FR references.
- Deferred items (locale preference, anchor trio, one-shot re-render) are explicitly named in the US-B3-06 note as unit/integration test scope — not silent omissions.
- Won't list protects scope (Bridge B4, Diff B5, locale keep-path, slug expansion, runtime fetch).
- No orphan FRs; no story without a parent FR.

Engineering can start without returning with questions.
