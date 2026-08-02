# Feasibility & Constraints — 質問ファイル

> ステージ: feasibility (Ideation 1.3) / 深度: Standard  
> Intent: `260802-docs-deeplink`（docs-i18n **Bolt 3**）  
> 親: `260730-docs-i18n`（Bolt 1）/ `260801-docs-locale`（Bolt 2 / PR [#34](https://github.com/otomatty/aidlc-guide/pull/34)）  
> 追跡 Issue: [#29](https://github.com/otomatty/aidlc-guide/issues/29)  
> Bolt 1/2 で Docs Shell・locale・stage-map は成立済み。本 intent は **StageCard → openOfficialDoc 配線の実現性と制約** を確認するための質問です。  
> 回答モード: Chat — 推奨を適用（ユーザー指示 2026-08-02）

---

## Q1. 統合面

Bolt 3 が触れる既存システムはどれですか？（select all that apply）

- A. `packages/dashboard`（StageCard DocsLink → openOfficialDoc、ラベル）
- B. `packages/vscode-extension`（openOfficialDoc ホストハンドラ / postMessage）
- C. `packages/official-docs`（既存 `stage-map` 利用・変更最小）
- D. `packages/api-core` / Docs Shell 着地（locale 付き deep-link 適用）
- E. 上記すべて（brownfield 配線が中心）
- X. その他（具体的に記入）

[Answer]: E

## Q2. 規制・コンプライアンス要件

新たに考慮すべき規制要件はありますか？

- A. なし（親 intent と同じく PCI / HIPAA / SOC2 / データレジデンシ非該当）
- B. あり（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A

## Q3. 技術スタック

Bolt 3 の実装スタックはどれですか？

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

Bolt 3 で最も懸念する技術リスクはどれですか？（select all that apply）

- A. StageCard のレガシー `docsOpenHref` / IDE open との共存・切替漏れ
- B. openOfficialDoc payload の `locale` が Docs Shell 状態に正しく載らない
- C. 未マップ slug の Shell top フォールバックが既存 deep-link 消費ロジックと競合
- D. 拡張ホスト postMessage 契約名の固定遅れで dashboard / host がずれる
- E. A〜D すべて（複数リスクを想定）
- X. その他（具体的に記入）

[Answer]: E

## Q6. AWS / クラウド利用

AWS サービスやアカウントを利用しますか？

- A. 利用しない（ローカル専用、親 intent と同じ）— AWS 定型は N/A
- B. 利用する（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A

## Q7. 既存制約の継承

親 intent の制約（ローカル専用・実行時 fetch なし・`/api/official-docs` のみ・content-tree 切替・aidlc-workflows 本体変更なし・深リンクは拡張ホスト内）を継承しますか？

- A. すべて継承する
- B. 一部見直す（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
