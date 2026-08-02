# Scope Definition — 質問ファイル

> ステージ: scope-definition (Ideation 1.4) / 深度: Standard  
> Intent: `260802-docs-deeplink`（docs-i18n **Bolt 3**）  
> 親: `260730-docs-i18n`（Bolt 1）/ `260801-docs-locale`（Bolt 2 / PR [#34](https://github.com/otomatty/aidlc-guide/pull/34)）  
> 追跡 Issue: [#29](https://github.com/otomatty/aidlc-guide/issues/29)  
> 回答モード: Chat — 推奨を適用（ユーザー指示 2026-08-02）

---

## Q1. 最小価値スコープ（Bolt 3 の MVP）

Bolt 3 で「できた」と言える最小限はどれですか？

- A. StageCard から Docs Shell を開くだけ（slug map・ラベル・unmapped は後回し）
- B. 7 slug map + 内部着地（ラベル・unmapped は後回し）
- C. 7 slug map + ラベル ≠ bare Docs + `{locale,path,anchor?}` + 内部着地 + unmapped→top（Issue #29 DoD）
- D. C + Demo（intent-capture StageCard → Docs Shell）も必須
- X. その他（具体的に記入）

[Answer]: D

## Q2. Must / Should / Could の仕分け

Bolt 3 の各能力をどう仕分けますか？

- A. 7 slug・ラベル・payload・内部着地・unmapped→top・Demo すべて Must
- B. A のうち Demo だけ Should
- C. slug map + 内部着地のみ Must、他は Should
- X. その他（具体的に記入）

[Answer]: A

## Q3. 依存関係

Bolt 3 の実装で前提となるものはどれですか？（select all that apply）

- A. Bolt 1/2 の Docs Shell deep-link 着地口（path/anchor）
- B. `packages/official-docs` の `STAGE_DOC_MAP`（7 slug）
- C. `packages/dashboard` StageCard（レガシー DocsLink の置換）
- D. `packages/vscode-extension`（openOfficialDoc ホスト）
- E. 親 US-05 / FR-U3.1–U3.3
- F. 上記すべて
- X. その他（具体的に記入）

[Answer]: F

## Q4. シーケンス

実装の順序はどれが望ましいですか？

- A. 契約（payload / メッセージ type）→ host handler → StageCard 配線 → Docs Shell locale 適用
- B. StageCard UI 先 → host → Shell
- C. 並行（dashboard / extension を独立）
- X. その他（具体的に記入）

[Answer]: A

## Q5. スコープ外の確認

Bolt 3 に **含めない** ものを再確認します。（select all that apply）

- A. BridgeRedirectPanel / excerpt 非マウント（→ B4 / #30）
- B. upstream 差分レポート本番化（→ B5 / #31）
- C. locale keep-path / missing_ja の再実装（Bolt 2 完了）
- D. 新しい公式ツリーの大幅追加
- E. 7 slug 以外への map 拡張
- F. 上記すべて
- X. その他（具体的に記入）

[Answer]: F

## Q6. ハードデッドライン

特定の能力に紐づくハードデッドラインはありますか？

- A. なし（品質と運用可能性優先）
- B. あり（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
