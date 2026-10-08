---
slug: focus-test
name: テスト先行
plugin: focus
phase: construction
execution: ALWAYS
condition: focus-flow で、各 Unit の実装より前に必ず実行する。
lead_agent: focus-test-writer-agent
support_agents: []
mode: subagent
reviewer: focus-reviewer-agent
review_artifact: focus-test-report
reviewer_max_iterations: 2
review_class: adversarial
for_each: unit-of-work
workspace_requires: true
produces:
  - focus-test-report
consumes:
  - artifact: unit-of-work
    required: true
  - artifact: requirements
    required: true
  - artifact: components
    required: false
  - artifact: unit-of-work-story-map
    required: false
  - artifact: bolt-plan
    required: false
requires_stage:
  - units-generation
  - delivery-planning
sensors:
  - focus-diagrams
scopes:
  - focus-flow
inputs: この Unit の要件と受け入れ条件、設計（components）、Bolt の計画、リポジトリのコードとテスト
outputs: テストコード + focus-test-report.md・diagrams/・source-manifest.json（このステージの Unit ごとの記録フォルダー、エンジンが解決）
---

# テスト先行

承認された要件と設計から、実装より前に、失敗するテストを書く。承認されたテストは、
次の実装ステージの契約になる。AI レビュアーが要件の漏れを確かめ、最後に人がテストを確認する。

作業の約束（情報源、質問の宛先、図解、コミット）は
`.claude/knowledge/aidlc-shared/focus-flow-guide.md` に従う。

## Steps

### Step 1: この Unit の入力を読む

`unit-of-work.md` でこの Unit に割り当てられた要件（`FR-n`）と受け入れ条件（`AC-n`）を確かめ、
要件、設計、Bolt の計画、関連するコードと既存のテストを読む。必要なら Jira と Confluence も読む。

完了条件: この Unit で確かめる受け入れ条件を、漏れなく一覧にできている。

### Step 2: 受け入れ条件ごとにテストを書く

- 各受け入れ条件に、少なくとも 1 つのテストを書く。境界の値と、失敗する場合（不正な入力、権限がない等）も含める。
- テストには `T-n` の ID を付け、どの `AC-n` を確かめるかが分かる名前にする。
- 既存のテストの場所・書き方・フレームワークに合わせる。
- 本体のコードは書かない。テストが読み込みの段階で落ちないよう、未実装であることを示す最小の空の実装
  （呼ぶと「未実装」の例外を投げる関数など）だけは置いてよい。

完了条件: すべての受け入れ条件に、対応するテストがある。

### Step 3: テストが期待どおりに失敗することを確かめる

新しく書いたテストを実行し、すべてが「未実装」または期待値との不一致で失敗することを確かめる。
読み込みエラーや構文エラーで落ちるテストを残さない。既存のテストは通ったままであることも確かめる。
実行したコマンドと結果を記録する。

完了条件: 新しいテストは期待どおりに失敗し、既存のテストは通る。

### Step 4: 報告書と図を作る

`focus-test-report.md` を書く。冒頭に、要件・受け入れ条件とテストの対応を `matrix` の図で入れる
（行に `AC-n`、列に `T-n`）。続けて、テストの一覧（ID、ファイル、確かめること）、失敗を確かめた
コマンドと結果、テストを書かなかった受け入れ条件とその理由を書く。

`bun .claude/tools/focus-diagram.ts check <このステージのフォルダー>/focus-test-report.md --min 1` が通ることを確かめる。

完了条件: 図の「未対応」が 0 件か、0 件でない理由が報告書に書かれている。

### Step 5: ソースの一覧を書き、コミットする

このステージの記録フォルダーに `source-manifest.json` を書く。作成・変更・削除したテストと空の実装の
パスをすべて載せる。

```json
{
  "stage": "focus-test",
  "unit": "<Unit 名>",
  "version": 1,
  "writes": [{ "path": "src/members/search.test.ts" }, { "path": "src/members/search.ts" }]
}
```

テスト、空の実装、報告書、図、`source-manifest.json` をコミットする
（メッセージ例: `PROJ-123 focus-test: 会員検索のテスト`）。コミットのフックが品質ゲートを実行していて、
失敗するテストのためにコミットできない場合は、テストフレームワークの「失敗を期待する」指定
（Vitest の `it.fails` など）を付けてコミットし、そのことを報告書に書く。実装ステージで外す。

完了条件: 変更がコミットされている。

### Step 6: 完了を報告する

`bun .claude/tools/aidlc.ts engine orchestrate report --stage focus-test --result <outcome>` で
`stage-protocol.md` に完了を引き渡す。承認の画面では、`focus-test-report.md` の図を示し、
人に確かめてほしいこと（受け入れ条件の漏れ、テストの観点、期待値）を伝える。

## Sensors

`focus-diagrams` が承認の前に、`focus-test-report.md` の図が元データと一致し、最新であることを確かめる。

## Learn

`directive.protocol_modules` に `learnings` があれば、`stage-protocol-learnings.md` に従う。
