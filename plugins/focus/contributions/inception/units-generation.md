---
target: units-generation
plugin: focus
adds:
  scopes:
    - focus-flow
  sensors:
    - focus-diagrams
fragments:
  - anchor: before-step:1
    order: 100
  - anchor: before-step:6
    order: 100
---

## fragment: before-step:1

### focus-flow：このステージの進め方

**適用条件:** `aidlc-state.md` の `**Scope**` が `focus-flow` のときだけ、この節に従う。ほかのスコープでは読み飛ばす。

最初に `.claude/knowledge/aidlc-shared/focus-flow-guide.md` を読み、そこに書かれた約束（情報源の扱い、宛先つきの質問、図解、コミット）に従う。この節は、それをこのステージに当てはめたもの。

- チケットが小さく、まとめて作るほうが自然な場合は、Unit を 1 つにしてよい。大きなチケットは、独立してテストと実装ができる単位に分ける。
- 各 Unit に、担当する要件（`FR-n`）と受け入れ条件（`AC-n`）を割り当てる。どの Unit にも割り当てられない要件を残さない。

## fragment: before-step:6

### focus-flow：図解とコミット

**適用条件:** `aidlc-state.md` の `**Scope**` が `focus-flow` のときだけ、この節に従う。ほかのスコープでは読み飛ばす。

この節は、標準の完了の報告（Completion Handoff）の直前に行う。図とコミットがそろってから完了を報告する。

1. `unit-of-work.md` に、Unit と依存関係の図を入れる。
2. 描いた図を見直す。図が伝えたいことを示しているか、文字のはみ出しや線の重なりがないか、本文と ID が一致しているかを確かめる（承認の前に、センサー `focus-diagrams` が図の有無と安全性を確かめる）。
3. 成果物・図をコミットする（メッセージ例: `PROJ-123 units-generation: Unit の分割`）。
