# カスタマイズ

AI-DLC は、チームのニーズに適応できるよう設計されています。この章では、設定の上書き、スコープ設定、ステージのカスタマイズ、ステータスライン、ツール権限を扱います。

> **ハーネス固有の設定。** スコープ設定、ステージの深さ、ナレッジ、ルールなど、ハーネスに依存しないカスタマイズはすべてのハーネスで適用されます。この章で扱う仕組み単位の設定（`settings.json` / `settings.local.json`、ステータスラインコマンド、`$CLAUDE_PROJECT_DIR`、ツール権限ブロック）は **Claude Code 固有** です。Kiro CLI では `.kiro/settings/cli.json` とエージェント設定、Kiro IDE ではエージェント Markdown の `tools:` と `permissions.rules`、Codex では `.codex/config.toml` と Starlark ルール、Cursor では `.cursor/hooks.json` と `.cursor/cli.json`（権限のみ）、opencode ではプロジェクトルートの `opencode.json`、Copilot では `.github/hooks/aidlc.json`（フック配線）と `~/.copilot/config.json`（フォルダ信頼）で同等の設定を行います。各ハーネスの設定面については [Kiro CLI での実行](harnesses/kiro-cli.md)、[Kiro IDE での実行](harnesses/kiro-ide.md)、[Codex CLI での実行](harnesses/codex-cli.md)、[Cursor での AI-DLC](harnesses/cursor.md)、[opencode での AI-DLC](harnesses/opencode.md)、[GitHub Copilot での AI-DLC](harnesses/copilot.md) を参照してください。

---

## 設定の上書き（`settings.local.json`）

共有の `.claude/settings.json` はフレームワークと一緒に配布され、バージョン管理にコミットされます。チームへ影響させずにローカル環境だけで設定を上書きしたい場合は、個人用の上書きファイルを作成します。

```bash
cp .claude/settings.local.json.example .claude/settings.local.json
```

このファイルは `.gitignore` に入っているため、個人用の変更がコミットされることはありません。用途は次のとおりです。

- モデル選択を上書きする（たとえば別の Opus / Sonnet モデル ID に切り替える）
- ローカルセットアップ用の環境変数を設定する
- セキュリティ要件に合わせてツール権限を調整する

---

## エージェントのモデルと推論量（階層）

同梱されるエージェントには `tier:`（`judgment` | `balanced` | `templated`）が記述されており、ビルド時に各ハーネス固有のモデルと推論量のキーへ投影されます。`judgment` エージェントはセッションのモデルと推論量を継承し、`balanced` と `templated` の両エージェントは Claude Code、Codex、opencode では中規模モデルに `medium` の推論量で固定されます。この 2 つのティアは現在同一に投影されますが、どちらか一方だけを独立に再調整できるよう区別は保たれています。Kiro、Cursor、Copilot では全ティアがセッションのモデルを継承します。完全な投影表は [エージェントシステム](../reference/05-agent-system.md) を参照してください。

インストール済みコピー内で **1 つのエージェント**の挙動だけ変えたい場合は、投影済みの値を直接編集します。たとえば Claude エージェントの `.claude/agents/aidlc-*-agent.md` フロントマターで `model: opus` にします。Kiro では設定面がハーネスによって異なります。Kiro CLI ではエージェントの `.kiro/agents/aidlc-*-agent.json` に `"model"` フィールドを追加し、Kiro IDE ではエージェントの `.kiro/agents/aidlc-*-agent.md` フロントマターに `model:` 行を設定します（エージェント JSON ファイルは CLI 専用で、IDE はスポーン時に `.md` フロントマターを読みます）。どちらの場合も、あなたのインストールで有効なモデル ID を使ってください。Kiro のエージェントはモデル固定なしで出荷されるため、既定ではセッションのモデルを継承します。この編集は `dist/<harness>/` の実行環境を再コピーするまで残ります。ソースから独自の配布物をビルドする際に **すべてのエージェント**へ上限を設けたい場合は、`core/memory/org.md` / `project.md` のフロントマターに `tier_cap:` を設定するか、`AIDLC_TIER_CAP=<tier>` を付けてパッケージャーを実行します。どちらも実行時設定ではなく、`bun scripts/package.ts` に対するパッケージ作成時の調整値です。

---

## プロジェクトごとの既定スコープ

プロジェクト内のすべてのワークフローを同じスコープで始めたい場合は、`.claude/settings.json` の `env` ブロックに `AWS_AIDLC_DEFAULT_SCOPE` を設定します（配布済みファイルではフレームワークのハードコードされた代替値と一致する `classic` がすでに設定されています。既定でフルライフサイクルを実行したい場合は `feature` に設定してください）。

```json
{
  "env": {
    "AWS_AIDLC_DEFAULT_SCOPE": "feature"
  }
}
```

> 配布済みの `env` ブロックには Bedrock のモデル ID（`CLAUDE_CODE_USE_BEDROCK`、`ANTHROPIC_DEFAULT_OPUS_MODEL` など）も含まれます。分かりやすさのため、上の例ではスコープのキーだけを示しています。

これを設定すると、引数なしの `/aidlc` 呼び出しは `feature` を既定スコープとして使います。この環境変数はワークフロー初期化時にだけ読み込まれます。インテントの `aidlc-state.md`（その記録ディレクトリ内）が存在した後は、状態ファイルが正本となり、環境変数の変更は進行中ワークフローへ影響しません。

**優先順位（高い順）:**

1. 明示的な CLI フラグ: `/aidlc feature` または `/aidlc --scope bugfix`
2. 自由形式テキストのキーワード検出: `/aidlc fix the login bug` は引き続き `bugfix` に対応付けられます。利用者は既存の確認プロンプトで検出結果を上書きできます
3. `.claude/settings.json` の環境変数 `AWS_AIDLC_DEFAULT_SCOPE`
4. ハードコードされた代替値: `classic` — フレームワーク唯一の既定値で、未一致の自由形式入力の解決、`/aidlc-init`、および `--scope` なしの低レベル `intent-create` 直接呼び出しで使われます。暗黙の既定値を制御するものは他にありません

**有効な値:** `enterprise`、`feature`、`mvp`、`poc`、`bugfix`、`refactor`、`infra`、`security-patch`、`classic`、`workshop`、`express`。無効な値を指定すると、呼び出し時に明確なメッセージ付きでエラーになります。追加スコープは `.claude/scopes/aidlc-<name>.md` を配置し、対象ステージの `scopes:` 一覧にタグ付けして定義できます。詳細は [貢献ガイド: スコープの追加](../reference/11-contributing.md#スコープの追加) を参照してください。追加エージェントも `.claude/agents/` に定義できます。詳細は [貢献ガイド: エージェントの追加](../reference/11-contributing.md#エージェントの追加) を参照してください。

**設定の確認:** 環境変数が設定され有効かどうかは `/aidlc --doctor` で確認できます。

```
✓  AWS_AIDLC_DEFAULT_SCOPE=classic (valid)
```

**初期化時の通知:** 環境変数の既定値が適用されると、オーケストレーターはワークフロー開始時に 1 行の通知（`Using scope=<value> from AWS_AIDLC_DEFAULT_SCOPE (.claude/settings.json)`）を表示します。スコープの取得元を、適用された時点で確認できます。

なぜ深さやテスト戦略ではなくスコープだけなのか。それは、各スコープが深さを宣言し、テスト戦略はスコープが上書きしない限りその深さを継承するためです。したがって `classic` は Standard/Standard、`workshop` は Standard/Minimal、`express` は Minimal/Minimal で始まります。どちらかを上書きしたい場合は、CLI で `--depth` または `--test-strategy` を渡してください。

**機密値:** `.claude/settings.json` はバージョン管理にコミットされます。秘密情報、資格情報、個人用の上書きはここに入れないでください。機密情報には Git 管理外の `.claude/settings.local.json` を使います。

---

## スコープ設定

スコープは、どのステージをどの深さとテスト戦略で実行するかを制御します。AI-DLC には 11 個の名前付きスコープがあり、完全な表（EXECUTE / 全ステージ数、既定の深さ、テスト戦略、各用途）は [スコープ、深さ、テスト戦略 § 11 個のコアスコープ](05-scopes-and-depth.md#11-のコアスコープ) が唯一の正本です。この節では、その*設定*と上書きを扱います。

### スコープを選ぶ

明示的に指定することも、オーケストレーターに自動検出させることもできます。

```
/aidlc enterprise       # Explicit scope
/aidlc Build a payments API  # No keyword: offers composition; resolver fallback is "classic"
/aidlc Fix the login bug     # Auto-detects "bugfix"
```

### 実行時に上書きする

ワークフロー中のどの時点でもスコープを上書きできます。

- **任意の承認ゲートで**: 別のスコープや深さを要求する
- **ユーティリティコマンド経由で**: `/aidlc --scope enterprise` が現在のスコープを変更する
- **ステージの組み入れ**: アイデア創出フェーズとインセプションフェーズの承認ゲートでは、以前スキップしたステージをワークフローへ戻せる

---

## ステージのカスタマイズ

各ステージは `.claude/aidlc-common/stages/[phase]/` にある自己完結した `.md` ファイルです。ステージファイルには次が定義されています。

- **メタデータ** — ステージ番号、フェーズ、実行方式、主担当 / 支援エージェント
- **入力** — 読み込む前段成果物
- **手順** — 番号付きの実行順序
- **出力** — 生成する成果物
- **完了条件** — 承認ゲートのパターン

ステージの挙動を変更したい場合は、そのステージファイルを直接編集します。すべてのステージは、承認ゲート、質問形式、状態追跡といった共通パターンについてステージ手順を参照します。

### 深さレベル

各スコープは、成果物の詳細度を制御する既定の深さを持っています。

| 深さ | 説明 |
|-------|-------------|
| **Minimal** | 短い成果物、対象を絞った分析、任意内容なし |
| **Standard** | 釣り合いの取れた詳細度で、主要事項と副次事項をカバーする |
| **Comprehensive** | 最大限の詳細度で、広範な分析を行い、任意内容もすべて含める |

任意の承認ゲートで別レベルを要求すれば、深さを上書きできます。

---

## ステータスライン（Claude Code のみ）

**Claude Code** では、この実装は端末のステータスバーにワークフロー進捗を表示します。他のハーネスにステータスラインはありません。代わりに Kiro・Cursor・opencode は `/aidlc --status`、Codex は `update_plan` のタスク進捗項目と `$aidlc --status` でワークフロー位置を示します。

```
[AIDLC] IDEATION [▓▓▓▓▓░░░░░] 4/7 > Intent Capture -- Product Agent
```

ここには順に、現在のフェーズ、フェーズ内進捗（バーと比率の両方）、ステージ表示名、主担当エージェントが表示されます。コンテキスト使用量は右側に出ます（例: `ctx:15%`）。残りコンテキストが減るにつれて色分けされます。Claude の使用量台帳にデータがあるときは、アクティブなワークフローと現在のトランスクリプト／セッションに限定した `↑<in> ↓<out> $<usd>` が続きます。過去のワークフローやセッションは含みません。`AIDLC_DISABLE_USAGE_TRACKING=1` を設定すると使用量トラッキングが完全に無効化され、このセグメントも消えます。

### 設定

ステータスラインは `.claude/settings.json` で設定します。

```json
"statusLine": {
  "type": "command",
  "command": "bun \"$CLAUDE_PROJECT_DIR/.claude/hooks/aidlc-statusline.ts\""
}
```

### 表示形式を変える

`.claude/hooks/aidlc-statusline.ts` を直接編集します。出力形式はファイル末尾近くの `main()` 関数で定義されています。フックは `aidlc-state.md` からフェーズ、ステージ、エージェントを読み、ステージのスラッグを表示名へ変換します。Unicode 進捗バーと `n/m` 比率は、同じフェーズ内チェックボックスの解析結果から組み立てます。

### ステータスラインを無効化する

`settings.json` から `statusLine` ブロックを削除します。端末のステータスバーは Claude Code の既定表示に戻ります。

---

## ツール権限

`.claude/settings.json` の `permissions.allow` 一覧は Claude Code ツールを事前承認し、ワークフローが呼び出しごとの権限プロンプトなしで動くようにします。

```json
"permissions": {
  "allow": [
    "Read", "Edit", "Write",
    "Bash(bun \"$CLAUDE_PROJECT_DIR/.claude/tools/\"*)",
    "Bash", "Glob", "Grep", "Task", "WebSearch"
  ]
}
```

範囲を限定した `Bash(bun "$CLAUDE_PROJECT_DIR/.claude/tools/"*)` 項目は、制限なしの `Bash` より前に置かれています。これにより、フレームワーク自身のツール呼び出しは常に先に狭いルールへ一致します。`$CLAUDE_PROJECT_DIR` は二重引用符で囲み（`*` は引用符の外）、プロジェクトパスに空白が含まれても単語分割を行うシェルでコマンドが壊れず、権限照合のグロブも機能します。

### 権限の仕組み

- **プロジェクト全体の上限**: `settings.json` の許可一覧が利用可能なツールの最大集合になる
- **Claude Code のエージェントは既定でセッション全体のツール群を継承する**。このハーネスでは `disallowedTools: Task` が入れ子のサブエージェント起動を防ぐ
- **エージェント単位の任意の絞り込み**: フロントマターに `tools:` 許可一覧を追加すると、そのエージェントが利用できるツールを絞れる。省略時はすべて継承する。`tools:` を列挙した場合、完全修飾された `mcp__<server>__<tool>` ID も明示しなければ、継承された MCP ツールは除外される

### 権限を広げる

許可一覧へツールを追加するのは、追加機能を必要とする独自ステージを作る場合だけにしてください。

### 権限を狭める

許可一覧からツールを外すと、利用のたびに手動承認が必要になります。`Task` を外すと、4 つのディスパッチ型ステージ（2.1 リバースエンジニアリング pipeline、2.2 プラクティス発見 subagent、2.4 ユーザーストーリー mob、3.5 コード生成 subagent）は委譲ごとに権限確認が出る点に注意してください。ワークスペース検出（0.2）は `aidlc-utility intent-create` の内部で決定論的に実行されるため、`Task` は使いません。

---

## AI-DLC を拡張する

ここまでに述べた設定、スコープ、深さ、ステージ編集は、実行するワークフローを日常的に調整するためのものです。チーム向けにフレームワーク自体を作り替えたい場合、つまりステージやエージェントの追加、スコープの定義、常設ルールの学習、決定論的な検査の接続、分野別ナレッジの追加を行いたい場合は、別の作業になります。そのための専用ガイドが **[ハーネスエンジニアガイド](https://github.com/awslabs/aidlc-workflows/blob/v2/docs/harness-engineering/00-overview.md)** です。

境界線はデータとコードです。そのガイドにあるものはすべて、フレームワークが読む Markdown ファイル（YAML フロントマター付き）または JSON 設定であり、TypeScript の編集は不要です。拡張内容ごとの入口は次のとおりです。

| したいこと | 開始地点 |
|--------------|----------|
| ステージの内容を編集する、または新しいステージを追加する | [ステージの構造](https://github.com/awslabs/aidlc-workflows/blob/v2/docs/harness-engineering/01-anatomy-of-a-stage.md)、[ステージの追加](https://github.com/awslabs/aidlc-workflows/blob/v2/docs/harness-engineering/02-adding-a-stage.md) |
| エージェントを追加または変更する | [エージェントの追加](https://github.com/awslabs/aidlc-workflows/blob/v2/docs/harness-engineering/03-adding-an-agent.md) |
| スコープを定義または調整する | [スコープ](https://github.com/awslabs/aidlc-workflows/blob/v2/docs/harness-engineering/04-scopes.md) |
| 常設ルールを学習させる、または学習ループを運用する | [ルールと学習ループ](https://github.com/awslabs/aidlc-workflows/blob/v2/docs/harness-engineering/05-rules-and-the-loop.md) |
| 決定論的な検査（センサー）をステージに接続する | [センサー](https://github.com/awslabs/aidlc-workflows/blob/v2/docs/harness-engineering/06-sensors.md) |
| チームの分野別ナレッジを追加する | [チームナレッジ](https://github.com/awslabs/aidlc-workflows/blob/v2/docs/harness-engineering/07-team-knowledge.md) |

変更対象がフレームワークの*コード*、つまりオーケストレーター、フック、CLI ツール、コンパイル処理であれば、それは [開発者リファレンス](../reference/00-overview.md) の領域です。

---

## ナレッジとルール

二層のナレッジシステムと、ルール / 学習ループシステムの詳細は次を参照してください。

- [ナレッジ](08-knowledge.md) — チームナレッジのディレクトリと方法論リファレンスファイル
- [ルールと学習ループ](09-rules-and-the-learning-loop.md) — 振る舞いルールと自己学習フロー

---

## 次のステップ

- [スコープ、深さ、テスト戦略](05-scopes-and-depth.md) — 完全なスコープ対ステージ対応表
- [エージェント](06-agents.md) — エージェントの権限と能力
- [トラブルシューティング](15-troubleshooting.md) — ステータスラインの問題、フック設定
- [用語集](glossary.md) — スコープ、深さ、ガードレール、ナレッジの定義
