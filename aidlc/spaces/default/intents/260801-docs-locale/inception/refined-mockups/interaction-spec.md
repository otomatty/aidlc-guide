# Interaction Spec — Docs i18n Bolt 2

> ステージ: refined-mockups / 2026-08-01  
> 上流: [mockups.md](./mockups.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md) · [wireframes.md](../../ideation/rough-mockups/wireframes.md) · [user-flow.md](../../ideation/rough-mockups/user-flow.md)  
> 形式: component-spec-template に準拠

## Shell states

| State | Trigger | UI |
|-------|---------|-----|
| loading | `/api/official-docs` 取得中 | main: loading；TOC/locale は前回状態を保持可 |
| ready | 200 + no `notice` | 本文表示 |
| missing_ja | `notice === "missing_ja"` | RM-B2-2 |
| not_found | path が両 locale で不在 / path_rejected | 既存エラー |

---

## LocaleControl

| Field | Value |
|---|---|
| Component | LocaleControl |
| Description | en / ja 切替。ユーザー選択（localeRequested）を表示 |
| Category | navigation / input |

### States

| State | Description | Trigger |
|---|---|---|
| default | 非選択 locale ボタン | idle |
| current | 選択中 locale（`aria-current` / pressed） | localeRequested 一致 |
| focus | キーボードフォーカス | Tab |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| locale | `"en" \| "ja"` | yes | — | 表示中のユーザー選択 |
| onChange | `(locale) => void` | yes | — | 切替。keep-path で同一 path を再取得 |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA | `radiogroup` または pressed `button` 群 |
| Keyboard | Tab でフォーカス；Enter/Space で切替 |
| Label | 可視「en」「ja」；現在値を `aria-current` |
| Focus after switch | 見出し or h1（Q3 = A）。コントロールには戻さない |
| Contrast | WCAG AA |

### Behaviour notes

- `localeServed=en` でもコントロールは `localeRequested=ja` を示す（FR-B2-2.4）
- 切替後 path 不変（FR-B2-1.1）

---

## UntranslatedNotice

| Field | Value |
|---|---|
| Component | UntranslatedNotice |
| Description | ja 欠落時に en 本文である旨を伝える |
| Category | feedback |

### States

| State | Description | Trigger |
|---|---|---|
| hidden | 描画なし | `notice` なし / ≠ missing_ja |
| visible | 静的バナー | `notice === "missing_ja"` |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| notice | `"missing_ja" \| undefined` | yes | — | wire フィールドのみ |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `role="status"`（live region） |
| Keyboard | フォーカス可能である必要なし（静的） |
| Contrast | テキスト＋背景 AA；色のみに依存しない |
| Screen reader | status でタイトル＋説明を読み上げ |
| Dismiss | なし（Q2 = A） |

### Placement

`main` 内・ページタイトル（h1）直下（Q1 = A）。

---

## AnchorFocus

| Field | Value |
|---|---|
| Component | AnchorFocus（behaviour） |
| Description | `anchorApplied` に応じたスクロール／フォーカス |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| none | アンカーなし | `anchorApplied=none` |
| scrolled | 見出しへ | `anchorApplied=scrolled` |
| top | ページ先頭（h1） | `anchorApplied=top` |

### Behaviour

| `anchorApplied` | Action |
|---|---|
| scrolled | 該当見出しへ scrollIntoView + focus（tabIndex=-1 可） |
| top | h1（または main 先頭）へ |
| none | 追加フォーカス移動なし（初回表示は既存どおり） |

---

## TocSelection

| Field | Value |
|---|---|
| Component | OfficialDocsToc |
| Description | 現 path のハイライト |
| Category | navigation |

### Behaviour

| Case | Action |
|---|---|
| 両 TOC に path あり | 選択維持（FR-B2-1.2） |
| 現 TOC にのみあり | その項目を選択 |
| 現 TOC になし | 選択なし；本文 path は維持（FR-B2-1.3） |

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY — see mockups Review for Q1–Q8 and scope rationale.  
**Date:** 2026-08-01

**What holds:** Component-level specs (LocaleControl, UntranslatedNotice, AnchorFocus, TocSelection) are state/trigger-testable; FR-B2-1.1–1.3, FR-B2-2.4, FR-B2-3.1–3.2 referenced; dismiss absent per Q2; focus-after-switch per Q3.

**Residual (non-blocking):** FR-B2-3.3 locale persistence after anchor fallback implied via LocaleControl + upstream stories, not a separate AnchorFocus AC line.
