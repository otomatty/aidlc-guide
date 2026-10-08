# focus プラグイン

Jira チケットを起点に、要件・設計・Unit と Bolt の計画を決め、Unit ごとにテストを先に書いてから TDD で
実装する、aidlc-workflows のプラグイン。Claude Code と Claude Opus 5.5 を前提にする。
人が承認する成果物は、図（SVG）を中心に説明する。

設計の背景と判断は [設計書](../../docs/maintenance/claude-code-workflow-plugin-design.md) を参照。

## 中身

| 種類           | ファイル                                       | 役割                                                                      |
| -------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| スコープ       | `scopes/focus-flow.md`                         | 実行するステージの組み合わせ                                              |
| 標準への追記   | `contributions/inception/*.md`                 | 標準の 5 ステージに、Jira・Confluence、宛先つき質問、図解、コミットを足す |
| ステージ       | `stages/construction/focus-test.md`            | Unit ごとに、失敗するテストを先に書く                                     |
|                | `stages/construction/focus-implement.md`       | Unit ごとに、TDD で実装し品質ゲートを通す                                 |
| エージェント   | `agents/*.md`                                  | テスト作成・実装の担当（セッションが読み込む）と、テストのレビュアー（Opus） |
| センサー       | `sensors/aidlc-focus-diagrams.md`              | 承認前に、図が元データから作られた最新のものかを確かめる                  |
| ツール         | `tools/focus-diagram.ts`                       | 図の元データ（JSON）から SVG を作る、文書の図を検査する                   |
| ナレッジ       | `knowledge/aidlc-shared/focus-flow-guide.md`   | 全ステージが従う約束                                                      |

## 図を作る

```sh
bun .claude/tools/focus-diagram.ts render <フォルダー>/diagrams/<名前>.json
bun .claude/tools/focus-diagram.ts check <成果物>.md --min 1
```

図の種類（`graph`・`compare`・`matrix`）と書き方は、ナレッジの「図解」を参照。

## 検証

リポジトリのルートで次を実行する。

```sh
bun run check:plugins   # 公式の検証と合成テスト
bunx vitest run plugins/focus
```

どちらも `bun run check` に含まれる。

## 導入（未検証）

公式のビルドで Claude Code 向けの出力を作り、プロジェクトで合成する。

```sh
aidlc plugin build claude --plugin-root plugins/focus
AIDLC_PLUGIN_ROOT="$(pwd)/plugins/focus/dist/claude" AIDLC_HARNESS_DIR=.claude aidlc engine plugin sync
```

起動は `/aidlc --scope focus-flow PROJ-123 <チケットの要約>`。Atlassian の MCP サーバーを
`.mcp.json` に登録しておく。
