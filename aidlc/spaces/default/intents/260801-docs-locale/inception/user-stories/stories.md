# User Stories — Docs i18n Bolt 2

> ステージ: user-stories (Inception 2.4) / 作成日: 2026-08-01  
> Intent: `260801-docs-locale`  
> 計画: Q2=C（親 intent の US-03/US-04 を実装詳細に分解）/ Q3=A（Must=全ストーリー）/ Q4=C（GWT 基本）/ Q5=A（INVEST）  
> 根拠: [requirements.md](../requirements-analysis/requirements.md)（product-lead READY 改訂版）  
> 親 intent: `260730-docs-i18n`（US-03 / US-04 の契約を継承）  
> 改訂: gate Reject — FR 参照を改訂 requirements に整合（2nd pass: FR-B2-5.2 / NFR-B2-3 / FR-B2-1.4）

## Epics（FR 対応）

| Epic | FR / NFR | Priority |
|------|----------|----------|
| E2 Reader + i18n | FR-B2-1, FR-B2-2, FR-B2-3, FR-B2-4 | Must |
| E2b Coverage + verify | NFR-B2-1, FR-B2-5, NFR-B2-3 | Must |
| E2c a11y polish | FR-B2-S1 | Should |

---

## Must Have

### US-B2-01 — Switch locale keeping path; fallback anchor  
**Epic:** E2 · **Persona:** P1 · **FR:** FR-B2-1.1, FR-B2-1.2, FR-B2-1.3, FR-B2-1.4, FR-B2-3.1, FR-B2-3.2, FR-B2-3.3 · **NFR:** NFR-B2-3

親 intent US-03 を実装詳細に分解。

As a novice engineer,  
I want to switch en↔ja on the same page,  
so that I can keep reading without losing my place when possible.

**Acceptance (GWT):**
- Given I am in the **VS Code / Cursor extension Docs Shell** on path `P` with `#section` in locale=en  
  When I switch to ja and the ja page exists with `#section`  
  Then the view path remains `P`  
  And `anchorApplied` is `scrolled` (viewport/focus moves to that heading)  
  And the locale control remains visibly on ja (`localeRequested=ja`)
- Given I am in the extension Docs Shell on path `P` with `#section` in locale=en  
  When I switch to ja and `#section` is missing on the served body  
  Then the view path remains `P`  
  And `anchorApplied` is `top` (page top)  
  And the locale control stays on ja
- Given I am in the extension Docs Shell on path `P` and both locale TOCs contain `P`  
  When I switch to ja  
  Then TOC selection remains on `P`
- Given I am in the extension Docs Shell on path `P` and only one locale TOC contains `P`  
  When I switch locale  
  Then the body path remains `P`  
  And TOC highlights `P` only if it exists in the current TOC (otherwise no TOC selection)
- Given I am in the extension Docs Shell on path `P` in locale=en  
  When I switch to ja and the ja file is missing  
  Then the view path remains `P` (keep-path does not require target-locale file existence; untranslated behavior is US-B2-02)
- Given I am in the extension Docs Shell on path `P` with an active search query or other transient UI state  
  When I switch locale  
  Then the path remains `P`  
  And persistence of search/transient UI state is **not required** (no Fail if that state resets) — FR-B2-1.4

**INVEST:** Independent of other stories; Valuable; Testable via path/anchor/TOC assertions on the extension surface.  
**Deps:** Bolt 1（US-02）で Docs Shell が存在すること。  
**Surface:** Extension Docs Shell only (NFR-B2-3). Browser / Mob LAN failures do not Fail this story.

### US-B2-02 — Untranslated page notice  
**Epic:** E2 · **Persona:** P1 · **FR:** FR-B2-2.1, FR-B2-2.2, FR-B2-2.3, FR-B2-2.4, FR-B2-2.5, FR-B2-4.1, FR-B2-4.2, FR-B2-4.3 · **NFR:** NFR-B2-3

親 intent US-04 を実装詳細に分解。

As a novice engineer,  
I want a clear notice when Japanese is missing for a page,  
so that I understand why I see English while ja is selected.

**Acceptance (GWT):**
- Given I am in the **VS Code / Cursor extension Docs Shell** with locale=ja and no ja file for path `P`  
  When the page loads  
  Then English body is shown in main (`localeServed=en`)  
  And a visible notice in main states translation is missing (not color-only)  
  And the notice is exposed to assistive tech (`role="status"` or equivalent live region)  
  And the locale control remains on ja (`localeRequested=ja`)
- Given the same missing-ja case  
  When I inspect the `/api/official-docs` (or equivalent) response  
  Then it is an `OfficialDocsPage` with:  
  - `notice: "missing_ja"`  
  - `localeRequested: "ja"`, `localeServed: "en"`  
  - `path` equal to `P`  
  - `bodyMarkdown` from the en tree  
  - `sourceVersion` present (non-empty string when manifest exists)  
  - `anchorApplied` consistent with the requested fragment (`none` / `scrolled` / `top`)  
  And the UI derives the notice only from `notice === "missing_ja"` (no 404 inference)  
  And Bolt 2 does not rename `notice` to another field (FR-B2-4.3)
- Given missing-ja notice is shown and the UI offers dismiss  
  When I dismiss and revisit the same path in the same session  
  Then the notice may reappear (dismiss persistence not required) — FR-B2-2.5  
  (If no dismiss control exists, this AC is vacuously satisfied by a static banner.)

**INVEST:** Independent; Valuable; Testable via DOM/ARIA + wire-field assertions.  
**Deps:** Bolt 1（US-02）で Docs Shell が存在すること。  
**Surface:** Extension Docs Shell only (NFR-B2-3).

### US-B2-03 — Coverage floor + verification gate  
**Epic:** E2b · **Persona:** P3 · **FR/NFR:** NFR-B2-1, FR-B2-5.1, FR-B2-5.2, NFR-B2-3

As a documentation maintainer,  
I want official-docs locale resolution to meet branch coverage 95% and Bolt 2 scenarios verified,  
so that missing_ja / anchor branches stay protected and the extension path is proven.

**Acceptance (GWT):**
- Given coverage is configured for `packages/official-docs/src/resolve.ts`, `roots.ts`, and `markdown.ts`  
  When I run `bun run check`  
  Then branch coverage for those modules is measured  
  And if coverage is below 95%, `bun run check` fails (NFR-B2-1 / FR-B2-5.1)
- Given missing_ja / anchor branch tests exist  
  When I run `bun run check`  
  Then those tests run as part of the same gate
- Given the **VS Code / Cursor extension Docs Shell**  
  When I manually run keep-path, missing-ja notice, and missing-anchor scenarios  
  Then a PR description or stage artifact records pass/fail for each scenario (screenshots optional) — FR-B2-5.2

**INVEST:** Independent; Valuable; Testable via coverage report / check failure + verification record.  
**Deps:** US-B2-01, US-B2-02（テスト対象のコードが存在すること）。

---

## Should Have

### US-B2-S1 — Page title as h1  
**Epic:** E2c · **Persona:** P1 · **FR:** FR-B2-S1

As a novice engineer,  
I want the page title exposed as a proper heading,  
so that assistive tech and outline navigation find the main title.

**Acceptance (GWT):**
- Given I open any official docs page in the extension Docs Shell  
  When the body renders  
  Then the page title is marked up as `h1` (or ARIA equivalent)  
- Failure of this story does **not** Fail Bolt 2 Must (Should only)

**INVEST:** Independent; Valuable; Testable per opened page.  
**Deps:** Docs Shell body renderer.

## Could / Won't

| ID | Note |
|----|------|
| Could | 未訳 notice の文言・デザインのブラッシュアップ |
| Won't | 深リンク → B3 / #29、Bridge 縮退 → B4 / #30、差分レポート → B5 / #31、live sync → #33 |
| Inherited (not story AC) | **NFR-B2-2**（実行時 fetch なし）は親 NFR-1 / 既存 architecture で担保。Construction の回帰で確認。user-story AC には落とさない |

## Dependency Graph

```text
Bolt 1 (US-02) → US-B2-01, US-B2-02 → US-B2-03
                 US-B2-S1 (Should, independent)
```

## Mob integration triage（Round 1）

（mob 未実施 — 本 intent は実装 polish のため、親 intent の mob 結果を継承）

---

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY  
**Date:** 2026-08-01

### What holds

**2nd-revision remediation (F1–F5):** All prior NOT-READY findings closed. FR-B2-5.2 manual verification with PR/artifact record is on US-B2-03. NFR-B2-3 anchors Must stories to VS Code / Cursor extension Docs Shell. FR-B2-1.4 negative scope (search/transient UI) has explicit GWT. NFR-B2-2 deferred in Could/Won't as inherited parent NFR-1. US-B2-02 wire AC asserts full `OfficialDocsPage` field set per FR-B2-4.1 plus FR-B2-4.3 no-rename guard.

**Must FR/NFR coverage:** Every Must FR-B2.* and NFR-B2.* requirement traces to at least one testable story AC or explicit inherited deferral. No stale IDs; wire contract uses `notice: "missing_ja"`. NFR-B2-1 file list (`resolve.ts`, `roots.ts`, `markdown.ts`) is named in US-B2-03.

**US-B2-01 (keep-path + anchor):** Six GWT cases cover symmetric TOC, asymmetric TOC, missing-ja path retention, anchor scrolled/top, locale persistence, and FR-B2-1.4 out-of-scope UI state. Extension surface explicit.

**US-B2-02 (missing-ja):** DOM + a11y + full wire assertions; UI derives notice from `notice === "missing_ja"` only. FR-B2-2.5 dismiss AC is conditional and vacuously satisfied for static banner.

**US-B2-03 (verification gate):** Automated coverage floor and branch tests via `bun run check`; manual extension scenarios with recorded pass/fail complete FR-B2-5.2.

**Scope:** B3–B5 / #33 remain in Won't. US-B2-S1 correctly scoped as Should with non-fail note.

### Residual observations (non-blocking)

- Notice final copy deferred to implementation (requirements A3).
- NFR-B2-1 coverage config key naming deferred to Construction ci-pipeline / build-and-test.

**Engineering can start without returning with questions.**
