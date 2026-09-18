# AIDLC Guide

aidlc-workflows 2.9.0（State Version **8** / 33 ステージ）の現在地・成果物・次の一手を、初学者でも迷わず把握できるローカル開発者ツールです。

**対応 aidlc-workflows バージョン: 2.9.0**（State Version **8** / **33** ステージ、`docs/official-docs.manifest.json` のピンと同期）。バージョンの更新漏れと Doctor の検証データ不足は、通常の `bun run check` で検出します。[互換性チェックと同期手順](docs/maintenance/release-and-sync.md#互換性チェックdocs-以外の追随)を参照してください。

この **2.9.0 は同梱ドキュメントの同期対象・互換性の基準バージョン**です。**インストール・更新の導入先も 2.9.0** で、`WORKFLOWS_TARGET_VERSION` が指定します。State Version **8** の既存環境は 2.8.0 / 2.8.1 / 2.8.2 / 2.9.0 を閲覧でき、GUIでのツール追加・更新は導入先の 2.9.0 に揃えます。State Version **7** は閲覧互換で、Guide が状態ファイルを移行することはありません。

ヘッダーの「ドキュメント」を開くと、「ワークフロー」と「拡張機能」への入口をまとめたトップページを表示します。「ドキュメント一覧」の2つのタブでも分類を切り替えられます。「ワークフロー」タブでは「公式ドキュメント」と「更新履歴」を開閉できます。「更新履歴」の「更新のハイライト」から[主な改善点の日本語ガイド](docs/overview/ja/release-highlights.md)を、「更新履歴一覧」から[全バージョンの変更記録](docs/overview/en/changelog.md)をアプリ内で読めます。履歴は公式 CHANGELOG から同期し、バージョンごとに変更・修正・移行手順を表示します。AIDLC Guide拡張の更新は、歯車のアイコン「設定」→「更新を確認」から行います。2.9.0 へのワークスペース更新は、更新画面の「すべてのツールを 2.9.0 に更新」が公式ネイティブインストーラーと `aidlc config` を実行します。

**第一サーフェスは VS Code / Cursor 拡張**です。Dashboard は IDE 内の Webview に表示されます。

ステージ一覧では、選択中の作業に Claude Code の使用記録がある場合、ステージごとの実モデル名を表示します。取得に成功して記録がなければ「デフォルト」と表示します。取得中は「読み込み中」、通信に失敗した場合や使用記録の取得が無効な場合は「取得できません」と表示します。表示元の選択は不要です。複数のモデルが記録されていれば併記します。使用記録は再実行やレビューを含む累計で、現在のモデルや担当別の割り当てを示すものではありません。新しいモデル名も記録から表示でき、モデル一覧への登録は不要です。この表示からモデルは変更されません。

ヘッダーの「カスタマイズ」では、開発ルール・ナレッジ・工程・エージェント・品質チェック・プラグインを一つの下書きで編集できます。差分確認と手動適用、設定ファイルの選択取り込み・配布に対応します。正式適用にはカスタマイズ契約に対応するエンジンが必要です。利用手順と対応条件は[カスタマイズガイド](docs/guides/customization.md)を参照してください。

> 仮称です。詳細な要件は [docs/prd/PRD.md](docs/prd/PRD.md) を参照してください。

## なにを解くか

| 課題                             | このツールの答え                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 今どのステージにいるか分からない | Now strip / Stage rail（IDE 内 Dashboard）                                                                          |
| 成果物が多すぎて全体像が見えない | Unit × Stage マトリクス + Markdown ビューア                                                                         |
| 工程の時間や手戻りを比較したい   | [効果測定](docs/guides/effectiveness.md)で案件別の時間・レビュー・品質チェックを比較                                |
| ステージの時間の意味を知りたい   | [時間の算出方法](docs/guides/stage-timing.md)で承認待ち・明示的な中断を分け、長いログ空白を除外する計算と限界を図解 |
| 調べ物で本線セッションが濁る     | MCP サーバー + `btw` サイドセッション                                                                               |
| モブで参加者に状態を見せたい     | 拡張 Dashboard + [使い方ガイド](docs/guides/README.md)（Live Share）                                                |

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

1. 開発するフォルダを開き、コマンドパレットから **`AIDLC Guide: Setup`** を実行します。
2. 「CLI をインストール・設定」で、このマシンの `aidlc` コマンドを準備します。既存プロジェクトに参加する場合は、そのプロジェクトのバージョンに合わせます。新しい統合ターミナルには PATH を反映し、「新しいターミナルで CLI を確認」から動作を確認できます。Windows の Git Bash では `aidlc.cmd --version` を使い、コマンド プロンプトと PowerShell では `aidlc --version` で確認できます。外部ターミナルの PATH は公式手順に沿って設定してください。
3. 新規プロジェクトでは、AI-DLC を使うツールを選び「プロジェクトを設定」を実行します。既存プロジェクトでは共有済みの設定を確認します。参加時に共有エンジンを更新する必要はありません。
4. `aidlc doctor` で環境を診断し、「セットアップを完了」でダッシュボードへ進みます。Intent の作成前でも完了できます。

完了状態はフォルダごとに記録します。完了後は、CLIや設定に問題が見つかってもセットアップを自動表示しません。**`AIDLC Guide: Open`** は完了前ならセットアップ、完了後ならダッシュボードを開きます。設定画面または **`AIDLC Guide: Setup`** からいつでも開き直せます。拡張の起動だけではセットアップ画面は開きません。

信頼済みのフォルダでは、登録済みの文書参照連携を起動時に更新します。拡張の更新で変わる MCP の参照先と、拡張が管理する Skill を更新する処理で、セットアップ画面は開きません。

ダッシュボードの設定には、**セットアップ**、**更新・修復**、**ツール追加** の入口があります。更新画面では **このマシンの CLI** と **プロジェクトのエンジン** を個別に更新でき、拡張機能の更新確認も行えます。CLIの更新は共有ファイルを変更せず、リポジトリの更新は準備済みの実行環境を使って全ツールと固定バージョンを揃えます。コマンドパレットの `AIDLC Guide: Install Workflows` / `Update Workflows` も各画面を開きます。

インストール・更新の導入先は `packages/shared-types/src/workflows-management.ts` の `WORKFLOWS_TARGET_VERSION` で共通管理します。同梱ドキュメントの `sourceVersion` は更新判定には使いません。インストールでは複数ツールを選択でき、更新では対象プロジェクトに設定済みの全ツールを同じバージョンへ揃えます。古い設定へのツール追加は全体更新の完了後に行い、新しい設定からのダウングレードは行いません。導入先は拡張で検証した固定バージョンであり、上流の最新バージョンへ自動追従しません。

既存プロジェクトで必要なCLIが利用できる場合は、そのバージョンを維持します。未導入のバージョンを自動取得できるのは拡張で検証済みの 2.9.0 に限ります。マシンの既定CLIがそれより新しい場合も、更新画面から 2.9.0 を追加導入でき、処理後は新しい既定バージョンを維持します。それ以外の固定バージョンは公式手順で準備してください。

Guide は公式コマンドで生成した設定からツールごとのファイルを取り込み、既存の共通設定・成果物を保持します。更新後は全ツールのバージョン・プロジェクトの固定バージョン・最終診断を確認します。失敗時は適用状況、復元結果、次の操作を表示します。設定反映後の診断だけが失敗した場合は「Doctor を再実行」で確認できます。進行中の AI-DLC ワークフローがある場合は、完了してからツールの追加・更新を行ってください。

アクティブなスペースとプラグイン選択も引き継ぎます。プラグインを構成済みの場合は元パッケージを検証し、同じ構成を再生成します。元パッケージを確認できない場合は既存設定を保持して停止します。「診断を実行」では設定済みの各ツールを検査し、ツール名付きで結果を表示します。

設定フォルダが競合する **GitHub Copilot と opencode**、**Kiro CLI と Kiro IDE** は、それぞれ同時設定の対象外です。一部のツールで設定に失敗しても、完了したツールは保持し、失敗したツールを再試行できます。

同じ拡張ホストで複数フォルダを開いている場合も、インストール・更新は一度に1件だけ実行できます。PCの既定バージョンを復元して処理が完了するまで、他フォルダでの実行は待ってから再試行してください。

ドキュメントのトップページから Claude Code / Cursor / GitHub Copilot の CLI を使って質問できます。回答の参照番号を押すと、実際の内蔵文書に移動して根拠をハイライトします。「回答に戻る」で入力と回答を保ったまま戻れます。Claude Code / Cursor のチャットから質問するための MCP と参照用 Skill も用意しています。必要な CLI、認証、使い方は [文書への質問ガイド](docs/guides/asking-aidlc.md) を参照してください。

### 4. 日常利用（1 アクション）

コマンドパレット → **`AIDLC Guide: Open`**

またはステータスバーの `AIDLC Guide` / 現在ステージ名をクリック。

## 拡張コマンド

| コマンド                    | 用途                                                |
| --------------------------- | --------------------------------------------------- |
| `AIDLC Guide: Open`         | IDE 内 Dashboard                                    |
| `AIDLC Guide: Setup`        | CLI の準備・プロジェクトの環境構築・診断            |
| `AIDLC Guide: Register MCP` | Claude Code / Cursor の MCP と文書参照 Skill を登録 |
| `AIDLC Guide: Ask (btw)`    | 読取専用サイドセッション（ターミナル）              |
| `AIDLC Guide: Ask one-shot` | ヘッドレス一問一答                                  |

## パッケージ

| パッケージ                      | 役割                                              |
| ------------------------------- | ------------------------------------------------- |
| `@aidlc-guide/api-core`         | 読取・カスタマイズ API（HTTP / postMessage 共通） |
| `@aidlc-guide/reader-core`      | `aidlc-state.md`・成果物・監査の読取              |
| `@aidlc-guide/vscode-extension` | VS Code / Cursor 拡張（第一サーフェス）           |
| `@aidlc-guide/dashboard`        | React UI（Webview）                               |
| `@aidlc-guide/mcp-server`       | Claude Code 向け MCP                              |
| `@aidlc-guide/btw`              | サイド質問 CLI                                    |
| `@aidlc-guide/docs-bridge`      | ステージ slug → 公式 docs                         |

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
- 対象ワークスペースの State Version **8** が標準対応。文書・互換性の基準バージョンとインストール・更新の導入先は 2.9.0。既存の 2.8.0 / 2.8.1 / 2.8.2 は閲覧でき、ツールを追加する場合は先に全体を 2.9.0 へ更新します。導入先より新しい設定へのGUI操作は停止し、ダウングレードしません。State Version **7** は閲覧互換、それ以外は解析不可表示
- MCP / `btw` 利用時は [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI

## 開発

```bash
bun run test                          # Vitest（素の `bun test` は Bun のランナーで、dashboard を拾わない）
bun run lint                          # oxlint（@shadcn/lint 含む）+ actionlint
bun run lint:fix                      # oxlint の安全な自動修正
bun run format                        # Prettier の整形
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
