# Feasibility & Constraints — 質問ファイル

> ステージ: feasibility (Ideation 1.3) / 深度: Standard  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4**）  
> 親: `260730-docs-i18n`（Bolt 1）/ `260801-docs-locale`（Bolt 2）/ `260802-docs-deeplink`（Bolt 3）  
> 追跡 Issue: [#30](https://github.com/otomatty/aidlc-guide/issues/30)  
> Bolt 3 で StageCard → openOfficialDoc → Docs Shell は成立済み。本 intent は **Legacy Bridge → Open in Docs degrade（US-06）の実現性と制約** を確認するための質問です。  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。  
> 回答モード: Chat — 推奨を適用（ユーザー指示 2026-08-03）

---

## Q1. 統合面

Bolt 4 が触れる既存システムはどれですか？（select all that apply）

- A. `packages/dashboard`（BridgeRedirectPanel / excerpt 非マウント / Open in Docs CTA）
- B. `packages/vscode-extension`（openOfficialDoc 再利用・ホスト契約）
- C. `packages/api-core` / Docs Shell（CTA 着地先）
- D. レガシー Bridge 経路（置換・degrade 対象）
- E. 上記すべて（brownfield degrade が中心）
- X. その他（具体的に記入）

[Answer]: E

## Q2. 規制・コンプライアンス要件

新たに考慮すべき規制要件はありますか？

- A. なし（親 intent と同じく PCI / HIPAA / SOC2 / データレジデンシ非該当）
- B. あり（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A

## Q3. 技術スタック

Bolt 4 の実装スタックはどれですか？

- A. 既存 AIDLC Guide と同じ TypeScript / bun / Vite / React / VS Code Extension API に閉じる（新ライブラリなし）
- B. 新しいルーティング／ディープリンク用ライブラリを追加する
- X. その他（具体的に記入）

[Answer]: A

## Q4. タイムライン・組織ブロッカー

締切や組織的ブロッカーはありますか？

- A. なし（品質と運用可能性優先、親 intent と同じ）
- B. あり（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A

## Q5. 主要な技術リスク

Bolt 4 で最も懸念する技術リスクはどれですか？（select all that apply）

- A. Bridge が excerpt を記事として載せ続け、同梱 Docs と二重正本が残る
- B. Open in Docs が primary CTA にならず、二次導線のまま残る
- C. openOfficialDoc / Docs Shell 着地契約の再利用漏れ（Bolt 3 成果物との不整合）
- D. US-09 glossary を Must 扱いしてスコープが膨らむ
- E. A〜C を主リスクとし、D は Should 切下げで回避可能
- X. その他（具体的に記入）

[Answer]: E

## Q6. AWS / クラウド利用

AWS サービスやアカウントを利用しますか？

- A. 利用しない（ローカル専用、親 intent と同じ）— AWS 定型は N/A
- B. 利用する（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A

## Q7. 既存制約の継承

親 intent の制約（ローカル専用・実行時 fetch なし・`/api/official-docs` のみ・content-tree 切替・aidlc-workflows 本体変更なし・Bridge degrade は拡張ホスト／Dashboard 内）を継承しますか？

- A. すべて継承する
- B. 一部見直す（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
