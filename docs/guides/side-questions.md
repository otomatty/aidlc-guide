# 調べ物は MCP に逃がす

> 対象: 本線の AI-DLC セッションを汚したくない開発者  
> 関連: [はじめに](./getting-started.md) · パッケージ詳細は [packages/mcp-server/README.md](../../packages/mcp-server/README.md)

## このガイドでできるようになること

「今のステージは何をする段階？」「この成果物の中身は？」といった質問を、**読取専用**の MCP で済ませる。

MCP はワークフロー状態を進めたり、インテントを切り替えたりしません。

## 準備（MCP）

1. [はじめに](./getting-started.md) の Setup、または **`AIDLC Guide: Register MCP`**
2. プロジェクトルートの `.mcp.json` に `aidlc-guide` が入っていることを確認
3. Claude Code を再起動し、`/mcp` で `aidlc-guide` が見えること
4. `bun` が PATH にあること（サーバは `bun run packages/mcp-server/...` で起動する）

最小の登録例:

```json
{
  "mcpServers": {
    "aidlc-guide": {
      "command": "bun",
      "args": ["run", "packages/mcp-server/src/index.ts"]
    }
  }
}
```

別リポジトリを見たいときは `cwd` に対象ワークスペースを指定します（詳細は mcp-server README）。

## MCP ツール（何を聞くか）

| ツール                | 質問の例                                          |
| --------------------- | ------------------------------------------------- |
| `aidlc_status`        | 今どのフェーズ / ステージ / ゲートか              |
| `aidlc_next_steps`    | 次のステージと、人間に求められること              |
| `aidlc_explain_stage` | `code-generation` とは何をする段階か（slug 指定） |
| `aidlc_read_artifact` | レコード相対パスの成果物本文                      |
| `aidlc_glossary`      | 「Bolt」「Gate」などの用語                        |

応答は日本語テキスト + 構造化 JSON です。`explain_stage` / `glossary` は docs-bridge の原文をそのまま返します（サーバ側で要約しません）。

## うまくいかないとき

| 症状                                   | 確認すること                                                           |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `/mcp` に出ない                        | `.mcp.json` のマージと Claude Code 再起動                              |
| 「アクティブなインテントがありません」 | 正常な劣化応答。Intent を作る / 有効化する                             |
| State Version が合わない               | 対応は **7** のみ。本体の workflows 版を確認                           |
| 成果物が読めない                       | パスがアクティブインテントの記録ディレクトリ内か（`../` は拒否される） |

## 次に読む

- 画面で成果物を追う → [Dashboard で現在地と成果物を読む](./reading-workflow.md)
- 自分のブラウザで見る → [ブラウザの Dashboard](./browser-dashboard.md)
