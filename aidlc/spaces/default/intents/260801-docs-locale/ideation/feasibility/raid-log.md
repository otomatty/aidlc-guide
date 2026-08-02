# RAID Log — Docs i18n Bolt 2

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-08-01  
> 根拠: [feasibility-assessment.md](./feasibility-assessment.md) / [constraint-register.md](./constraint-register.md)  
> 入力参照: [intent-statement.md](../intent-capture/intent-statement.md)

## Risks（リスク）

| ID | 内容 | 影響 | 尤度 | 緩和 |
|----|------|------|------|------|
| R1 | 部分 `ja` での locale 維持ロジックが複雑になり、状態管理がバグを生む | keep-path / notice の UX が不安定 | 中 | Functional Design で状態遷移を明確化し、単体テストで網羅 |
| R2 | 未訳 notice の `role=status` が既存 UI の aria-live と競合する | スクリーンリーダーで二重読み上げ | 低〜中 | 既存コンポーネントの a11y 属性を調査し、重複を避ける設計にする |
| R3 | アンカー欠落時のフォールバックが Markdown レンダリングと相性が悪い | ページ先頭へのスクロールが動作しない | 中 | レンダリング後の DOM を基準にアンカー解決を設計する |
| R4 | coverage 床（branch 95%）導入で既存テストが赤くなる | CI がブロックされる | 中 | 床の導入は段階的に行い、既存テストのカバレッジを先に計測する |
| R5 | Bolt 2 の実装中に B3（深リンク）の要求が混入する | スコープクリープ | 低 | intent Q5 = E で明示的に除外し、変更は別 Issue で管理 |

## Assumptions（前提）

| ID | 内容 | 検証タイミング |
|----|------|----------------|
| A1 | 親 intent の locale コード（`en`/`ja`）、同梱ツリー構造、API パスは変更しない | Scope Definition |
| A2 | 未訳/anchor の振る舞いは Functional Design で契約として再固定する（intent Q6 = C） | Functional Design |
| A3 | 公式公開ドキュメントの再配布に特別な法務ブロックはない（Q2=A） | 問題が出たら compliance 再訪 |
| A4 | 機械翻訳の自動同梱は行わない（親 intent）。差分自動 + 翻訳は別 PR | 運用設計（Inception 以降） |
| A5 | aidlc-workflows エンジン／ステージ定義は変更しない（project Forbidden 継承） | 全ステージ |
| A6 | Bolt 1 の実装（packages/official-docs・api-core・dashboard）は brownfield として安定している | Code Generation |

## Issues（顕在課題）

| ID | 内容 | 状態 | オーナー |
|----|------|------|----------|
| I1 | Codex 指摘の Docs Shell `h1` 階層が未対応（intent Q3-E は必須外） | Open | 任意フォローアップまたは別 PR |
| I2 | 未訳 notice の文言・デザインが未定義 | Open | Functional Design / Refined Mockups |

## Dependencies（依存）

| ID | 依存先 | 種類 | 備考 |
|----|--------|------|------|
| D1 | 先行 intent `260730-docs-i18n` の拡張・dashboard 基盤 | 成果物 | brownfield 延長（Q1 = E） |
| D2 | upstream aidlc-workflows の docs ツリー（guide + reference） | 外部コンテンツ | 親 intent でモノレポ追跡済み |
| D3 | 翻訳レビュー可能な開発者（別 PR 承認） | 人 | 親 intent で確保可能と回答済み |
| D4 | intent-statement の成功指標 S-docs-1 | 要件 | 受入の北極星 |
| D5 | GitHub Issue #28 | 追跡 | 実装の進捗管理 |
