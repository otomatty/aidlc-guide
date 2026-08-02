# Stakeholder Map — Docs i18n Bolt 3

> ステージ: intent-capture (Ideation 1.1) / 作成日: 2026-08-02  
> 根拠: [intent-statement.md](./intent-statement.md) + intent-capture-questions.md

## Key Stakeholders（主要ステークホルダーと関心事）

| ステークホルダー | 役割 | 関心事 |
|----------------|------|--------|
| ドライバー | 主受益者（Q2 = C） | StageCard から拡張内 Docs Shell へ着地し、モブ説明が途切れないこと |
| 初学者エンジニア | 副次受益者 | 現在ステージの公式 docs に迷わず辿り着けること |
| ドキュメント整備担当 | 品質・運用 | 7 slug map と unmapped→top が UI 経路で守られること |
| プロダクトオーナー（本ワークフロー承認者） | 意思決定者 | Bolt 3 スコープ（deep links のみ）が守られ、B4/B5 に scope creep しないこと |
| aidlc-workflows フレームワーク保守者 | 上流依存の所有者 | 本 Bolt が aidlc-workflows 本体を変更しないこと（Q7 = A） |

## Decision-Makers vs. Influencers（意思決定者と影響者）

- **意思決定者**: プロダクトオーナー（各ステージゲートで承認）
- **影響者**:
  - ドライバー — openOfficialDoc 着地体験が US-05 の実用性を決める
  - 初学者 — ラベル明瞭さと Shell 内着地が学習コストを左右する
  - 親 intent 設計者 — Bolt 1/2 契約・`stage-map` との整合（brownfield 延長 Q6 = C）

## Communication Requirements（コミュニケーション要件）

- **承認ゲート（本ワークフロー）**: intent / scope / design / code の各成果物はプロダクトオーナーがゲートでレビュー
- **GitHub 追跡**: 実装は Issue [#29](https://github.com/otomatty/aidlc-guide/issues/29) に紐づける
- **利用者向け**: リンク文言は bare `Docs`  alone にしない
- **非ゴールの周知**: B4 Bridge・B5 差分は別 Issue（#30–#31）で扱う

## 非技術者向け要約

ステージカードから公式ドキュメントを、ブラウザではなく拡張の中で開けるようにします。どのステージの説明かが分かるラベル付きで開き、対応がないステージではドキュメント画面の先頭に着地します。Bridge の置き換えや翻訳差分レポートは次の Bolt で行います。
