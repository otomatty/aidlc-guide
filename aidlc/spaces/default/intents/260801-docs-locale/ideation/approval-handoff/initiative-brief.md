# Initiative Brief — Docs i18n Bolt 2

> ステージ: approval-handoff (Ideation 1.7) / 作成日: 2026-08-01  
> Intent: `260801-docs-locale`  
> 追跡 Issue: [#28](https://github.com/otomatty/aidlc-guide/issues/28)

## Intent & Problem Statement

Bolt 1（PR #26）で拡張内 Docs Shell・locale 制御・同梱コンテンツの縦スライスは成立したが、**部分 `ja` の状態では切替体験が未完成**。keep-path・未訳 notice・anchor フォールバックの三点を契約として再固定し実装で満たす。

## Market Validation Summary

該当なし — market-research は SKIP（親 intent `260730-docs-i18n` で実施済み）。本 intent は brownfield 延長の実装 polish。

## Feasibility & Risk Highlights

- **Verdict:** Go — 技術・組織・規制のブロッカーなし
- **主要リスク:** R1（locale 維持ロジック複雑化）、R2（a11y 競合）、R3（anchor フォールバック）、R4（coverage 床導入）、R5（scope creep）
- **緩和:** Functional Design で状態遷移明確化、既存 a11y 属性調査、段階的 coverage 導入、intent Q5=E で B3-B5 除外

## Scope Boundary

- **In:** keep-path 切替、missing ja notice（`role=status`）、missing anchor フォールバック、coverage 床
- **Out:** B3 深リンク（#29）、B4 Bridge（#30）、B5 差分レポート（#31）、大規模ツリー追加

## Concept Visuals

- W1/W2: 既存 Docs Shell・locale 切替（Bolt 1 継承）
- W2a: 未訳 notice（`role=status`、locale 維持）
- W2b: anchor フォールバック（ページ先頭へ）

## Team Plan

単独作業想定（team-formation SKIP）。レビューは各ステージゲートで実施。

## Go/No-Go Recommendation

**Go** — Inception へ進む。
