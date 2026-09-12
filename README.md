# AIDLC Guide

aidlc-workflows 2.8.0（State Version **8** / 33 ステージ）の現在地・成果物・次の一手を、初学者でも迷わず把握できるローカル開発者ツールです。

**対応 aidlc-workflows バージョン: 2.8.0**（State Version **8** / **33** ステージ、`docs/official-docs.manifest.json` のピンと同期）。upstream のバージョンが上がったら、同梱ドキュメントの同期と合わせて **この行も更新してください** — [互換性チェック](docs/maintenance/release-and-sync.md#互換性チェックdocs-以外の追随)が食い違いを検出し、同期 PR の本文に出します。

ヘッダーの本のアイコン「ドキュメント」を開き、「更新のハイライト」から[主な改善点の日本語ガイド](docs/overview/ja/release-highlights.md)を、「更新履歴一覧」から[全版の変更記録](docs/overview/en/changelog.md)をアプリ内で読めます。履歴は公式 CHANGELOG から同期し、版ごとに変更・修正・移行手順を表示します。AIDLC Guide拡張の更新は、歯車のアイコン「設定」→「更新を確認」から行います。2.8 系へのワークスペース更新は、更新画面の「このバージョンまで上げる」が公式ネイティブインストーラーと `aidlc config` を実行します。

**第一サーフェスは VS Code / Cursor 拡張**です。Dashboard は IDE 内の Webview に表示されます。

> 仮称です。詳細な要件は [docs/prd/PRD.md](docs/prd/PRD.md) を参照してください。

## なにを解くか

| 課題                             | このツールの答え                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| 今どのステージにいるか分からない | Now strip / Stage rail（IDE 内 Dashboard）                                           |
| 成果物が多すぎて全体像が見えない | Unit × Stage マトリクス + Markdown ビューア                                          |
| 工程の時間や手戻りを比較したい   | [効果測定](docs/guides/effectiveness.md)で案件別の時間・レビュー・品質チェックを比較 |
| 調べ物で本線セッションが濁る     | MCP サーバー + `btw` サイドセッション                                                |
| モブで参加者に状態を見せたい     | 拡張 Dashboard + [使い方ガイド](docs/guides/README.md)（Live Share）                 |

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

**Cursor** — 同様に VSIX を _Extensions: Install from VSIX_ でインストール。

自分でビルドしない場合は [Releases](https://github.com/otomatty/aidlc-guide/releases) から `.vsix` を落として同じ手順でインストールできます（`main` へのマージから自動生成）。

### 3. 初回 Setup（1 回）

1. 開発するフォルダを開く。未設定の場合はセットアップ画面が自動で開きます。
2. AI-DLC を使うツールを1つ選び、「インストールして設定」をクリックします。本体がない場合は公式のネイティブ版 2.8.1 を導入し、選択したツールを設定します。
3. 必要なら「文書参照を有効にする」をクリックします。この連携のみ Bun が必要です。
4. 設定を完了してダッシュボードへ進みます。Intent の作成前でも完了でき、文書参照はあとから追加できます。

完了状態はフォルダごとに記録します。途中で閉じた場合は次回起動時に再表示されます。手動で開く場合はコマンドパレットの **`AIDLC Guide: Setup`** を使います。同梱ドキュメントの対象版は冒頭のピンを参照してください。

インストール画面は、ダッシュボードの **設定 → aidlc-workflowsのインストール → インストール画面を開く** からも開けます。現在対応している本体は複数ハーネスの設定に未対応のため、複数選択や設定済みプロジェクトへの別ツール追加は、書き込み前に停止します。設定済みのツールはスキップし、設定内容を保持します。

Claude Code / Cursor で AI-DLC について質問すると、内蔵文書を検索して原文を確認し、文書名・節・同梱版・参照リンク付きで回答するよう案内します。使い方と CLI は [文書への質問ガイド](docs/guides/asking-aidlc.md) を参照してください。

### 4. 日常利用（1 アクション）

コマンドパレット → **`AIDLC Guide: Open`**

またはステータスバーの `AIDLC Guide` / 現在ステージ名をクリック。

## 拡張コマンド

| コマンド                    | 用途                                                |
| --------------------------- | --------------------------------------------------- |
| `AIDLC Guide: Open`         | IDE 内 Dashboard                                    |
| `AIDLC Guide: Setup`        | AI-DLC の導入・プロジェクト設定・任意の文書参照連携 |
| `AIDLC Guide: Register MCP` | Claude Code / Cursor の MCP と文書参照 Skill を登録 |
| `AIDLC Guide: Ask (btw)`    | 読取専用サイドセッション（ターミナル）              |
| `AIDLC Guide: Ask one-shot` | ヘッドレス一問一答                                  |

## パッケージ

| パッケージ                      | 役割                                    |
| ------------------------------- | --------------------------------------- |
| `@aidlc-guide/api-core`         | 読取 API（HTTP / postMessage 共通）     |
| `@aidlc-guide/reader-core`      | `aidlc-state.md`・成果物・監査の読取    |
| `@aidlc-guide/vscode-extension` | VS Code / Cursor 拡張（第一サーフェス） |
| `@aidlc-guide/dashboard`        | React UI（Webview）                     |
| `@aidlc-guide/mcp-server`       | Claude Code 向け MCP                    |
| `@aidlc-guide/btw`              | サイド質問 CLI                          |
| `@aidlc-guide/docs-bridge`      | ステージ slug → 公式 docs               |

## 設定

ワークスペースルートの [`aidlc-guide.config.json`](aidlc-guide.config.json) で docs 連携を設定します（全ステージ分のキーを同梱）。

| キー           | 用途                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| `docsRepoPath` | 公式 docs のルート（excerpt 読取）。相対パスは config ファイル基準                            |
| `docsBaseUrl`  | （任意）ベース URL。`stageDocs` 未設定ステージで bridge-map の相対パスと結合                  |
| `stageDocs`    | ステージ slug → 開き先 URL（Confluence / Notion / GitHub など `http(s)://…`）。空文字は未設定 |
| `projectLinks` | ヘッダーに出す追加リンク `{ label, target }[]`                                                |

「docs を開く」の優先順位: `stageDocs[slug]` → `docsBaseUrl` + map パス → 拡張ではワークスペース上のファイルを開く。

## 前提

- **VS Code 1.100 以上**（拡張ホストの Node 20 を前提にバンドルしているため）。Cursor など VS Code 本体に遅れて追随するフォークでも、この下限に到達したビルドであればインストールできます
- [bun](https://bun.sh) — MCP / `btw` で使用（拡張の Dashboard 表示自体は Node の api-core のみ）
- 対象ワークスペースに aidlc-workflows **2.8.0**（State Version **8**）。State Version **7** は閲覧互換。それ以外は解析不可表示
- MCP / `btw` 利用時は [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI

## 開発

```bash
bun run test                          # Vitest（素の `bun test` は Bun のランナーで、dashboard を拾わない）
bun run lint                          # Biome + actionlint
bun run lint:fix                      # Biome の安全な修正・import 整理
bun run format                        # Biome + Prettier の整形
bun run check                         # 品質チェック全体（下記）
bun run build:extension               # Webview + 拡張バンドル
```

`bun run check` は Lint、整形検査、型チェック、文書索引の整合性検査、カバレッジ付きテスト、監査ログのシャード検査、依存関係の脆弱性監査を順に実行します。

依存更新、Lint・整形、main 保護の設定は [依存更新と品質チェック](docs/maintenance/dependency-quality.md) を参照してください。

## リリースと upstream 同期

`main` にマージすると VSIX がビルドされ、GitHub Releases に添付されます（既定は patch リリース。`release:major` / `release:minor` / `release:skip` ラベルで上げ幅を変更）。同梱の公式ドキュメントと `.claude/` / `.cursor/` シェルは、毎日 upstream と比較して同期 PR が出ます。

詳細は [docs/maintenance/release-and-sync.md](docs/maintenance/release-and-sync.md) を参照してください。

## 設計上の約束

- **読取専用原則**: `*-questions.md` の `[Answer]:` 記入、明示的な Setup 操作による公式インストーラー・プロジェクト設定、MCP 設定・文書参照 Skill の登録以外は書込まない
- **aidlc-workflows 本体は触らない**
- **クラウド / AWS 不使用**（ローカル専用）

## ドキュメント

| 文書                                                                         | 内容                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------- |
| [docs/guides/README.md](docs/guides/README.md)                               | **使い方ガイド一覧**（ユースケース別）         |
| [docs/prd/PRD.md](docs/prd/PRD.md)                                           | 要件・マイルストーン                           |
| [AGENTS.md](AGENTS.md)                                                       | Cursor 上の AI-DLC ワークフロー                |
| [docs/maintenance/release-and-sync.md](docs/maintenance/release-and-sync.md) | リリース / upstream 同期の詳細（メンテナ向け） |
