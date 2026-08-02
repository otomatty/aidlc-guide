# Feasibility & Constraints — 質問ファイル

> ステージ: feasibility (Ideation 1.3) / 深度: Standard  
> Intent: `260801-docs-locale`（docs-i18n **Bolt 2**）  
> 親: 完了済み `260730-docs-i18n`（Bolt 1 / PR [#26](https://github.com/otomatty/aidlc-guide/pull/26)）  
> 追跡 Issue: [#28](https://github.com/otomatty/aidlc-guide/issues/28)  
> Bolt 1 で技術境界は確立済み。本 intent は **locale/untranslated 実装の実現性と制約** を確認するための質問です。  
> 各質問の `[Answer]:` に選択肢の文字または自由記述を記入してください。

---

## Q1. 統合面

Bolt 2 が触れる既存システムはどれですか？（select all that apply）

- A. `packages/official-docs`（locale 解決・missing_ja / anchor 分岐）
- B. `packages/api-core`（`/api/official-docs` 応答の locale/notice 拡張）
- C. `packages/dashboard`（Docs Shell の locale 切替・未訳 notice UI）
- D. `packages/vscode-extension`（Docs Shell 起動・locale 連携）
- E. 上記すべて（Bolt 1 の縦スライスをそのまま延長）
- X. その他（具体的に記入）

[Answer]: E

## Q2. 規制・コンプライアンス要件

新たに考慮すべき規制要件はありますか？

- A. なし（親 intent と同じく PCI / HIPAA / SOC2 / データレジデンシ非該当）
- B. あり（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A

## Q3. 技術スタック

Bolt 2 の実装スタックはどれですか？

- A. 既存 AIDLC Guide と同じ TypeScript / bun / Vite / React / VS Code Extension API に閉じる
- B. 新しい i18n ライブラリや SSG を追加する
- X. その他（具体的に記入）

[Answer]: A

## Q4. タイムライン・組織ブロッカー

締切や組織的ブロッカーはありますか？

- A. なし（品質と運用可能性優先、親 intent と同じ）
- B. あり（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A

## Q5. 主要な技術リスク

Bolt 2 で最も懸念する技術リスクはどれですか？（select all that apply）

- A. 部分 `ja` での locale 維持ロジックが複雑になる（状態管理・URL/パス保持）
- B. 未訳 notice の a11y（`role=status`）実装が既存 UI と競合する
- C. アンカー欠落時のフォールバックが Markdown レンダリングと相性が悪い
- D. coverage 床（branch 95%）の導入で既存テストが赤くなる
- E. A〜D すべて（複数リスクを想定）
- X. その他（具体的に記入）

[Answer]: E

## Q6. AWS / クラウド利用

AWS サービスやアカウントを利用しますか？

- A. 利用しない（ローカル専用、親 intent と同じ）
- B. 利用する（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A

## Q7. 既存制約の継承

親 intent の制約（ローカル専用・実行時 fetch なし・`/api/official-docs` のみ・content-tree 切替・aidlc-workflows 本体変更なし）を継承しますか？

- A. すべて継承する
- B. 一部見直す（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
