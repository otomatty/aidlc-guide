# AIDLC Guide

aidlc-workflows 2.7.0（State Version **8** / 33 ステージ）の現在地・成果物・次の一手を、初学者でも迷わず把握できるローカル開発者ツールです。

**対応 aidlc-workflows バージョン: 2.7.0**（State Version **8** / **33** ステージ、`docs/official-docs.manifest.json` のピンと同期）。upstream のバージョンが上がったら、同梱ドキュメントの同期と合わせて **この行も更新してください** — [互換性チェック](docs/maintenance/release-and-sync.md#互換性チェックdocs-以外の追随)が食い違いを検出し、同期 PR の本文に出します。

**第一サーフェスは VS Code / Cursor 拡張**です。Dashboard は IDE 内の Webview に表示されます。

> 仮称です。詳細な要件は [docs/prd/PRD.md](docs/prd/PRD.md) を参照してください。

## なにを解くか

| 課題 | このツールの答え |
|------|------------------|
| 今どのステージにいるか分からない | Now strip / Stage rail（IDE 内 Dashboard） |
| 成果物が多すぎて全体像が見えない | Unit × Stage マトリクス + Markdown ビューア |
| 調べ物で本線セッションが濁る | MCP サーバー + `btw` サイドセッション |
| モブで参加者に状態を見せたい | 拡張 Dashboard + [使い方ガイド](docs/guides/README.md)（Live Share） |

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  VS Code / Cursor 拡張 (packages/vscode-extension)       │
│  ├─ Webview: Dashboard UI                                │
│  ├─ api-core (in-process, Node)                          │
│  └─ コマンド: Setup / btw / MCP                          │
└───────────────────────────┬─────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
        reader-core                  docs-bridge
        (読取)                       (docs 対応)
```

## クイックスタート（拡張）

### 1. ビルド（開発者向け）

```bash
bun install
bun run build:extension     # dist/ + media/ のみ（VSIX は作らない）
bun run package:extension   # VSIX を作成（packages/vscode-extension/*.vsix）
```

F5 で Extension Development Host を使うだけなら `build:extension` で足ります。インストール用の `.vsix` が欲しいときは `package:extension` を使います。

### 2. 拡張のインストール

**VS Code**

```bash
code --install-extension packages/vscode-extension/aidlc-guide-*.vsix
# または F5 で Extension Development Host からデバッグ起動
```

**Cursor** — 同様に VSIX を *Extensions: Install from VSIX* でインストール。

自分でビルドしない場合は [Releases](https://github.com/otomatty/aidlc-guide/releases) から `.vsix` を落として同じ手順でインストールできます（`main` へのマージから自動生成）。

### 3. 初回 Setup（1 回）

1. `aidlc/` があるワークスペースを開く
2. コマンドパレット → **`AIDLC Guide: Setup`**
3. 「MCP をこのワークスペースに登録」をクリック

### 4. 日常利用（1 アクション）

コマンドパレット → **`AIDLC Guide: Open`**

またはステータスバーの `AIDLC Guide` / 現在ステージ名をクリック。

## 拡張コマンド

| コマンド | 用途 |
|---------|------|
| `AIDLC Guide: Open` | IDE 内 Dashboard |
| `AIDLC Guide: Setup` | 前提チェック + MCP 登録ウィザード |
| `AIDLC Guide: Register MCP` | `.mcp.json` に `aidlc-guide` をマージ |
| `AIDLC Guide: Ask (btw)` | 読取専用サイドセッション（ターミナル） |
| `AIDLC Guide: Ask one-shot` | ヘッドレス一問一答 |

## パッケージ

| パッケージ | 役割 |
|-----------|------|
| `@aidlc-guide/api-core` | 読取 API（HTTP / postMessage 共通） |
| `@aidlc-guide/reader-core` | `aidlc-state.md`・成果物・監査の読取 |
| `@aidlc-guide/vscode-extension` | VS Code / Cursor 拡張（第一サーフェス） |
| `@aidlc-guide/dashboard` | React UI（Webview） |
| `@aidlc-guide/mcp-server` | Claude Code 向け MCP |
| `@aidlc-guide/btw` | サイド質問 CLI |
| `@aidlc-guide/docs-bridge` | ステージ slug → 公式 docs |

## 設定

ワークスペースルートの [`aidlc-guide.config.json`](aidlc-guide.config.json) で docs 連携を設定します（全ステージ分のキーを同梱）。

| キー | 用途 |
|------|------|
| `docsRepoPath` | 公式 docs のルート（excerpt 読取）。相対パスは config ファイル基準 |
| `docsBaseUrl` | （任意）ベース URL。`stageDocs` 未設定ステージで bridge-map の相対パスと結合 |
| `stageDocs` | ステージ slug → 開き先 URL（Confluence / Notion / GitHub など `http(s)://…`）。空文字は未設定 |
| `projectLinks` | ヘッダーに出す追加リンク `{ label, target }[]` |

「docs を開く」の優先順位: `stageDocs[slug]` → `docsBaseUrl` + map パス → 拡張ではワークスペース上のファイルを開く。

## 前提

- **VS Code 1.122 以上**（拡張ホストの Node 22 を前提にバンドルしているため）。Cursor は VS Code 本体より数ヶ月遅れて追随するため、この下限に未到達のビルドではインストールできません
- [bun](https://bun.sh) — MCP / `btw` で使用（拡張の Dashboard 表示自体は Node の api-core のみ）
- 対象ワークスペースに aidlc-workflows **2.7.0**（State Version **8**）。State Version **7** は閲覧互換。それ以外は解析不可表示
- MCP / `btw` 利用時は [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI

## 開発

```bash
bun run test                          # Vitest（素の `bun test` は Bun のランナーで、dashboard を拾わない）
bun run lint                          # Biome
bun run check                         # lint + tsc + test + audit
bun run build:extension               # Webview + 拡張バンドル
```

## リリースと upstream 同期

`main` にマージすると VSIX がビルドされ、GitHub Releases に添付されます（既定は patch リリース。`release:major` / `release:minor` / `release:skip` ラベルで上げ幅を変更）。同梱の公式ドキュメントと `.claude/` / `.cursor/` シェルは、毎日 upstream と比較して同期 PR が出ます。

詳細は [docs/maintenance/release-and-sync.md](docs/maintenance/release-and-sync.md) を参照してください。

## 設計上の約束

- **読取専用原則**: `*-questions.md` の `[Answer]:` 記入と Setup 時の `.mcp.json` マージ以外は書込まない
- **aidlc-workflows 本体は触らない**
- **クラウド / AWS 不使用**（ローカル専用）

## ドキュメント

| 文書 | 内容 |
|------|------|
| [docs/guides/README.md](docs/guides/README.md) | **使い方ガイド一覧**（ユースケース別） |
| [docs/prd/PRD.md](docs/prd/PRD.md) | 要件・マイルストーン |
| [AGENTS.md](AGENTS.md) | Cursor 上の AI-DLC ワークフロー |
| [docs/maintenance/release-and-sync.md](docs/maintenance/release-and-sync.md) | リリース / upstream 同期の詳細（メンテナ向け） |
