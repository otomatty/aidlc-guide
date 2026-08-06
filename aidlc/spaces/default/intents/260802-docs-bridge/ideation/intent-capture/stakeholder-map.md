# Stakeholder Map — Docs i18n Bolt 4

> ステージ: intent-capture (Ideation 1.1) / 作成日: 2026-08-03  
> 根拠: [intent-statement.md](./intent-statement.md) + intent-capture-questions.md

## Key Stakeholders（主要ステークホルダーと関心事）

| ステークホルダー | 役割 | 関心事 |
|----------------|------|--------|
| ドライバー／モブ参加者 | 主受益者（Q2 = C） | Legacy Bridge から Open in Docs で同梱 Docs に迷わず移れること |
| 初学者エンジニア | 副次受益者 | 正本が一箇所（同梱 Docs）であること |
| ドキュメント整備担当 | 品質・運用 | Bridge が二重正本にならないこと；US-09 は切下げ可でも運用が壊れないこと |
| プロダクトオーナー（本ワークフロー承認者） | 意思決定者 | Bolt 4 スコープ（Bridge degrade のみ）が守られ、B5 に scope creep しないこと |
| aidlc-workflows フレームワーク保守者 | 上流依存の所有者 | 本 Bolt が aidlc-workflows 本体を変更しないこと（Q7 = A） |

## Decision-Makers vs. Influencers（意思決定者と影響者）

- **意思決定者**: プロダクトオーナー（各ステージゲートで承認）
- **影響者**:
  - ドライバー — Open in Docs → Shell の体験が US-06 の実用性を決める
  - 初学者 — 「正本は同梱 Docs のみ」の分かりやすさ
  - 親 intent 設計者 — Bolt 1–3 契約・`openOfficialDoc` との整合（brownfield 延長 Q6 = C）

## Communication Requirements（コミュニケーション要件）

- **承認ゲート（本ワークフロー）**: intent / scope / design / code の各成果物はプロダクトオーナーがゲートでレビュー
- **GitHub 追跡**: 実装は Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30) に紐づける
- **利用者向け**: Open in Docs が primary CTA であること（excerpt を記事として見せない）
- **非ゴールの周知**: B5 差分レポートは別 Issue（#31）で扱う；US-09 は Should

## 非技術者向け要約

古い Bridge 画面を、同梱ドキュメントへの案内板にします。本文の抜粋は記事のように載せず、「ドキュメントで開く」をいちばん目立つボタンにし、押すと拡張内の Docs に着地します。用語集などの補助はあってもなくてもよく、翻訳差分レポートは次の Bolt です。
