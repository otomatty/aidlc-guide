# 他のハーネスでの実行

AI-DLC は、あなたが使う CLI 上へ展開されるハーネス中立のコアです。方法論、つまり [フェーズとステージ](../04-phases-and-stages.md)、[エージェント](../06-agents.md)、[スコープ](../05-scopes-and-depth.md)、[承認ゲート](../07-interaction-modes.md) は、どのハーネスでも同一です。異なるのはシェル部分だけです。ゲートの表示方法、サブエージェントの起動方法、どのセッションイベントが発火するか、設定がどこに置かれるかが変わります。ここにある各章では、ハーネス中立な方法論と異なる、そのハーネス固有のインストール手順、前提条件、ごく一部の振る舞いを説明します。

使いたいハーネスを選んでください。

| ハーネス | 呼び出し | 章 |
|---------|--------|---------|
| **Claude Code** | `/aidlc` | [ユーザーガイド](../00-introduction.md) 全体で扱います（例は Claude Code で実行）。インストールは [はじめに](../01-getting-started.md) を参照してください。 |
| **Kiro IDE** | `/aidlc` | [Kiro IDE での AI-DLC 実行](kiro-ide.md) - 前提条件（Opus 4.8）、インストール、フック、Kiro で異なる点を説明します。 |
| **Kiro CLI** (≥ 2.6) | `/aidlc` | [Kiro CLI での AI-DLC 実行](kiro-cli.md) - 前提条件、インストール、Kiro で異なる点を説明します。 |
| **Codex CLI** (≥ 0.145.0) | `$aidlc` | [Codex CLI での AI-DLC](codex-cli.md) - 前提条件、信頼設定の事前投入、Bedrock 設定、Git リポジトリ必須条件を説明します。 |
| **Cursor** | `/aidlc` | [Cursor での AI-DLC](cursor.md) - Cursor IDE と CLI を 1 つのツリーでカバー、ネイティブサブエージェントとスキル、hooks.json アダプター、Cursor で異なる点を説明します。 |
| **opencode** (≥ 1.17) | `/aidlc` | [opencode での AI-DLC](opencode.md) - `.aidlc/` と `.opencode/` の分割レイアウト、アダプタープラグイン、opencode で異なる点を説明します。 |
| **GitHub Copilot** (CLI ≥ 1.0.74 / VS Code ≥ 1.130) | `/aidlc` | [GitHub Copilot での AI-DLC](copilot.md) - 両サーフェス共通の 1 回のインストール、`.github/` へのマージ、フォルダー信頼、Copilot で異なる点を説明します。 |

Kiro（IDE または CLI）で AI-DLC を使う場合は、**Claude Opus 4.8** が最も適しており、これには **有料の Kiro プラン** が必要です。

このセットは開かれています。新しいハーネスを追加する場合は、同じテンプレートからここに専用の章を追加します。新しいハーネスを *構築する* 場合（ソース契約、つまり manifest、hook adapter、`emit.ts`）は、ハーネスエンジニアガイドの [新しいハーネスへの移植](https://github.com/awslabs/aidlc-workflows/blob/v2/docs/harness-engineering/09-porting-to-a-new-harness.md) を参照してください。

どのハーネスで実行しても、方法論そのものは同じです。まずは [最初のワークフロー](../02-your-first-workflow.md) と [フェーズとステージ](../04-phases-and-stages.md) の案内から進めてください。
