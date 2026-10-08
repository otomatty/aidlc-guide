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
  - anchor: before-step:4
    order: 100
---

## fragment: before-step:1

### focus-flow：このステージの進め方

**適用条件:** `aidlc-state.md` の `**Scope**` が `focus-flow` のときだけ、この節に従う。ほかのスコープでは読み飛ばす。

最初に `.claude/knowledge/aidlc-shared/focus-flow-guide.md` を読み、そこに書かれた約束（情報源の扱い、宛先つきの質問、図解、コミット）に従う。この節は、それをこのステージに当てはめたもの。

- 既定ブランチにいる場合は、チケットキーを含む作業ブランチを作る（このステージが最初にコミットするため）。すでに作業ブランチにいれば何もしない。
- コードを読むときは、依頼文の Jira チケットに関係する範囲を優先する。チケットと Confluence も読み、コードとの食い違いがあれば記録する。
- 実装の意図が読み取れない箇所は推測で書かず、宛先「開発者」の質問として成果物の `## Assumptions & Open Questions` に残す。

## fragment: before-step:4

### focus-flow：コミット

**適用条件:** `aidlc-state.md` の `**Scope**` が `focus-flow` のときだけ、この節に従う。ほかのスコープでは読み飛ばす。

この節は、標準の完了の報告（Completion Handoff）の直前に行う。コミットしてから完了を報告する。

1. 公開された codekb の文書をコミットする（メッセージ例: `PROJ-123 reverse-engineering: 既存構成の把握`）。
2. 既存構成の図はこのステージでは必須にしない。domain-design の As-Is と To-Be の比較図で示す。
