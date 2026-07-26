# 調べ物は MCP / btw に逃がす

> 対象: 本線の AI-DLC / Claude Code セッションを汚したくない開発者  
> 関連: [はじめに](./getting-started.md) · パッケージ詳細は [packages/mcp-server/README.md](../../packages/mcp-server/README.md)

## このガイドでできるようになること

「今のステージは何をする段階？」「この成果物の中身は？」といった質問を、**読取専用**の脇道（MCP または `btw`）で済ませる。

## いつどっちを使うか

| 手段 | 向いている場面 |
|------|----------------|
| MCP（Claude Code のツール） | 本線セッション内で、ツール呼び出しとして聞く |
| `AIDLC Guide: Ask (btw)` | IDE からターミナルでサイドセッションを開く |
| `AIDLC Guide: Ask one-shot` | 一問だけ聞いて終わり（ヘッドレス） |

いずれもワークフロー状態を進めたり、インテントを切り替えたりしません。

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

| ツール | 質問の例 |
|--------|----------|
| `aidlc_status` | 今どのフェーズ / ステージ / ゲートか |
| `aidlc_next_steps` | 次のステージと、人間に求められること |
| `aidlc_explain_stage` | `code-generation` とは何をする段階か（slug 指定） |
| `aidlc_read_artifact` | レコード相対パスの成果物本文 |
| `aidlc_glossary` | 「Bolt」「Gate」などの用語 |

応答は日本語テキスト + 構造化 JSON です。`explain_stage` / `glossary` は docs-bridge の原文をそのまま返します（サーバ側で要約しません）。

## 手順: 拡張から btw

1. コマンドパレット → **`AIDLC Guide: Ask (btw)`**  
2. 開いたターミナルで質問する（読取専用サイドセッション）  
3. 一問で終わらせたいとき → **`AIDLC Guide: Ask one-shot`**

期待される結果: 本線の `/aidlc` 会話とは別プロセスで、状態参照だけが行われる。

## うまくいかないとき

| 症状 | 確認すること |
|------|----------------|
| `/mcp` に出ない | `.mcp.json` のマージと Claude Code 再起動 |
| 「アクティブなインテントがありません」 | 正常な劣化応答。Intent を作る / 有効化する |
| State Version が合わない | 対応は **7** のみ。本体の workflows 版を確認 |
| 成果物が読めない | パスがアクティブインテントの記録ディレクトリ内か（`../` は拒否される） |

## 次に読む

- 画面で成果物を追う → [Dashboard で現在地と成果物を読む](./reading-workflow.md)  
- モブ参加者への見せ方 → [ブラウザ / LAN](./browser-dashboard.md) · [Live Share](./live-share.md)
