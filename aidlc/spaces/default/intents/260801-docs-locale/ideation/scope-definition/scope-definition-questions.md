# Scope Definition — 質問ファイル

> ステージ: scope-definition (Ideation 1.4) / 深度: Standard  
> Intent: `260801-docs-locale`（docs-i18n **Bolt 2**）  
> 親: 完了済み `260730-docs-i18n`（Bolt 1 / PR [#26](https://github.com/otomatty/aidlc-guide/pull/26)）  
> 追跡 Issue: [#28](https://github.com/otomatty/aidlc-guide/issues/28)  
> Bolt 1 で MVP（S-docs-1 の薄い縦スライス）は成立済み。本 intent は **locale/untranslated の完成** に絞るための質問です。  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。

---

## Q1. 最小価値スコープ（Bolt 2 の MVP）

Bolt 2 で「できた」と言える最小限はどれですか？

- A. keep-path 切替のみ（未訳 notice・anchor は後回し）
- B. keep-path + 未訳 notice（anchor は後回し）
- C. keep-path + 未訳 notice + anchor フォールバック（三点セット）
- D. C + coverage 床（NFR-3 95%）も同時に満たす
- X. その他（具体的に記入）

[Answer]: D

## Q2. Must / Should / Could の仕分け

Bolt 2 の各能力をどう仕分けますか？

- A. keep-path・notice・anchor・coverage すべて Must
- B. keep-path・notice・anchor は Must、coverage は Should
- C. keep-path のみ Must、他は Should
- X. その他（具体的に記入）

[Answer]: A

## Q3. 依存関係

Bolt 2 の実装で前提となるものはどれですか？（select all that apply）

- A. Bolt 1 の `packages/official-docs`（locale 解決・guardPath）
- B. Bolt 1 の `packages/api-core`（`/api/official-docs` ルート）
- C. Bolt 1 の `packages/dashboard`（Docs Shell・LocaleControl）
- D. 親 intent の要件定義（US-03, US-04, NFR-3）
- E. 上記すべて
- X. その他（具体的に記入）

[Answer]: E

## Q4. シーケンス

実装の順序はどれが望ましいですか？

- A. official-docs（missing_ja / anchor 分岐）→ api-core → dashboard（UI）
- B. dashboard（UI モック）→ official-docs → api-core
- C. 並行（ユニットごとに独立して進める）
- X. その他（具体的に記入）

[Answer]: A

## Q5. スコープ外の確認

Bolt 2 に **含めない** ものを再確認します。（select all that apply）

- A. StageCard → `openOfficialDoc` ディープリンク（→ B3 / #29）
- B. BridgeRedirectPanel（→ B4 / #30）
- C. upstream 差分レポート本番化（→ B5 / #31）
- D. 新しい公式ツリーの大幅追加（harness-engineering 等）
- E. Codex 指摘の Docs Shell `h1` 修正（任意フォローアップ）
- F. 上記すべて
- X. その他（具体的に記入）

[Answer]: F

## Q6. ハードデッドライン

特定の能力に紐づくハードデッドラインはありますか？

- A. なし（品質と運用可能性優先）
- B. あり（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
