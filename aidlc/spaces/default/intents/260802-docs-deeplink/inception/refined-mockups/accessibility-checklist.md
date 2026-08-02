# Accessibility Checklist — Docs i18n Bolt 3

> ステージ: refined-mockups / 2026-08-02  
> 目標: Q5 = A — WCAG 2.1 AA の**該当箇所**（キーボード活性化・着地フォーカス・色非依存ラベル）。完全適合監査は後段可。  
> 上流: [mockups.md](./mockups.md) · [interaction-spec.md](./interaction-spec.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md) · [wireframes.md](../../ideation/rough-mockups/wireframes.md) · [user-flow.md](../../ideation/rough-mockups/user-flow.md)

## Must（Bolt 3）

| ID | Criterion | Trace | Verify |
|----|-----------|-------|--------|
| A11y-B3-1 | OpenOfficialDocLink は Tab で到達し Enter/Space で活性化 | US-B3-01 / W1a | キーボード |
| A11y-B3-2 | Accessible name にステージ名を含み、正確に `Docs` のみではない | FR-B3-2.1 / US-B3-02 / Q1 | a11y tree |
| A11y-B3-3 | ラベルは色だけに依存しない | W1a / project 三重表現 | 視覚確認 |
| A11y-B3-4 | Mapped land: `anchor` ヒット時は該当見出しへフォーカス／スクロール | FR-B3-4.2 / Q2 | キーボード＋SR |
| A11y-B3-5 | Mapped top / unmapped top: フォーカスは page `h1` または `main` | US-B3-01/03 / Q2 | 同上 |
| A11y-B3-6 | 着地後フォーカスを locale コントロールに戻さない | Q2=A | キーボード |
| A11y-B3-7 | Docs Shell landmarks（header / nav / main）を維持 | W2 / W2a | 構造確認 |
| A11y-B3-8 | 受入は拡張 Webview 上で実施 | NFR-B3-2 / Q6 | 手動デモ |

## Out of scope this Bolt

- WCAG 2.1 AA 全ページ完全適合監査  
- Bridge / missing_ja notice a11y（Bolt 2 済み）  
- ブラウザ Dashboard 経路

## Product note（inline support）

Story coverage of Flow A success (intent-capture StageCard → Shell) is the demo oracle for A11y-B3-1/4/5/8 together with US-B3-06 demo-record.

## Review

**Reviewer:** aidlc-product-lead-agent  
**Date:** 2026-08-02  
**See:** mockups.md `## Review` for full verdict (NOT-READY).

**Checklist assessment:** A11y-B3-1 through A11y-B3-8 are well-formed, traceable, and verifiable. No findings in this artifact. The single overall NOT-READY trigger (F1 — activating state visual undefined in interaction-spec) has no a11y dimension; once F1/F2 are resolved in interaction-spec, this checklist is unaffected.
