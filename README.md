# AIDLC Guide

aidlc-workflows 2.6.2（State Version **8** / 33 ステージ）の現在地・成果物・次の一手を、初学者でも迷わず把握できるローカル開発者ツールです。

**第一サーフェスは VS Code / Cursor 拡張**です。Dashboard は IDE 内の Webview に表示され、ブラウザ起動は Mob LAN 共有などの副経路です。

> 仮称です。詳細な要件は [docs/prd/PRD.md](docs/prd/PRD.md) を参照してください。

## なにを解くか

| 課題 | このツールの答え |
|------|------------------|
| 今どのステージにいるか分からない | Now strip / Stage rail（IDE 内 Dashboard） |
| 成果物が多すぎて全体像が見えない | Unit × Stage マトリクス + Markdown ビューア |
| 調べ物で本線セッションが濁る | MCP サーバー + `btw` サイドセッション |
| モブで参加者に状態を見せたい | 拡張 Dashboard + [使い方ガイド](docs/guides/README.md)（Live Share / LAN） |

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  VS Code / Cursor 拡張 (packages/vscode-extension)       │
│  ├─ Webview: Dashboard UI                                │
│  ├─ api-core (in-process, Node)                          │
│  └─ コマンド: Setup / btw / MCP / LAN Share              │
└───────────────────────────┬─────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   reader-core         docs-bridge      dashboard-server
   (読取)              (docs 対応)      (Bun HTTP — 副経路)
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
code --install-extension packages/vscode-extension/aidlc-guide-0.1.0.vsix
# または F5 で Extension Development Host からデバッグ起動
```

**Cursor** — 同様に VSIX を *Extensions: Install from VSIX* でインストール。

自分でビルドしない場合は [Releases](https://github.com/otomatty/aidlc-guide/releases) から `.vsix` を落として同じ手順でインストールできます（`main` へのマージから自動生成 — [リリース（CI/CD）](#リリースcicd) 参照）。

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
| `AIDLC Guide: Share on LAN` | ブラウザ Dashboard を `--host` で起動（参加者向け副経路） |

## パッケージ

| パッケージ | 役割 |
|-----------|------|
| `@aidlc-guide/api-core` | 読取 API（HTTP / postMessage 共通） |
| `@aidlc-guide/reader-core` | `aidlc-state.md`・成果物・監査の読取 |
| `@aidlc-guide/vscode-extension` | VS Code / Cursor 拡張（第一サーフェス） |
| `@aidlc-guide/dashboard` | React UI（Webview / ブラウザ兼用） |
| `@aidlc-guide/dashboard-server` | Bun HTTP サーバー（副経路） |
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

## 副経路: ブラウザ Dashboard

Mob 参加者が拡張未導入の場合や、HTTP で直接見たい場合:

```bash
bun run dashboard
# LAN 公開
bun packages/dashboard-server/src/cli.ts --host
```

## 前提

- [bun](https://bun.sh) — MCP / btw / LAN 副経路で使用（拡張の Dashboard 表示自体は Node の api-core のみ）
- 対象ワークスペースに aidlc-workflows **2.6.2**（State Version **8**）。State Version **7** は閲覧互換。それ以外は解析不可表示
- MCP / `btw` 利用時は [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI

## 開発

```bash
bun test                              # Vitest
bun run lint                          # Biome
bun run check                         # lint + tsc + test + audit
bun run build:extension               # Webview + 拡張バンドル
bun run build:dashboard               # ブラウザ用 SPA のみ
```

## リリース（CI/CD）

`main` にマージすると [`.github/workflows/release.yml`](.github/workflows/release.yml) が走り、VSIX をビルドして GitHub Releases に添付します。手動作業はありません。

**リリースのトリガーはバージョン変更**です。マージのたびに出すのではなく、`packages/vscode-extension/package.json` の `version` に対応する git タグ（`v<version>`）が未作成のときだけ公開します。

通常は PR にラベルを付けます。[`.github/workflows/bump-extension-version.yml`](.github/workflows/bump-extension-version.yml) がマージ後にバージョンを上げ、そのコミットから Release を出します。

| ラベル | 例（いま `0.2.0`） |
|--------|-------------------|
| `release:patch` | `0.2.1` |
| `release:minor` | `0.3.0` |
| `release:major` | `1.0.0` |

ラベルは 1 つだけにしてください。2 つ付いていると推測せず失敗します。ラベル無しのマージはバージョン据え置きです。PR 内で `version` を既に上げている場合はラベルがあっても二重に上げません（従来の手動 bump もそのまま使えます）。

```bash
# 手動で出すとき（ラベルの代わり）
jq '.version="0.2.1"' packages/vscode-extension/package.json > tmp && mv tmp packages/vscode-extension/package.json
# → main へマージ → タグ v0.2.1 + Release + aidlc-guide-0.2.1.vsix が自動生成される
```

`release:patch` / `release:minor` / `release:major` はリポジトリに作成済みです。`main` が「PR 必須」で保護されているときは、`github-actions[bot]` が `packages/vscode-extension/package.json` を push できるよう例外を付けてください。

判定の基準は「**公開済み Release があるか**」です（タグの有無だけでは判定しません）。

| 挙動 | 条件 |
|------|------|
| リリースする | `v<version>` タグが無い |
| リリースし直す | タグはあるが公開済み Release が無い（前回が途中で落ちた状態） |
| 何もしない | `v<version>` の Release が公開済み（= バージョン据え置きのマージ） |
| pre-release として出す | バージョンに `-` が含まれる（例 `0.2.0-rc.1`） |

ジョブは `decide`（タグ判定）→ `build`（`bun run check` + VSIX）→ `publish`（Release 作成）の 3 段です。

- 公開前に `bun run check`（単一の品質ゲート）を通します。赤ければリリースしません。
- 書込み権限は `publish` ジョブだけに付きます。`build` は `contents: read` かつ `persist-credentials: false` で、checkout もしない `publish` が artifact を受け取って公開します。
- **途中で失敗したら Actions から再実行してください。** `gh release create` は「下書き作成 → asset upload → 公開」の別々の API 呼出しなので中断は下書きを残します。`publish` は残骸の下書きを破棄してから作り直し、公開済みなら何もせず正常終了します。タグが残るかどうかに関係なく再実行で回復できるよう、ゲート自体が「公開済み Release の有無」を見ています。
- 手動実行（`workflow_dispatch`）は `main` 以外では失敗します。feature ブランチのバージョンが公開されるのを防ぐためです。
- 公開後に asset が実際に Release へ載っているかを検証します。載っていなければジョブは失敗します。
- 既存タグが別コミットを指している場合は公開せず失敗します（タグと VSIX の出所が食い違う Release を作らないため）。タグを打ち直すか、バージョンを上げてください。
- 排他はワークフロー全体ではなくタグ単位（`release-v0.2.0`）です。全体で 1 グループにすると、連続した version bump のうち待機中の run が後続に取り消され、そのバージョンが公開されないままになります。
- ラベル付きマージは bump ワークフローがバージョンを上げたあと、同じ実行から `release.yml` を呼びます。`GITHUB_TOKEN` の push は別ワークフローを起動しないためです。

## 設計上の約束

- **読取専用原則**: `*-questions.md` の `[Answer]:` 記入と Setup 時の `.mcp.json` マージ以外は書込まない
- **aidlc-workflows 本体は触らない**
- **クラウド / AWS 不使用**（ローカル専用）
- Mob の listen 既定は loopback。LAN 公開は明示操作のみ

## ドキュメント

| 文書 | 内容 |
|------|------|
| [docs/guides/README.md](docs/guides/README.md) | **使い方ガイド一覧**（ユースケース別） |
| [docs/prd/PRD.md](docs/prd/PRD.md) | 要件・マイルストーン |
| [AGENTS.md](AGENTS.md) | Cursor 上の AI-DLC ワークフロー |
