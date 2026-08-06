# Team Formation — 質問ファイル

> ステージ: team-formation (Ideation 1.5) / 深度: Standard  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4** / Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)）  
> 上流: [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md) / [feasibility-assessment.md](../feasibility/feasibility-assessment.md)  
> Bolt 4 は Bridge degrade（US-06）の薄い差分。大規模編成は想定しない前提で確認します。  
> 各質問の `[Answer]:` に選択肢の文字または自由記述を記入してください。  
> **Mode:** Guide Me（推奨適用）

---

## Q1. 実行体制

Bolt 4 を誰が実行しますか？

- A. ソロ開発者（必要時にレビュー依頼）
- B. 少人数モブ（2–3人、ドライバー＋ナビゲータ）
- C. 複数チーム横断
- X. その他（具体的に記入）

[Answer]: A

## Q2. キャパシティ

当面の稼働はどう見ますか？

- A. この Bolt に集中できる（競合イニシアチブなし／軽微）
- B. 他タスクと並行で部分稼働
- C. キャパ不足で計画見直しが必要
- X. その他（具体的に記入）

[Answer]: A

## Q3. 必要スキル vs 保有

US-06（Bridge UI 縮退 + `openOfficialDoc` CTA + Demo）に対し、スキルギャップはありますか？

- A. ギャップなし（既存 dashboard / vscode-extension 経験で足りる）
- B. 軽微なギャップあり（具体的に記入）— 本 Bolt 内で吸収可能
- C. 重大なギャップあり — 外部支援または学習時間が必要
- X. その他（具体的に記入）

[Answer]: A

## Q4. トポロジ好み

作業の進め方はどれが近いですか？

- A. ソロ＋PR レビュー（trunk-based、短命ブランチ）
- B. ペア／モブセッションを要所で挟む
- C. 専任チームでストリームアライン
- X. その他（具体的に記入）

[Answer]: A

## Q5. 意思決定者

Ideation〜Construction のゲート承認者は誰ですか？

- A. ソロ実行者本人（現状どおり）
- B. 明示のプロダクトオーナー／レビュアが別途いる（名前を記入）
- X. その他（具体的に記入）

[Answer]: A

## Q6. 外部パートナー

AWS Professional Services・外部契約者は必要ですか？

- A. 不要（feasibility: クラウド／規制 N/A）
- B. 必要（理由を記入）
- X. その他（具体的に記入）

[Answer]: A

---

## Consolidated Summary

| Q | Answer | Decision |
|---|--------|----------|
| Q1 | A | ソロ開発者（必要時レビュー） |
| Q2 | A | 本 Bolt に集中可能 |
| Q3 | A | スキルギャップなし |
| Q4 | A | ソロ＋PR / trunk-based |
| Q5 | A | ゲート承認は実行者本人 |
| Q6 | A | 外部パートナー不要 |

Looks correct / Request changes?

- Looks correct
- Request changes

[Answer]: Looks correct
