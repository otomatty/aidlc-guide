# @aidlc-guide/mcp-server

AI-DLC ワークスペースを **読取専用** で公開する MCP stdio サーバ。Claude Code が
セッション開始時に spawn し、5つのツールを提供する（U4 / FR-2）。

書込 API は持たない。`node:fs` の write 系 import は Biome の
`noRestrictedImports` でパッケージ全体に対して禁止されている（BR-MS-1 / S-MS-1）。
トランスポートは stdio のみで、ネットワーク listen は行わない（S-MS-3）。

## ツール

| ツール | いつ使うか | 入力 |
|--------|-----------|------|
| `aidlc_status` | 現在のワークフロー位置（フェーズ / ステージ / ゲート / 進捗）を知りたいとき | なし |
| `aidlc_next_steps` | 次のステージ名と、そこで人間に求められることを知りたいとき | なし |
| `aidlc_explain_stage` | あるステージが何をする段階かを知りたいとき | `slug` |
| `aidlc_read_artifact` | 成果物ファイルの本文を読みたいとき | `path`（記録ディレクトリからの相対） |
| `aidlc_glossary` | AI-DLC 用語の定義を引きたいとき | `term` |

応答は日本語テキスト + 構造化 JSON の2ブロック（BR-MS-6）。`explain_stage` と
`glossary` は docs-bridge の**原文をそのまま**返す — サーバ側で要約・言い換えを
しない（BR-MS-4）。

### 失敗の伝え方

データ側の失敗（インテント未作成 / 未対応 State Version / ファイル未発見 /
記録ディレクトリ外 / サイズ超過）は **すべて通常応答**で理由を返す。MCP の
`isError` になるのは**入力スキーマ違反のみ**（BR-MS-3）。AI が理由を読んで次の
行動を選べることが、このサーバの設計上の価値。

## `.mcp.json` への登録

プロジェクトルート（`.claude/` と同階層）の `.mcp.json` に、以下を追加する。

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

既に `mcpServers` がある場合は `"aidlc-guide"` エントリだけを既存オブジェクトに
足す。登録後に Claude Code を再起動すると `/mcp` に `aidlc-guide` が現れる。

### cwd について

Claude Code は MCP サーバをプロジェクトルートを cwd として spawn する。本サーバは
その cwd を workspaceRoot として `aidlc/spaces/<active-space>/intents/active-intent`
を解決するため、**別のワークスペースを対象にしたい場合は `cwd` を明示する**。

```json
{
  "mcpServers": {
    "aidlc-guide": {
      "command": "bun",
      "args": ["run", "/abs/path/to/aidlc-guide/packages/mcp-server/src/index.ts"],
      "cwd": "/abs/path/to/target-workspace"
    }
  }
}
```

Windows（Git Bash / PowerShell いずれも）では `command` は `bun` のままでよい。
パスは `/` 区切りで書ける。

### 動作確認

```
bun run packages/mcp-server/src/index.ts
```

JSON-RPC を待ち受けたまま常駐すれば起動成功。ワークスペースが未初期化でも
**起動は成功し**、各ツールが「アクティブなインテントがありません」を返す
（R-MS-3 — 起動失敗にしない）。stdout は JSON-RPC 専用チャネルなので、
ログはすべて stderr に出る。

## 制約

- 対応 State Version は **7 のみ**。それ以外は「解析不可」と明示して返す（C-T3 / NFR-6）。
- `read_artifact` はアクティブなインテントの記録ディレクトリ配下のみ。`../` traversal・
  記録外の絶対パス・シンボリックリンク脱出は reader-core の `guardPath` で拒否する
  （サーバ前段 + reader 内部の二重呼出 — BR-MS-2）。
- キャッシュを持たない。インテントを切り替えれば次の呼出から追従する（R-MS-4）。
