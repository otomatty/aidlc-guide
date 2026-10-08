---
target: delivery-planning
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

- Bolt ごとに対象の Unit を決める。Unit が 1 つなら Bolt も 1 つでよい。
- Construction の進め方の推奨を書く: Unit を 1 つずつ最後まで進める（unit-major）か、ステージごとに全 Unit を進める（stage-major）か、並列で進める（swarm）か。選択は Construction の開始時に、標準の手順で人が行う。
- リポジトリから品質ゲートのコマンド（例: `npm run check`、`make check`）を特定し、計画に書く。Construction では、このコマンドを Unit ごとの検証コマンドとして提案する。

## fragment: end-of-steps

### focus-flow：図解とコミット

**適用条件:** `aidlc-state.md` の `**Scope**` が `focus-flow` のときだけ、この節に従う。ほかのスコープでは読み飛ばす。

この節の作業は、完了の報告（`report --result awaiting-approval`）より前に行う。

1. `bolt-plan.md` に、Bolt と Unit の計画を `graph` の図で入れる。
2. `bun .claude/tools/focus-diagram.ts check <このステージのフォルダー>/bolt-plan.md --min 1` が通ることを確かめる。
3. 成果物・図をコミットする（メッセージ例: `PROJ-123 delivery-planning: Bolt の計画`）。
