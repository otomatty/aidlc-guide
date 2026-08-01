# RAID Log — Docs i18n

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-07-31  
> 根拠: [feasibility-assessment.md](./feasibility-assessment.md) / [constraint-register.md](./constraint-register.md)  
> 入力参照: [intent-statement.md](../intent-capture/intent-statement.md)

## Risks（リスク）

| ID | 内容 | 影響 | 尤度 | 緩和 |
|----|------|------|------|------|
| R1 | モノレポに `docs/guide` / `docs/reference` が未配置のまま Construction に入る | 同梱コンテンツが空で S-docs-1 を検証できない | 高（現状事実） | Scope 前または Units 前に取り込み方式と初期スナップショットを確定・配置 |
| R2 | upstream docs 構造変更で en/ja 平行ツリーと差分レポートが壊れる | 運用コスト増・翻訳ドリフト | 中 | 差分レポートを Must 運用にし、構造破壊は手動トリアージ |
| R3 | VSIX サイズ／起動時間が許容を超える | 拡張配布・初回体験の悪化 | 低〜中 | Q7=A どおり後段 NFR で計測。必要なら遅延ロード |
| R4 | ja 翻訳が人手待ちで鮮度目標を満たせない | 「古いまま残る」問題が部分的に残る | 中 | 差分レポートで可視化し、未翻訳は en 表示フォールバックを設計で明示 |
| R5 | Docs Bridge と同梱サイトの二重導線が残る | 利用者混乱 | 低 | intent の置き換え方針を scope で境界化し、bridge-map は補助に限定 |

## Assumptions（前提）

| ID | 内容 | 検証タイミング |
|----|------|----------------|
| A1 | Q8=A は「これからモノレポ内に upstream 追跡を設ける」を含む（現状ツリーには対象 docs が無い） | Scope / Units |
| A2 | Q1 で B（docs-bridge）未選択でも、intent の「bridge-map 補助残置」は有効。本文正本は同梱サイト | Scope Definition |
| A3 | 公式公開ドキュメントの再配布に特別な法務ブロックはない（Q2=A） | 問題が出たら compliance 再訪 |
| A4 | 機械翻訳の自動同梱は行わない（intent）。差分自動 + 翻訳は別 PR | 運用設計（Inception 以降） |
| A5 | aidlc-workflows エンジン／ステージ定義は変更しない（project Forbidden 継承） | 全ステージ |

## Issues（顕在課題）

| ID | 内容 | 状態 | オーナー |
|----|------|------|----------|
| I1 | ワークスペースに `docs/guide/` および `docs/reference/` が存在しない（調査時点） | Open | 次ステージで取り込み方式を決める |
| I2 | スナップショットのバージョン表示（`sourceVersion`）の置き場が未定義 | Open | Application / Functional Design |

## Dependencies（依存）

| ID | 依存先 | 種類 | 備考 |
|----|--------|------|------|
| D1 | 先行 intent `260720-aidlc-guide-prd` の拡張・dashboard 基盤 | 成果物 | brownfield 延長（Q1 = A,C） |
| D2 | upstream aidlc-workflows の docs ツリー（guide + reference） | 外部コンテンツ | Q8 = A でモノレポ追跡に載せる |
| D3 | 翻訳レビュー可能な開発者（別 PR 承認） | 人 | Q5=A により確保可能と回答済み |
| D4 | intent-statement の成功指標 S-docs-1 | 要件 | 受入の北極星 |
