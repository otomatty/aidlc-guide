# はじめに

この章では、ネイティブ版の導入からプロジェクト設定、最初のワークフローの確認までを説明します。ネイティブインストーラーには対応する全ツールのランタイムが含まれ、AI-DLC 本体に Bun や Node.js は不要です。

## クイックスタート

### 1. AI-DLC をインストールする

macOS、Linux、WSL:

```bash
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.ps1 | iex
```

インストーラーがネイティブの `aidlc` コマンドと各ツール用ランタイムを追加します。新しいシェルで `aidlc` が見つからない場合は、インストーラーが表示した PATH の設定を適用してください。

ネイティブ実行ファイルを導入できない場合や、プロジェクトのファイルを手動管理したい場合は、[Bun](https://bun.sh/) を導入し、[リリース](https://github.com/awslabs/aidlc-workflows/releases/latest)から `aidlc-copy-runtime-X.Y.Z.tar.gz` を取得します。展開した `runtime/<harness>/` ディレクトリ全体をプロジェクトへコピーしてください。この手動コピー方式にネイティブの `aidlc` コマンドは不要です。

### 2. プロジェクトを設定する

プロジェクトのルートで実行します。

```bash
cd /path/to/your-project
aidlc config --harness claude
aidlc doctor
```

`claude` は利用するツールに置き換えます。

| ツール | 設定値 | 起動 | チャットでの呼び出し |
| --- | --- | --- | --- |
| Claude Code | `claude` | `claude` | `/aidlc` |
| Kiro CLI | `kiro` | `kiro-cli chat` | `/aidlc` |
| Kiro IDE | `kiro-ide` | プロジェクトを開く | `/aidlc` |
| Codex CLI | `codex` | `codex` | `$aidlc` |
| Cursor | `cursor` | Cursor を開く、または `agent` | `/aidlc` |
| opencode | `opencode` | `opencode` | `/aidlc` |
| GitHub Copilot CLI 1.0.74以上 / VS Code 1.130以上 | `copilot` | Copilot CLI または VS Code | `/aidlc` |

引数なしの `aidlc config` は、端末が利用可能なら対話型の初期設定を開始します。書き込む前に、導入済みツール、プロバイダー設定、必要なランタイム、信頼設定の操作を確認します。

### 3. 最初のワークフローを開始する

設定済みのツールでプロジェクトを開き、作業を説明します。

```text
/aidlc 在庫管理用の REST API を作る
```

Codex CLI では次を使います。

```text
$aidlc 在庫管理用の REST API を作る
```

AI-DLC が依頼内容からワークフロープロファイルを選びます。明示的に選ぶこともできます。

```text
/aidlc express
/aidlc feature 顧客向けの通知を追加する
/aidlc bugfix ログインのタイムアウトを修正する
```

利用できる工程は[ワークフロープロファイル](workflow-profiles.md)、実行例は[最初のワークフロー](02-your-first-workflow.md)を参照してください。

## ツールごとの前提条件

利用するツール本体のインストールと認証を先に済ませます。AI-DLC のネイティブランタイム自体に Git、Bun、Node.js は不要ですが、各ツール側の要件は適用されます。

| ツール | 初回の主な要件 | ガイド |
| --- | --- | --- |
| Claude Code | 対応するプロバイダーを設定する。配布時の既定は Amazon Bedrock | [以下の設定](#aws-bedrock-セットアップ) |
| Kiro CLI 2.6以上 | `kiro-cli login` でログイン | [Kiro CLI](harnesses/kiro-cli.md) |
| Kiro IDE | ログインして設定済みプロジェクトを開く | [Kiro IDE](harnesses/kiro-ide.md) |
| Codex CLI 0.145.0以上 | Git リポジトリを使い、プロジェクトのフックを信頼する | [Codex CLI](harnesses/codex-cli.md) |
| Cursor | IDE または CLI にログイン | [Cursor](harnesses/cursor.md) |
| opencode 1.17以上 | セッション用プロバイダーをグローバルに設定 | [opencode](harnesses/opencode.md) |
| GitHub Copilot | プロジェクトを信頼し、GitHub 認証または BYOK を設定 | [GitHub Copilot](harnesses/copilot.md) |

<a id="aws-bedrock-setup"></a>

## AWS Bedrock セットアップ

Claude Code 用の配布物は Amazon Bedrock を既定にしています。Codex も Bedrock が既定です。他のツールは、それぞれのプロバイダー設定を使います。

### Bedrock が既定である理由

AI-DLC は、進行役とティアを指定したサブエージェントで予測可能な実行環境を必要とします。Bedrock のグローバル推論プロファイルとコンテキスト指定を固定することで、マシン間のモデルエイリアスの違いを避けられます。AWS SDK の標準認証情報チェーンと IAM を使うため、プロバイダーの鍵をプロジェクトへコミットする必要もありません。

これは配布物の既定設定です。AI-DLC は Bedrock API を直接呼ばず、方法論自体はプロバイダーに依存しません。

### Bedrock を設定する

Claude Code を初めて起動する前に、次を済ませます。

1. Amazon Bedrock のモデルカタログで、設定に指定した Anthropic モデルへのアクセスを有効にします。
2. `aws configure` や `aws sso login --profile <profile>` など、標準の SDK 認証情報チェーンで認証情報を用意します。
3. 対象モデルが利用できるリージョンを使います。配布時の既定は `us-east-1` です。
4. `claude` を起動し、プロバイダーの選択で Amazon Bedrock を選びます。あとから `/setup-bedrock` でアカウントやリージョンを変更できます。

配布時の Claude 設定には以下の対応があります。

| 設定 | 既定値 |
| --- | --- |
| `CLAUDE_CODE_USE_BEDROCK` | `1` |
| `AWS_REGION` | `us-east-1` |
| `ANTHROPIC_DEFAULT_FABLE_MODEL` | `global.anthropic.claude-fable-5[1m]` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `global.anthropic.claude-opus-4-8[1m]` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `global.anthropic.claude-sonnet-4-6[1m]` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `global.anthropic.claude-haiku-4-5-20251001-v1:0` |

認証情報と個人の上書き設定は、共有の `.claude/settings.json` に含めず、`.claude/settings.local.json` または標準の AWS 認証情報ファイルへ置きます。

Claude Code が対応する別のプロバイダーを使う場合は、`.claude/settings.json` と、それより優先される `.claude/settings.local.json` の Bedrock 環境変数を削除または置き換え、対象プロバイダーの認証を完了します。[Claude Code の認証ガイド](https://code.claude.com/docs/en/authentication)を参照してください。

IAM、モデルアクセス、SSO、リージョン別の問題は、[Claude Code on Amazon Bedrock](https://community.aws/content/2tXkZKrZzlrlu0KfH8gST5Dkppq/claude-code-on-amazon-bedrock-quick-setup-guide)と[Amazon Bedrock ドキュメント](https://docs.aws.amazon.com/bedrock/)を参照してください。

<a id="mcp-servers-optional"></a>

## MCP サーバーの任意設定

Claude プロジェクトでは、初期設定時に配布済みの MCP 設定を追加できます。

```bash
aidlc config --harness claude --mcp defaults
```

追加しない場合は `--mcp none` を使います。既定の構成は以下です。

| サーバー | 用途 | 認証情報 |
| --- | --- | --- |
| `context7` | ライブラリ・SDK の文書 | `CONTEXT7_API_KEY` |
| `aws-mcp` | AWS API へのアクセス | AWS 認証情報チェーン |
| `aws-pricing` | AWS 料金の照会 | AWS 認証情報チェーン |
| `aws-iac` | Infrastructure as Code のツール | AWS 認証情報チェーン |
| `aws-serverless` | サーバーレス開発用ツール | AWS 認証情報チェーン |

4つの AWS サーバーには `uvx` が必要です。いずれも標準の AWS 認証情報チェーンを使います。

Claude セッションの各エージェントは利用可能な MCP サーバーを引き継ぎます。認証情報がなければ対象サーバーは利用できませんが、それだけでワークフローが停止することはありません。コミットする `.mcp.json` に秘密情報を置かないでください。

## 設定と信頼

`aidlc config` はローカルでトランザクションとして動きます。選んだツールのランタイムを書き、`aidlc/` ワークスペースを作り、管理対象のプロジェクト設定を統合し、次の更新で使う所有情報を記録します。

変更のプレビュー:

```bash
aidlc config --dry-run
```

設定後は、出力で案内された操作を完了します。

| ツール | 主な操作 |
| --- | --- |
| Claude Code | `/hooks` でプロジェクトのフックを承認し、Claude Code を再起動 |
| Kiro CLI | `kiro-cli chat` を起動。プロジェクトが AI-DLC エージェントを選択する |
| Kiro IDE | 設定済みプロジェクトを開く |
| Codex CLI | フックの信頼確認を承認するか、生成された trust seed を適用 |
| Cursor | 設定済みプロジェクトを開く、または `agent` を起動 |
| opencode | プロジェクト内で `opencode` を起動 |
| GitHub Copilot | プロジェクトフォルダを信頼する |

操作後に `aidlc doctor` を実行します。ランタイム、プロジェクト、プロバイダー、フック、信頼設定、ワークフロー状態の問題と対処コマンドを表示します。

## 更新

`aidlc update` はマシン側のランタイムを更新します。設定済みプロジェクトは書き換えません。各プロジェクトはワークフローの実行間に更新します。

```bash
aidlc update
cd /path/to/your-project
aidlc doctor
aidlc config
```

`config` はプロジェクト所有の内容を保持し、ワークフローの進行中には更新を拒否します。プラグインを使うプロジェクトは、エンジンの更新後に `/aidlc plugin sync` を実行してください。

版の選択、プロジェクトの pin、オフライン導入、ミラー、カスタム CA、リリース認証、自動化、アンインストールは[インストールとライフサイクル](18-install-and-lifecycle.md)を参照してください。

## 設定が作成するもの

設定済みプロジェクトにはツールとの連携ファイルと `aidlc/` ワークスペースがあります。最初のワークフローが以下にインテント記録を作ります。

```text
aidlc/spaces/<space>/intents/<YYMMDD>-<label>/
```

この記録には、状態、監査シャード、質問、判断、ステージ成果物が入ります。チームのナレッジと学習した規則はスペース階層に置き、次のインテントでも再利用できます。

配置は[スペースとインテント](03-spaces-and-intents.md)、証跡は[状態と監査](10-state-and-audit.md)を参照してください。

## トラブルシューティング

まず診断を実行します。

```bash
aidlc doctor
```

フック、プロバイダー接続、承認ゲート、古い状態、診断は[トラブルシューティング](15-troubleshooting.md)を、ツール固有の問題は対応する[ツール別ガイド](harnesses/README.md)を確認してください。

## 次のステップ

- [ワークフロープロファイル](workflow-profiles.md): 作業に合う工程を選ぶ
- [最初のワークフロー](02-your-first-workflow.md): 一連の実行を追う
- [スペースとインテント](03-spaces-and-intents.md): プロジェクトの状態を理解する
- [対話モード](07-interaction-modes.md): 質問とゲートを使う
- [インストールとライフサイクル](18-install-and-lifecycle.md): ネイティブランタイムを管理する
