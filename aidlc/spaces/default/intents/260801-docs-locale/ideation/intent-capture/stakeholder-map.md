# Stakeholder Map — Docs i18n Bolt 2

> ステージ: intent-capture (Ideation 1.1) / 作成日: 2026-08-01  
> 根拠: [intent-statement.md](./intent-statement.md) + intent-capture-questions.md

## Key Stakeholders（主要ステークホルダーと関心事）

| ステークホルダー | 役割 | 関心事 |
|----------------|------|--------|
| 初学者エンジニア | 主受益者（Q2 = A） | 部分 `ja` でも keep-path 切替・未訳 notice で迷わないこと |
| ドライバー | 利用・説明者（副次） | モブ中に locale を切り替えて同じ path を見せられること |
| ドキュメント整備担当 | 品質・運用 | official-docs coverage 床で missing_ja / anchor 分岐が CI で守られること |
| プロダクトオーナー（本ワークフロー承認者） | 意思決定者 | Bolt 2 スコープ（locale/untranslated のみ）が守られ、B3〜B5 に scope creep しないこと |
| aidlc-workflows フレームワーク保守者 | 上流依存の所有者 | 本 Bolt が aidlc-workflows 本体を変更しないこと（Q7 = A） |

## Decision-Makers vs. Influencers（意思決定者と影響者）

- **意思決定者**: プロダクトオーナー（各ステージゲートで承認）
- **影響者**:
  - 初学者 — 未訳 notice と locale 維持が S-docs-1 の実用性を決める
  - ドキュメント整備担当 — coverage 床の閾値と分岐の網羅性
  - 親 intent 設計者 — Bolt 1 契約との整合（brownfield 延長 Q6 = C）

## Communication Requirements（コミュニケーション要件）

- **承認ゲート（本ワークフロー）**: intent / scope / design / code の各成果物はプロダクトオーナーがゲートでレビュー
- **GitHub 追跡**: 実装は Issue [#28](https://github.com/otomatty/aidlc-guide/issues/28) に紐づける
- **利用者向け**: 未訳 notice は `role=status` でスクリーンリーダーにも伝わること
- **非ゴールの周知**: B3 深リンク・B4 Bridge・B5 差分は別 Issue（#29–#31）で扱う

## 非技術者向け要約

Bolt 1 で入れた公式ドキュメントの言語切替を、日本語がまだ揃っていないページでも使いやすくします。同じページの場所を保ったまま英語と日本語を切り替え、翻訳がないときはその旨をはっきり示し、locale は日本語のままにします。深リンクや Bridge の置き換えは次の Bolt で行います。
