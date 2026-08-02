# Accessibility Checklist — Docs i18n Bolt 2

> ステージ: refined-mockups / 2026-08-01  
> 目標: Q6 = A — WCAG 2.1 AA の**該当箇所**（live region・フォーカス・色非依存）。完全適合監査は後段可。  
> 上流: [mockups.md](./mockups.md) · [interaction-spec.md](./interaction-spec.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md) · [wireframes.md](../../ideation/rough-mockups/wireframes.md)

## Must（Bolt 2）

| ID | Criterion | Trace | Verify |
|----|-----------|-------|--------|
| A11y-B2-1 | Untranslated notice は `role="status"`（または同等 live region） | FR-B2-2.3 / US-B2-02 | DOM / a11y tree |
| A11y-B2-2 | Notice は色だけに依存しない（テキストあり） | FR-B2-2.2 / project 三重表現 | 視覚確認 |
| A11y-B2-3 | missing_ja 時も locale コントロールは `ja`（localeRequested）を示す | FR-B2-2.4 | UI assert |
| A11y-B2-4 | `anchorApplied=scrolled` → 見出しへフォーカス／スクロール | FR-B2-3.1 / Q3 | キーボード＋SR |
| A11y-B2-5 | `anchorApplied=top` → h1 / main 先頭へフォーカス／スクロール | FR-B2-3.2 / Q3 | 同上 |
| A11y-B2-6 | Landmarks: header / nav / main を維持 | wireframes W1 | 構造確認 |
| A11y-B2-7 | Locale コントロールに現在値が可視＋プログラム的に示される | FR-B2-2.4 | `aria-current` 等 |
| A11y-B2-8 | 受入は拡張 Docs Shell 上で実施 | NFR-B2-3 | 手動シナリオ |

## Should

| ID | Criterion | Trace | Verify |
|----|-----------|-------|--------|
| A11y-B2-S1 | 表示中ページタイトルが `h1`（または ARIA 同等） | FR-B2-S1 / US-B2-S1 / Q8 | 任意ページで確認。Must Fail にしない |

## Out of scope this Bolt

- WCAG 2.1 AA 全ページ完全適合監査
- TOC 未訳印の a11y
- ブラウザ / Mob LAN 経路

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY — see mockups Review.  
**Date:** 2026-08-01

**What holds:** Must rows A11y-B2-1–8 each trace to FR/US and name a Verify method QA can execute; Should A11y-B2-S1 correctly non-fail per Q8; out-of-scope list matches Bolt 2 boundary.
