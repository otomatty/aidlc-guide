# Refined Mockups — Docs i18n Bolt 2

> ステージ: refined-mockups / 2026-08-01  
> 計画: Q1–Q8 = A/E（推奨・Looks correct）  
> 上流: [wireframes.md](../../ideation/rough-mockups/wireframes.md) · [user-flow.md](../../ideation/rough-mockups/user-flow.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md)  
> 忠実度: mid — 既存 Docs Shell 上の構造・状態・フォーカス。新規画面なし。拡張 Webview のみ（NFR-B2-3）。

## Story → Screen Map

| Story | Screen / state | FR / NFR |
|-------|----------------|----------|
| US-B2-01 | **RM-B2-1** keep-path + anchor | FR-B2-1, FR-B2-3, NFR-B2-3 |
| US-B2-02 | **RM-B2-2** missing_ja notice | FR-B2-2, FR-B2-4, NFR-B2-3 |
| US-B2-03 | —（CI / 手動記録・画面なし） | NFR-B2-1, FR-B2-5 |
| US-B2-S1 | **RM-B2-S1** h1（Should） | FR-B2-S1 |

親 intent の深リンク / Bridge（RM3–RM5）は **本 Bolt 対象外**（Won't / O1–O2）。

---

## RM-B2-0 — Docs Shell ベース（既存）

```text
┌─ header (landmark) ─────────────────────────────────────────────┐
│ AIDLC Docs    Locale: [en] [ja*]    sourceVersion: <manifest>   │
│               * = aria-current / pressed on active              │
├─ nav (TOC) ──────────────┬─ main ───────────────────────────────┤
│ Guide                    │ # <h1 page title>                    │
│  · …                sel  │                                      │
│ Reference                │ <markdown body>                      │
│  · …                     │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

**Surface:** VS Code / Cursor extension Docs Shell only.  
**DS:** 既存 dashboard / Docs Shell コンポーネント踏襲（Q5 = A）。新規ブレークポイントなし（Q7 = A）。

---

## RM-B2-1 — Locale keep-path + anchor（US-B2-01）

```text
Before: locale=en  path=P  #section in view
Action: activate [ja]
After:
  path stays P
  locale control stays/shows ja (localeRequested)
  if heading exists → anchorApplied=scrolled → focus/scroll heading
  if heading missing → anchorApplied=top → focus/scroll h1 (main top)
  if ja file missing → path still P; body/notice per RM-B2-2
  TOC: highlight P if present in current TOC; else no selection (body still P)
  search / transient UI: not required to persist (FR-B2-1.4)
```

**Focus (Q3 = A):** never return focus to locale control after switch.

---

## RM-B2-2 — Untranslated notice（US-B2-02）

```text
locale control: ja  (aria-current)
main:
  # <h1 title from en body>
  ┌─ role=status  (static; no dismiss) ──────────────────────────┐
  │ 日本語訳がありません                                           │
  │ このページはまだ日本語に翻訳されていないため、英語版を表示…      │
  └──────────────────────────────────────────────────────────────┘
  <en body markdown>
```

**Placement (Q1 = A):** `main` 内・h1 直下（実装は title→notice→body でも可。wireframes「本文直下」と同等に main 先頭の status）。TOC 未訳印は出さない。  
**Dismiss (Q2 = A):** 閉じられない静的バナー。  
**Wire:** UI は `OfficialDocsPage.notice === "missing_ja"` のみで表示。色だけに依存しない。

---

## RM-B2-S1 — Page title as h1（Should）

```text
main first heading = h1 (page title)
```

Must Fail にしない（Q8 = A）。a11y checklist に Should 行として記載。

---

## States overview（Q4 = E）

| State | UI |
|-------|-----|
| loading | main に取得中表示；locale コントロール操作可能でもよい |
| ready | 本文表示；notice なし |
| missing_ja | RM-B2-2 |
| not_found | 既存エラー表示を継承（en にも無い path） |

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY  
**Date:** 2026-08-01

### What holds

**Q1–Q8 alignment:** Notice placement (main, below h1, no TOC badge), static non-dismiss banner, post-switch focus rules, all four shell states, existing DS/breakpoints, scoped WCAG AA, and Should h1 treatment all match consolidated Q&A.

**Story → screen traceability:** US-B2-01 → RM-B2-1 (keep-path + anchor + FR-B2-1.4); US-B2-02 → RM-B2-2 (notice + wire); US-B2-03 → no screen (CI/manual); US-B2-S1 → RM-B2-S1 (Should, non-fail). Parent RM3–RM5 / deep-link / Bridge explicitly out of scope.

**Surface & scope:** Extension Docs Shell only (NFR-B2-3). No new screens; mid-fi ASCII sufficient for locale/notice/anchor deltas on existing W1.

**States (Q4 = E):** loading, ready, missing_ja, not_found documented; inherited states correctly defer to existing Shell behavior.

### Residual observations (non-blocking)

- missing_ja + `#anchor` combined load not diagrammed here; governed by US-B2-02 wire AC + RM-B2-1 cross-ref.
- Notice final copy deferred per requirements A3.

**Engineering can start without returning with questions.**
