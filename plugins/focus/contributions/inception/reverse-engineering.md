---
target: reverse-engineering
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

- コードを読むときは、依頼文の Jira チケットに関係する範囲を優先する。チケットと Confluence も読み、コードとの食い違いがあれば記録する。
- 実装の意図が読み取れない箇所は推測で書かず、宛先「開発者」の質問として成果物の `## Assumptions & Open Questions` に残す。

## fragment: end-of-steps

### focus-flow：図解とコミット

**適用条件:** `aidlc-state.md` の `**Scope**` が `focus-flow` のときだけ、この節に従う。ほかのスコープでは読み飛ばす。

この節の作業は、完了の報告（`report --result awaiting-approval`）より前に行う。

1. `architecture.md` に、既存の構成を `graph` の図で入れる。図はこのステージの codekb フォルダーの `diagrams/` に置く。
2. `bun .claude/tools/focus-diagram.ts check <codekb のフォルダー>/architecture.md --min 1` が通ることを確かめる。
3. 作った codekb の文書と図をコミットする（メッセージ例: `PROJ-123 reverse-engineering: 既存構成の把握`）。
