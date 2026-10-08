---
target: requirements-analysis
plugin: focus
adds:
  scopes:
    - focus-flow
  sensors:
    - focus-diagrams
fragments:
  - anchor: before-step:1
    order: 100
  - anchor: end-of-steps
    order: 100
---

## fragment: before-step:1

### focus-flow：このステージの進め方

**適用条件:** `aidlc-state.md` の `**Scope**` が `focus-flow` のときだけ、この節に従う。ほかのスコープでは読み飛ばす。

最初に `.claude/knowledge/aidlc-shared/focus-flow-guide.md` を読み、そこに書かれた約束（情報源の扱い、宛先つきの質問、図解、コミット）に従う。この節は、それをこのステージに当てはめたもの。

- 開始時に既定ブランチにいる場合は、チケットキーを含む作業ブランチを作る。
- 依頼文の Jira チケット（本文・受け入れ条件・コメント・リンク・エピック）と、関連する Confluence ページを読む。codekb があれば読む。
- 要件は `FR-n`、受け入れ条件は `AC-n` の ID を付け、受け入れ条件は Given/When/Then で書く。各要件に根拠（Jira・Confluence・コード）を書く。
- 根拠がない、または資料同士が食い違う点は、宛先（PO・開発者など）を付けた質問にする。業務と仕様の判断は PO、既存の挙動と技術的な制約は開発者に聞く。

## fragment: end-of-steps

### focus-flow：図解とコミット

**適用条件:** `aidlc-state.md` の `**Scope**` が `focus-flow` のときだけ、この節に従う。ほかのスコープでは読み飛ばす。

この節の作業は、完了の報告（`report --result awaiting-approval`）より前に行う。

1. `requirements.md` の冒頭に、利用者・業務と要件の関係を `graph` の図で入れる。業務の流れが変わる場合は、現状と変更後を `compare` の図で入れる。文章は図の補足にする。
2. `bun .claude/tools/focus-diagram.ts check <このステージのフォルダー>/requirements.md --min 1` が通ることを確かめる。
3. 成果物・質問ファイル・図をコミットする（メッセージ例: `PROJ-123 requirements-analysis: 会員検索の要件`）。
