# AI-DLC ドキュメント

AI-DLC は、承認ゲートを設けて AI によるソフトウェア開発を進める手法です。
このリポジトリは Claude Code、Kiro CLI、Kiro IDE、Codex CLI、Cursor、opencode、GitHub Copilot 上でネイティブに動作します。

## クイックスタート

### 1. インストールする

macOS、Linux、WSL:

```bash
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.ps1 | iex
```

ネイティブインストーラーには全ハーネスのランタイムが含まれます。Bun や Node.js は不要です。

### 2. 設定する

プロジェクトのルートで実行します。

```bash
aidlc config --harness claude
aidlc doctor
```

`claude` は `kiro`、`kiro-ide`、`codex`、`cursor`、`opencode`、`copilot` に置き換えられます。
引数なしの `aidlc config` は対話形式のセットアップを開始します。

### 3. 開始する

設定したハーネスを開き、作業内容を伝えます。

```text
/aidlc 在庫管理用の REST API を作る
```

Codex CLI では `$aidlc` を使います。プロバイダーの設定、信頼の確認、プロジェクト設定の更新、最初のワークフローについては、[はじめに](guide/01-getting-started.md) を参照してください。

## ハーネスを選ぶ

| ハーネス | ガイド |
| --- | --- |
| Claude Code | [はじめに](guide/01-getting-started.md) |
| Kiro CLI | [Kiro CLI で AI-DLC を動かす](guide/harnesses/kiro-cli.md) |
| Kiro IDE | [Kiro IDE で AI-DLC を動かす](guide/harnesses/kiro-ide.md) |
| Codex CLI | [Codex CLI での AI-DLC](guide/harnesses/codex-cli.md) |
| Cursor | [Cursor での AI-DLC](guide/harnesses/cursor.md) |
| opencode | [opencode での AI-DLC](guide/harnesses/opencode.md) |
| GitHub Copilot | [GitHub Copilot での AI-DLC](guide/harnesses/copilot.md) |

## ガイドを選ぶ

| ガイド | 用途 |
| --- | --- |
| [ユーザーガイド](guide/00-introduction.md) | AI-DLC でソフトウェアを開発する |
| [ワークフロープロファイル](guide/workflow-profiles.md) | Classic、Express、用途別のワークフローを選ぶ |
| [インストールとライフサイクル](guide/18-install-and-lifecycle.md) | 更新、バージョン固定、オフライン導入、ミラーの利用、アンインストール |
| [ハーネスエンジニアガイド](harness-engineering/00-overview.md) | ステージ、エージェント、スコープ、ルール、センサー、ナレッジを調整する |
| [開発者リファレンス](reference/00-overview.md) | エンジン、フック、パッケージ化、テストスイートを変更する |

## 開発

メンテナーは `core/` と `harness/` を編集します。生成される `dist/` と `dist-release/` はローカルの出力であり、手で編集してはいけません。

開発手順は [貢献ガイド](reference/11-contributing.md)、ランタイムを追加する方法は [新しいハーネスへの移植](harness-engineering/09-porting-to-a-new-harness.md) を参照してください。
