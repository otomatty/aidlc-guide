---
slug: focus-implement
name: 実装
plugin: focus
phase: construction
execution: ALWAYS
condition: focus-flow で、各 Unit のテストが承認された後に必ず実行する。
lead_agent: focus-builder-agent
support_agents: []
mode: inline
for_each: unit-of-work
workspace_requires: true
produces:
  - focus-implementation-report
consumes:
  - artifact: focus-test-report
    required: true
  - artifact: unit-of-work
    required: true
  - artifact: requirements
    required: true
  - artifact: components
    required: false
  - artifact: bolt-plan
    required: false
requires_stage:
  - focus-test
sensors:
  - focus-diagrams
scopes:
  - focus-flow
inputs: 承認されたテストと focus-test-report、要件、設計、Bolt の計画（品質ゲートのコマンド）
outputs: アプリケーションのコード + focus-implementation-report.md・diagrams/・source-manifest.json（このステージの Unit ごとの記録フォルダー、エンジンが解決）
---

# 実装

承認されたテストを、TDD で 1 つずつ通す。テストを通す最小の実装を書き、テストが通った状態を保って
整理する。最後にプロジェクトの品質ゲートを通す。

作業の約束（情報源、質問の宛先、図解、コミット）は
`.claude/knowledge/aidlc-shared/focus-flow-guide.md` に従う。

## Steps

### Step 1: 承認されたテストと設計を読む

`focus-test-report.md`、テストのコード、要件、設計、`bolt-plan.md` の品質ゲートのコマンドを読む。

完了条件: 通すべきテストと、品質ゲートのコマンドが分かっている。

### Step 2: テストを 1 つずつ通す

失敗しているテストを 1 つ選び、それを通す最小の実装を書き、テストを実行して通ることを確かめる。
すべてのテストが通るまで繰り返す。通った後で、テストが通ったまま重複や読みにくさを整理する。

- 承認されたテストを弱めない、消さない、飛ばさない。期待値も変えない。テストの誤りや要件の矛盾に
  気づいたら、そこで作業を止め、理由を報告して人の判断を待つ。
- テスト先行のステージで付けた「失敗を期待する」指定があれば外す。
- 設計にない機能を足さない。設計と違う作り方が必要になったら、報告書に逸脱として書く。

完了条件: この Unit のテストがすべて通る。

### Step 3: 品質ゲートを通す

`bolt-plan.md` に書かれた品質ゲートのコマンドを実行し、成功させる。失敗したら原因を直し、
成功するまで繰り返す。基準を下げて通さない。実行したコマンドと結果を記録する。

完了条件: 品質ゲートのコマンドが成功している。

### Step 4: 報告書と図を作る

`focus-implementation-report.md` を書く。冒頭に、変更箇所を `compare`（As-Is と To-Be）か、
`status` 付きの `graph` の図で入れる。続けて、受け入れ条件・テスト・結果の表、品質ゲートの
コマンドと結果、設計からの逸脱とその理由、残るリスクを書く。

`bun .claude/tools/focus-diagram.ts check <このステージのフォルダー>/focus-implementation-report.md --min 1` が通ることを確かめる。

完了条件: 報告書の結果が、このセッションで実行したコマンドの出力で裏付けられている。

### Step 5: ソースの一覧を書き、コミットする

このステージの記録フォルダーに `source-manifest.json`（`"stage": "focus-implement"`）を書き、
作成・変更・削除したパスをすべて載せる。書式は focus-test と同じ。

intent が複数のリポジトリを記録していて、メインのワークスペースで作業するときは、すべての項目に記録済みの
リポジトリ名を付ける（例: `{ "repo": "member-api", "path": "src/routes/members.ts" }`）。
Bolt のワークツリーの中で作業するときは、パスをそのリポジトリからの相対パスにし、`repo` を付けない。

コード、報告書、図、`source-manifest.json` をコミットする
（メッセージ例: `PROJ-123 focus-implement: 会員検索の実装`）。

完了条件: 変更がコミットされている。

### Step 6: 完了を報告する

`bun .claude/tools/aidlc.ts engine orchestrate report --stage focus-implement --result <outcome>` で
`stage-protocol.md` に完了を引き渡す。承認の画面では、`focus-implementation-report.md` の図と
品質ゲートの結果を示す。Unit ごとの検証コマンドは、標準の Construction の手順で人が承認する。

## Sensors

`focus-diagrams` が承認の前に、`focus-implementation-report.md` の図が元データと一致し、最新であることを確かめる。

## Learn

`directive.protocol_modules` に `learnings` があれば、`stage-protocol-learnings.md` に従う。
