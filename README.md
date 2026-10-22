# AIDLC Guide

社内向けの説明には、[実画面付きの紹介資料](docs/introducing/aidlc-guide-introduction.md)を利用できます。[Confluenceへの掲載手順とオンボーディング文案](docs/introducing/README.md)も用意しています。

aidlc-workflows 2.11.1（State Version **8** / 33 ステージ）の現在地・成果物・次の一手を、初学者でも迷わず把握できるローカル開発者ツールです。

**対応 aidlc-workflows バージョン: 2.11.1**（State Version **8** / **33** ステージ、`docs/official-docs.manifest.json` のピンと同期）。バージョンの更新漏れと Doctor の検証データ不足は、通常の `bun run check` で検出します。[互換性チェックと同期手順](docs/maintenance/release-and-sync.md#互換性チェックdocs-以外の追随)を参照してください。

この **2.11.1 は同梱ドキュメントの同期対象・互換性の基準であり、インストール・更新の導入先**です。`WORKFLOWS_TARGET_VERSION` が指定します。Guide はこのバージョンの形式だけを読みます。プロジェクトのツール・固定バージョン・この PC のエンジンのいずれかが 2.11.1 と一致しない場合は更新の案内画面を表示し、更新が終わるまで同梱ドキュメントの閲覧・更新・Doctor 以外は使えません。古いプロジェクトにはプロジェクトの更新を、新しいプロジェクトには Guide の更新を案内します。対応する Guide がまだない場合はその旨と、2.11.1 に戻す公式コマンドを表示します（Guide は戻す処理を実行しません）。この PC のエンジンだけを手動で新しくした場合、固定バージョンのあるプロジェクトはそのまま使えます。固定していないプロジェクトには 2.11.1 への固定を案内します。プレビュー版も壊れたファイルとは扱わず、安定版ではないため対応外と案内します（[バージョン確認の設計](docs/maintenance/version-gate-design.md)）。

**第一サーフェスは VS Code / Cursor 拡張**です。Dashboard は IDE 内の Webview に表示されます。同じ画面を `bun run dashboard` でこのマシンのブラウザ（`127.0.0.1`）にも表示できます。

> 仮称です。詳細な要件は [docs/prd/PRD.md](docs/prd/PRD.md) を参照してください。

## なにを解くか

| 課題                             | このツールの答え                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 今どのステージにいるか分からない | [ステージ一覧](#ステージ一覧)（現在のステージと全ステージの状態）                                                                             |
| 成果物が多すぎて全体像が見えない | 成果物マトリクス（Unit × ステージ）と[成果物ビューア](#成果物ビューア)                                                                        |
| 工程の時間や手戻りを比較したい   | [効果測定](docs/guides/effectiveness.md)で案件別の時間・レビュー・品質チェックを比較                                                          |
| ステージの時間の意味を知りたい   | [時間の算出方法](docs/guides/stage-timing.md)で承認待ち・明示的な中断を分け、長いログ空白を除外する計算、次の承認ゲートまでの推定と限界を図解 |
| 調べ物で本線セッションが濁る     | [MCP サーバー](docs/guides/side-questions.md)と[ドキュメント](#ドキュメント)の質問欄                                                          |
| 自分のブラウザで状態を見たい     | `bun run dashboard`（`127.0.0.1`）と [使い方ガイド](docs/guides/README.md)                                                                    |

## 主な機能

画面の上部で Space と案件（インテント）を選び、右上のメニューから各画面へ移動します。以下の画像は、ブラウザ版の Dashboard でこのリポジトリ自身の開発記録（`260720-aidlc-guide-prd`）を表示して撮影しました（2026年10月22日）。画面の数値はこの案件の記録であり、導入効果の実績値ではありません。

### ステージ一覧

![現在のステージと、フェーズごとのステージの状態・担当モデル・所要時間を表示したステージ一覧](docs/images/readme/01-stage-list.jpg)

現在のステージと、全ステージの状態・目的・所要時間を表示します。上部の現在のステージを開くと、フェーズ・スコープ・完了数と、次の承認までの時間を確認できます。Construction では Unit ごとの進み具合を表示し、画面下部の成果物マトリクスで Unit × ステージの成果物を一覧できます。上部の「Space」を切り替えると、その Space のインテント・成果物・作業時間を読み直します。

各ステージの「担当」には、選択中の作業に Claude Code の使用記録がある場合、実モデル名を表示します。取得に成功して記録がなければ「デフォルト」、取得中は「読み込み中」、通信に失敗した場合や使用記録の取得が無効な場合は「取得できません」と表示します。複数のモデルが記録されていれば併記します。使用記録は再実行やレビューを含む累計で、現在のモデルや担当別の割り当てを示すものではありません。「レビュワー」と「補助」は個別の使用記録がないため「デフォルト」と表示します。この表示からモデルは変更されません。

### ステージ詳細

![intent-capture の目的・入力・出力・担当エージェント・ゲート要求を表示したステージ詳細](docs/images/readme/02-stage-detail.jpg)

ステージを選ぶと、目的・入力・出力・担当エージェントと、承認時に確認するゲート要求を表示します。「時間」タブでは作業時間・承認待ち・中断などの内訳を確認できます（[時間の算出方法](docs/guides/stage-timing.md)）。前後のステージへは右上の矢印で移動し、「docs を開く」で公式ドキュメントの該当箇所を開きます。

### 成果物ビューア

![Unit とファイルのタブで成果物を切り替え、Markdown を整形して表示した成果物ビューア](docs/images/readme/03-artifact.jpg)

成果物マトリクスのセルを選ぶと、その Unit × ステージの成果物を詳細パネルに表示します。Unit とファイルのタブで切り替えて読めます。Markdown は見出し・表・コードを整形して表示し、Mermaid と、成果物と同じフォルダーにある SVG の図も表示します。

### ドキュメント

![ドキュメントへの質問欄と、ワークフロー・拡張機能それぞれのドキュメントへの入口](docs/images/readme/04-docs.jpg)

右上のメニューの「ドキュメント」を開くと、質問欄と「ワークフロー」「拡張機能」への入口をまとめたトップページを表示します。「ドキュメント一覧」の2つのタブでも分類を切り替えられます。

- **ワークフロー**: aidlc-workflows の公式ドキュメント・更新履歴・運用Tipsを読めます。「更新履歴」の「更新のハイライト」から[主な改善点の日本語ガイド](docs/overview/ja/release-highlights.md)を、「更新履歴一覧」から[全バージョンの変更記録](docs/overview/en/changelog.md)を開けます。履歴は公式 CHANGELOG から同期し、バージョンごとに変更・修正・移行手順を表示します。
- **拡張機能**: このリポジトリの[使い方ガイド](docs/guides/README.md)をアプリ内で読めます。
- **質問**: Claude Code / Cursor / GitHub Copilot の CLI を使い、内蔵文書を根拠に回答します。前の回答を踏まえて続けて質問できます。回答の参照番号を押すと実際の文書に移動して根拠をハイライトし、「回答に戻る」で入力と回答を保ったまま戻れます。Claude Code / Cursor のチャットから質問するための MCP と参照用 Skill も用意しています。必要な CLI、認証、使い方は [文書への質問ガイド](docs/guides/asking-aidlc.md) を参照してください。

### 効果測定

![完了までの時間・承認待ち・差し戻し・品質チェックの集計と、案件ごとの記録を表示した効果測定](docs/images/readme/05-effectiveness.jpg)

現在の Space にある案件の、完了までの時間・承認待ち・差し戻し・品質チェックの結果を集計し、案件ごとの記録と並べて比較します。「比較条件」で scope と depth を絞り込めます。指標の読み方は [効果測定ガイド](docs/guides/effectiveness.md) を参照してください。

### カスタマイズ

![スコープとステージの関係と、スコープごとの実行ステージを表示したカスタマイズ](docs/images/readme/06-customization.jpg)

右上のメニューの「カスタマイズ」で、スコープ・ステージ・エージェント・品質チェック・開発ルール・ナレッジ・プラグインをフォームで編集します。入力が止まると検証して自動保存し、別途「適用」する手順はありません。標準スコープを複製した自作スコープや自作ステージも作れます。設定は Guide 用の設定ファイルや標準プラグインの ZIP に書き出して、他のプロジェクトへ配布できます。保存にはカスタマイズ契約に対応するエンジンと Bun が必要で、設定を共有する Space に未完了の作業がある間は保存できません。詳しくは[カスタマイズガイド](docs/guides/customization.md)を参照してください。

### プラグイン

![同梱プラグイン focus の詳細で、追加されるステージと手順が追記されるステージを表示した画面](docs/images/readme/07-plugins.jpg)

右上のメニューの「プラグイン」で、拡張に同梱したプラグインの内容と、導入すると追加・変更されるステージを確認できます。同梱の focus（試験版）は、Jira のチケットからテストを先に書いて実装まで進め、成果物を AI が描いた図で説明します。導入・有効化・無効化・更新は VS Code / Cursor の拡張から行い、ファイルの変更はネイティブの `aidlc` CLI が行います。対象は Claude Code（`.claude`）をネイティブの `aidlc` で導入したプロジェクトで、未完了のワークフローがある間は操作できません。

### はじめに・更新情報・ヒント

セットアップ後に初めて Dashboard を開くと「はじめに」を表示します。主な画面の見方を実画面で紹介し、「画面を順に案内してもらう」から自分の案件で現在地・ゲート要求・成果物をたどるツアーを始められます。拡張を更新したあとは、新しい変更を「更新情報」で一度だけお知らせし、変わった画面には「新機能」の案内を表示します。ステージ詳細などを初めて開いたときは、画面の上部に短いヒントを表示します。どれも右上のメニューからいつでも開き直せます。表示済みの状態は利用者ごとに拡張機能の保存領域へ記録し、ワークスペースには書き込みません。詳しくは[はじめに・更新情報・ヒント](docs/guides/onboarding.md)を参照してください。

## アーキテクチャ

```text
VS Code / Cursor 拡張 (packages/vscode-extension)
├─ Webview: Dashboard UI (packages/dashboard)
├─ コマンド: Open / Setup / Install・Update Workflows / Register MCP など
└─ api-core（拡張ホストの Node で実行）
     ├─ reader-core    状態・成果物・監査ログの読取
     ├─ docs-bridge    ステージ slug → 公式 docs
     └─ official-docs  同梱ドキュメントの読込・検索

ブラウザ版: dashboard-server（Bun、127.0.0.1） → api-core
チャット用: mcp-server（Bun、stdio） → reader-core / docs-bridge / official-docs
```

依存の向きと各パッケージの置き場の規約は [packages/README.md](packages/README.md) を参照してください。

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
2. 「CLI をインストール・設定」で、このマシンの `aidlc` コマンドを準備します。プロジェクトの固定バージョンはここでは変更しません。プロジェクトが 2.11.1 以外を指定している場合は、セットアップ後に表示される更新の案内から揃えます。新しい統合ターミナルには PATH を反映し、「新しいターミナルで CLI を確認」から動作を確認できます。Windows の Git Bash では `aidlc.cmd --version` を使い、コマンド プロンプトと PowerShell では `aidlc --version` で確認できます。外部ターミナルの PATH は公式手順に沿って設定してください。
3. 新規プロジェクトでは、AI-DLC を使うツールを選び「プロジェクトを設定」を実行します。既存プロジェクトでは共有済みの設定を確認します。参加時に共有エンジンを更新する必要はありません。
4. `aidlc doctor` で環境を診断し、「セットアップを完了」でダッシュボードへ進みます。Intent の作成前でも完了できます。初めて開いたダッシュボードには「はじめに」を表示します。

完了状態はフォルダごとに記録します。完了後は、CLIや設定に問題が見つかってもセットアップを自動表示しません。**`AIDLC Guide: Open`** は完了前ならセットアップ、完了後ならダッシュボードを開きます。設定画面または **`AIDLC Guide: Setup`** からいつでも開き直せます。拡張の起動だけではセットアップ画面は開きません。

信頼済みのフォルダでは、登録済みの文書参照連携を起動時に更新します。拡張の更新で変わる MCP の参照先と、拡張が管理する Skill を更新する処理で、セットアップ画面は開きません。

右上のメニューの「設定」には、**セットアップ**、**更新・修復**、**ツール追加** の入口があります。「更新・修復」の「更新画面を開く」から、**このマシンの CLI** と **プロジェクトのエンジン** を個別に更新できます。AIDLC Guide 拡張の更新は、同じ画面の「拡張機能の更新を確認」か `AIDLC Guide: Check for Updates` で確認します。CLIの更新は共有ファイルを変更せず、リポジトリの更新は準備済みの実行環境を使い、公式ネイティブインストーラーと `aidlc config` で全ツールと固定バージョンを揃えます。設定の競合で更新できない場合は「AIで修正して更新」から修正と更新をまとめて進められます（[更新時の問題を診断・修正する](docs/guides/updating-workflows.md)）。コマンドパレットの `AIDLC Guide: Install Workflows` / `Update Workflows` も各画面を開きます。

インストール・更新の導入先は `packages/shared-types/src/workflows-management.ts` の `WORKFLOWS_TARGET_VERSION` で共通管理します。同梱ドキュメントの `sourceVersion` は更新判定には使いません。インストールでは複数ツールを選択でき、更新では対象プロジェクトに設定済みの全ツールを同じバージョンへ揃えます。古い設定へのツール追加は全体更新の完了後に行い、新しい設定からのダウングレードは行いません。導入先は拡張で検証した固定バージョンであり、上流の最新バージョンへ自動追従しません。

マシンの CLI は検証済みの 2.11.1 に更新できます（確認ダイアログあり）。未導入のバージョンを自動取得できるのは 2.11.1 に限ります。マシンの既定 CLI がそれより新しい場合も、更新画面から 2.11.1 を追加導入でき、処理後は新しい既定バージョンを維持します。既定 CLI が新しく、プロジェクトがバージョンを固定していない場合は、更新画面の「このプロジェクトを 2.11.1 に固定」（`.aidlc-version` を作成するのでコミットが必要）か「この PC の既定を 2.11.1 に戻す」（固定していない他のプロジェクトにも影響）を選べます。プロジェクトの固定バージョンが 2.11.1 でない間は、バージョン確認により Guide の主要機能を使えません。

Guide は公式コマンドで生成した設定からツールごとのファイルを取り込み、既存の共通設定・成果物を保持します。更新後は全ツールのバージョン・プロジェクトの固定バージョン・最終診断を確認します。失敗時は適用状況、復元結果、次の操作を表示します。設定反映後の診断だけが失敗した場合は「Doctor を再実行」で確認できます。進行中の AI-DLC ワークフローがあってもツールの追加・更新はでき、作業はそのまま続けられます。Windows で VS Code を管理者として実行している場合、導入の前に公式インストーラーと同じ警告を表示し、続けるかを確認します。

アクティブなスペースとプラグイン選択も引き継ぎます。プラグインを構成済みの場合は元パッケージを検証し、同じ構成を再生成します。元パッケージを確認できない場合は既存設定を保持して停止します。「診断を実行」では設定済みの各ツールを検査し、ツール名付きで結果を表示します。

設定フォルダが競合する **GitHub Copilot と opencode**、**Kiro CLI と Kiro IDE** は、それぞれ同時設定の対象外です。一部のツールで設定に失敗しても、完了したツールは保持し、失敗したツールを再試行できます。

同じ拡張ホストで複数フォルダを開いている場合も、インストール・更新は一度に1件だけ実行できます。PCの既定バージョンを復元して処理が完了するまで、他フォルダでの実行は待ってから再試行してください。

### 4. 日常利用（1 アクション）

コマンドパレット → **`AIDLC Guide: Open`**

またはステータスバーの `AIDLC Guide` / 現在ステージ名をクリック。

## 拡張コマンド

| コマンド                         | 用途                                                  |
| -------------------------------- | ----------------------------------------------------- |
| `AIDLC Guide: Open`              | IDE 内 Dashboard（セットアップ完了前はセットアップ）  |
| `AIDLC Guide: Setup`             | CLI の準備・プロジェクトの環境構築・診断              |
| `AIDLC Guide: Install Workflows` | ツール追加（AI-DLC を使うツールのインストール）       |
| `AIDLC Guide: Update Workflows`  | このマシンの CLI とプロジェクトのエンジンの更新・修復 |
| `AIDLC Guide: Check for Updates` | AIDLC Guide 拡張の更新を確認                          |
| `AIDLC Guide: Open Plugins`      | 「プラグイン」画面                                    |
| `AIDLC Guide: Show Welcome`      | 「はじめに」                                          |
| `AIDLC Guide: Show What's New`   | 「更新情報」                                          |
| `AIDLC Guide: Register MCP`      | Claude Code / Cursor の MCP と文書参照 Skill を登録   |

## パッケージ

| パッケージ（`packages/`） | 役割                                                            |
| ------------------------- | --------------------------------------------------------------- |
| `vscode-extension`        | VS Code / Cursor 拡張（第一サーフェス）                         |
| `dashboard`               | React UI（Webview とブラウザ版で共用）                          |
| `api-core`                | 読取・カスタマイズ API（HTTP / postMessage 共通）               |
| `dashboard-server`        | ブラウザ版 Dashboard のローカルサーバー（Bun、`127.0.0.1`）     |
| `mcp-server`              | Claude Code / Cursor 向けの読取専用 MCP                         |
| `reader-core`             | `aidlc-state.md`・成果物・監査の読取                            |
| `docs-bridge`             | ステージ slug・用語・エージェント → 公式 docs                   |
| `official-docs`           | 同梱した公式ドキュメントの読込・検索                            |
| `shared-types`            | 全サーフェス共通の型と定数                                      |
| `core-utils`              | パスの封じ込めなど、読取境界の共通処理                          |
| `kamishibai`              | 解説動画の描画エンジン                                          |
| `doc-video`               | 解説動画パックの作成ツール（メンテナ用。VSIX には含めない）     |
| `video-pack-ja`           | 日本語の解説動画パック（別の拡張として配布し、Docs 画面で再生） |

## 設定

ワークスペースルートの [`aidlc-guide.config.json`](aidlc-guide.config.json) で docs 連携を設定します（全ステージ分のキーを同梱）。

| キー           | 用途                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| `docsRepoPath` | 公式 docs のルート（excerpt 読取）。相対パスは config ファイル基準                            |
| `docsBaseUrl`  | （任意）ベース URL。`stageDocs` 未設定ステージで bridge-map の相対パスと結合                  |
| `stageDocs`    | ステージ slug → 開き先 URL（Confluence / Notion / GitHub など `http(s)://…`）。空文字は未設定 |
| `projectLinks` | 右上のメニューの「プロジェクトリンク」に出す追加リンク `{ label, target }[]`                  |

「docs を開く」の優先順位: `stageDocs[slug]` → `docsBaseUrl` + map パス → 拡張ではワークスペース上のファイルを開く。

## 前提

- **VS Code 1.100 以上**（拡張ホストの Node 20 を前提にバンドルしているため）。Cursor など VS Code 本体に遅れて追随するフォークでも、この下限に到達したビルドであればインストールできます
- [bun](https://bun.sh) — MCP、ブラウザの Dashboard、カスタマイズの保存などで使用（拡張の Dashboard 表示自体は Node の api-core のみ）
- 対象ワークスペースは aidlc-workflows 2.11.1（State Version **8**）。それ以外のバージョンでは更新の案内画面を表示し、古いプロジェクトにはプロジェクトの更新を、新しいプロジェクトには Guide の更新と 2.11.1 に戻す公式コマンドを案内します（ダウングレードは実行しません）。この PC の既定 CLI だけが新しい場合は、プロジェクトを 2.11.1 に固定すれば使えます
- MCP 利用時は [Claude Code](https://docs.anthropic.com/en/docs/claude-code) または Cursor。ドキュメントへの質問には Claude Code / Cursor / GitHub Copilot のいずれかの CLI

## 開発

```bash
bun run test                          # Vitest（素の `bun test` は Bun のランナーで、dashboard を拾わない）
bun run lint                          # oxlint（@shadcn/lint 含む）+ canonical クラス・パス + actionlint・CI 方針
bun run lint:fix                      # oxlint の安全な自動修正
bun run format                        # oxfmt の整形
bun run check                         # 品質チェック全体（下記）
bun run build:extension               # Webview + 拡張バンドル
```

`bun run check` は Lint、整形検査、型チェック、文書索引の整合性検査、解説動画パックの検査、同梱プラグインと一覧の検査、aidlc-workflows との互換性検査、カバレッジ付きテスト、監査ログのシャード検査、依存関係の脆弱性監査を順に実行します。

依存更新、Lint・整形、main 保護の設定は [依存更新と品質チェック](docs/maintenance/dependency-quality.md) を参照してください。

Claude Code で開発する場合は、開発ルールを書いた `AGENTS.md` を読み込む設定を各自で一度有効にしてください。この設定がないと、Claude Code は `AGENTS.md` を読みません。手順は [AGENTS.md の「Claude Code: load this file」](AGENTS.md#claude-code-load-this-file) にあります。

## リリースと upstream 同期

`main` にマージすると VSIX がビルドされ、GitHub Releases に添付されます。ラベルがなければ patch リリースです。`release:major` / `release:minor` / `release:patch` で上げ幅を選び、`release:skip` を付けたマージはリリースしません。`release:minor` と `release:major` では、更新情報（`packages/shared-types/src/whats-new.ts`）への追加が必要です。同梱の公式ドキュメントと `.claude/` / `.cursor/` シェルは、毎日公式の最新安定版と比較し、差分があれば Draft の同期 PR が出ます。

詳細は [docs/maintenance/release-and-sync.md](docs/maintenance/release-and-sync.md) を参照してください。

## 設計上の約束

- **読取が基本**: AI-DLC の記録（状態・成果物・監査ログ）は読むだけです。書き込むのは、利用者が明示的に操作したときに限ります（`*-questions.md` の `[Answer]:` 記入、Setup・更新画面からの公式インストーラーと `aidlc config` の実行（`.aidlc-version` による固定を含む）、カスタマイズの保存、プラグインの導入・無効化、Space の切り替え、MCP 設定・文書参照 Skill の登録）
- **aidlc-workflows 本体は触らない**（導入・更新・プラグインの反映は公式のインストーラーと CLI に任せる）
- **独自のクラウドサービスを持たない**（ローカル専用）: ブラウザ版の Dashboard も `127.0.0.1` だけで待ち受け、AWS などのクラウドは使いません。外部へ接続する主な場面は、拡張と CLI の更新確認・取得（GitHub Releases）と、利用者が選んだ AI ツールの CLI の呼び出し（ドキュメントへの質問、更新時の AI 修正）です

## ドキュメント

| 文書                                                                         | 内容                                                                    |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [docs/guides/README.md](docs/guides/README.md)                               | **使い方ガイド一覧**（ユースケース別）                                  |
| [docs/prd/PRD.md](docs/prd/PRD.md)                                           | 要件・マイルストーン                                                    |
| [AGENTS.md](AGENTS.md)                                                       | Cursor / Claude Code での AI-DLC の進め方と、このリポジトリの開発ルール |
| [packages/README.md](packages/README.md)                                     | パッケージの依存の向きと置き場の規約                                    |
| [docs/maintenance/release-and-sync.md](docs/maintenance/release-and-sync.md) | リリース / upstream 同期の詳細（メンテナ向け）                          |
