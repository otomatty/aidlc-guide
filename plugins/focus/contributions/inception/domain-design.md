---
target: domain-design
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

- 承認された要件、codekb、関連するコードと Confluence の設計資料を読む。
- 設計判断ごとに、背景・決定・結果・退けた案（2 つ以上）を書く。
- 影響範囲として、同じ挙動を持つ別の経路と、変更が波及する呼び出し元を、ファイルと行で示す。
- 既存コードの事実として確かめられない設計の前提は、宛先「開発者」の質問にする。仕様の判断が必要な点は、宛先「PO」の質問にする。

## fragment: end-of-steps

### focus-flow：図解とコミット

**適用条件:** `aidlc-state.md` の `**Scope**` が `focus-flow` のときだけ、この節に従う。ほかのスコープでは読み飛ばす。

この節の作業は、完了の報告（`report --result awaiting-approval`）より前に行う。

1. `components.md` の冒頭に、構成の As-Is と To-Be を `compare` の図で入れる。処理の流れが変わる場合は、流れの図も入れる。
2. `bun .claude/tools/focus-diagram.ts check <このステージのフォルダー>/components.md --min 1` が通ることを確かめる。
3. 成果物・図をコミットする（メッセージ例: `PROJ-123 domain-design: 会員検索の設計`）。
