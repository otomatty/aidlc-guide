# カスタマイズ

AI-DLC はチームのやり方に寄せられます。この章では設定の上書き、スコープ、ステージの調整、ステータスライン、ツール権限を扱います。

> **ハーネス固有の設定。** ハーネスを問わず効くカスタマイズは、スコープ、ステージ深度、ナレッジ、ルールです。一方、この章の仕組み側（`settings.json` / `settings.local.json`、ステータスラインコマンド、`$CLAUDE_PROJECT_DIR`、ツール権限ブロック）は **Claude Code 専用** です。Kiro CLI では `.kiro/settings/cli.json` とエージェント設定、Kiro IDE ではエージェント Markdown の `tools:` と `permissions.rules`。Codex は `.codex/config.toml` と Starlark ルール、Cursor は `.cursor/hooks.json` と `.cursor/cli.json`（権限のみ）、opencode はプロジェクトルートの `opencode.json`、Copilot は `.github/hooks/aidlc.json`（フック配線）と `~/.copilot/config.json`（フォルダ信頼）です。各ハーネスの面は次を見てください。
> [Running on Kiro CLI](harnesses/kiro-cli.md)、
> [Running on Kiro IDE](harnesses/kiro-ide.md)、
> [Running on Codex CLI](harnesses/codex-cli.md)、
> [AI-DLC on Cursor](harnesses/cursor.md)、
> [AI-DLC on opencode](harnesses/opencode.md)、
> [AI-DLC on GitHub Copilot](harnesses/copilot.md)。

---

## 設定の上書き（`settings.local.json`）

共有の `.claude/settings.json` はフレームワーク同梱で、バージョン管理に入ります。チームに影響させず、自分の環境だけ変えたいときは個人用の上書きファイルを作ります。

```bash
cp .claude/settings.local.json.example .claude/settings.local.json
```

このファイルは `.gitignore` にあるので、個人の変更はコミットされません。用途は次です。

- モデルの切り替え（別の Opus や Sonnet のモデル ID など）
- ローカル用の環境変数
- セキュリティ要件に合わせたツール権限

---

## エージェントのモデルと effort（ティア）

配布エージェントは `tier:`（`judgment` | `balanced` | `templated`）を持ち、ビルドが各ハーネスの model / effort キーへ投影します。モデルポリシーが未記録なら、judgment と templated はセッションのモデルと effort を継承します。Claude Code・Codex・opencode で中規模モデルと `medium` effort を固定するのは balanced のレビュアーティアだけです。Kiro、Cursor、Copilot は全ティアでセッションを継承します。投影表は [Agent System](../reference/05-agent-system.md) を参照してください。

初回ウィザードの既定値は `balanced` **プリセット**です。レビュアーの**ティア**とは別で、3グループすべての effort を medium に記録します。`aidlc config models --preset balanced --project --yes` で選択できます。

| プリセット | Deciding | Reviewing | Writing up |
| --- | --- | --- | --- |
| `thorough` | セッションの effort | `xhigh` | セッションの effort |
| `balanced` | `medium` | `medium` | `medium` |
| `minimal` | `medium` | `medium` | `low` |

プリセットが変えるのは effort だけで、モデルIDは変えません。エージェント別の例外、グループ設定、出荷時のティア既定値の順に優先します。Kiro CLI/IDE、Cursor、Copilot ではグループ単位の effort を表現できないため、設定を記録して未反映と報告し、無効なキーは書きません。プロファイルや上書き、更新方法は[モデルポリシー](18-install-and-lifecycle.md#モデル方針)を参照してください。

インストール済みのコピーで **1 体だけ** 変えたいときは、投影先を直接編集します。例: Claude なら `.claude/agents/aidlc-*-agent.md` の frontmatter に `model: opus`。Kiro はハーネスで面が違います。Kiro CLI は `.kiro/agents/aidlc-*-agent.json` に `"model"`、Kiro IDE は `.kiro/agents/aidlc-*-agent.md` の frontmatter に `model:`（エージェント JSON は CLI 専用で、IDE は起動時に `.md` の frontmatter を読む）。どちらも、その環境で有効なモデル ID を使ってください。Kiro のエージェントはモデル固定なしで出荷するので、既定ではセッションモデルを継ぎます。編集は `aidlc config` がそのフレームワーク所有ファイルを更新するか、同じ版の `runtime/<harness>/` リリースから手で置き換えるまで残ります。ソースから独自の配布物をビルドするときに **全エージェント** を抑えたいなら、`core/memory/org.md` / `project.md` の frontmatter に `tier_cap:` を書くか、パッケージャを `AIDLC_TIER_CAP=<tier>` で回します。どちらも `bun scripts/package.ts` のパック時ノブで、実行時の設定ではありません。

---

## プロジェクト既定スコープ

そのプロジェクトのワークフローをいつも同じスコープで始めたいときは、`.claude/settings.json` の `env` に `AWS_AIDLC_DEFAULT_SCOPE` を置きます。同梱ファイルはすでに `classic` で、フレームワークのハードコードされたフォールバックと同じです。ライフサイクル全体を既定にしたいなら `feature` にします。

```json
{
  "env": {
    "AWS_AIDLC_DEFAULT_SCOPE": "feature"
  }
}
```

> 同梱の `env` には Bedrock のモデル ID（`CLAUDE_CODE_USE_BEDROCK`、`ANTHROPIC_DEFAULT_OPUS_MODEL` など）もあります。上の例は分かりやすさのためスコープのキーだけ出しています。

この設定では暗黙のスコープ解決に `feature` を使います。`aidlc config flags --default-scope feature --project --yes` でも既定値を保存できます。このチェックアウトだけなら `--local` を使います。実際の `AWS_AIDLC_DEFAULT_SCOPE` 環境変数が保存したフラグより優先するため、同梱 settings の env 値を変えるか削除するまでは、その値が有効です。インテントの `aidlc-state.md` ができた後は、そこに記録したスコープが正本であり、暗黙の既定値を変えても進行中のワークフローは変わりません。

**優先順位（高い順）:**

1. 明示の CLI フラグ: `/aidlc feature` や `/aidlc --scope bugfix` が勝つ。
2. 自由文のキーワード判定: `/aidlc fix the login bug` は `bugfix` にマップする。判定結果は、既存の確認プロンプトで上書きできる。
3. `.claude/settings.json` からの値を含む、実際の `AWS_AIDLC_DEFAULT_SCOPE` 環境変数。
4. `aidlc config flags --default-scope` の保存値。ローカル設定が共有プロジェクト設定より優先する。
5. フォールバックの `classic`。一致しない自由文、`/aidlc-init`、`--scope` なしの `intent-create` が使う。

**有効な値:** `enterprise`、`feature`、`mvp`、`poc`、`bugfix`、`refactor`、`infra`、`security-patch`、`classic`、`workshop`、`express`。無効な値は起動時に分かりやすいエラーになります。追加スコープは `.claude/scopes/aidlc-<name>.md` を置き、所属ステージの `scopes:` にタグを付けます。手順は [Contributing: Adding a Scope](../reference/11-contributing.md#スコープの追加)。エージェントの追加は `.claude/agents/`。[Contributing: Adding an Agent](../reference/11-contributing.md#エージェントの追加)。

**確認:** `/aidlc --doctor` で既定スコープが有効か確認します。環境変数と保存済みの既定値を同じ検査で扱います。

```
✓  AWS_AIDLC_DEFAULT_SCOPE=classic (valid)
```

**初期化時の通知:** env 既定が使われると、オーケストレータはワークフロー開始時に 1 行出します（`Using scope=<value> from AWS_AIDLC_DEFAULT_SCOPE (.claude/settings.json)`）。効いた瞬間に、スコープの出所が見えます。

なぜスコープだけで、深度やテスト戦略は env にないのか。各スコープが深度を宣言し、テスト戦略はスコープが上書きしなければその深度に従います。だから `classic` は Standard/Standard、`workshop` は Standard/Minimal、`express` は Minimal/Minimal で始まります。どちらかを変えたいときは CLI で `--depth` か `--test-strategy` を渡してください。

**機微な値:** `.claude/settings.json` はバージョン管理に入ります。秘密情報、認証情報、個人の上書きはここに置かないでください。機微なものは gitignore された `.claude/settings.local.json` です。

---

## スコープの設定

スコープは、どのステージを、どの深度とテスト戦略で実行するかを決めます。AI-DLC は名前付きスコープを 11 用意しています。表（EXECUTE/全ステージ数、既定深度、テスト戦略、用途）の正本は [スコープ・深度・テスト戦略 § The 11 Core Scopes](05-scopes-and-depth.md#the-11-core-scopes) です。ここは *設定と上書き* です。

### スコープの選び方

明示するか、オーケストレータに判定させます。

```
/aidlc enterprise       # Explicit scope
/aidlc Build a payments API  # No keyword: offers composition; resolver fallback is "classic"
/aidlc Fix the login bug     # Auto-detects "bugfix"
```

### 実行時の上書き

ワークフローの途中でもスコープは変えられます。

- **どの承認ゲートでも**: 別のスコープや深度を求める
- **ユーティリティコマンド**: `/aidlc --scope enterprise` でアクティブなスコープを変える
- **ステージの取り込み**: Ideation と Inception の承認ゲートで、一度飛ばしたステージをワークフローに戻せる

---

<a id="change-control"></a>

## インテント設定

インテントには `depth`、`test-strategy`、`review`、`change-control`、`sensors`、`learnings`、`summary-confirmation` の7設定があります。この順序で扱い、すべて単一の原子的な設定処理 `config-change` を使います。スラッシュフラグと `config set` は同じ処理への入口です。個別の更新を連結せず、一つのコマンドにまとめられます。

```
/aidlc --depth standard --test-strategy minimal --review advisory --change-control relaxed --sensors off --learnings on --summary-confirmation off
/aidlc config set change-control strict --sensors on --learnings on
/aidlc --scope bugfix --review none --change-control relaxed --sensors off
```

ネイティブ版では `aidlc engine config set <key> <value>` に残りの `--key value` を続けます。`config get <key>` は7キーすべてに対応し、`config list` は全設定を返します。Change Control と手続きについては、実効値と設定元も含みます。JSON は `--json` を付けます。

```
/aidlc config get change-control
/aidlc config get summary-confirmation
/aidlc config list --json
```

`config-change` が受け付けるのは上記の設定フラグと `--intent`、`--space`、`--project-dir` だけで、設定を一つ以上指定する必要があります。

```bash
bun .claude/tools/aidlc-utility.ts config-change --change-control relaxed --sensors off --intent login-fix --space platform --project-dir /work/shop
```

セレクターはアクティブなカーソルを変えず、状態・memoryのポリシー・監査を同じインテントへ向けます。変更前に全値を検査し、不正値や未知のフラグがあれば、そのフラグを示して更新全体を拒否します。memory が strict を強制している場合、明示的な relaxed の指定と、同時に指定した設定・スコープ変更をすべて拒否します。strict の明示や無関係な設定は変更できます。状態の読み取り、共通適用処理、監査バッチ、状態の一度の書き込みを単一ロックで扱い、監査に失敗したら状態は変えません。`Last Updated` は設定元を含む保存内容が実際に変わったときだけ更新し、同じ指定の繰り返しは何もしません。

スコープ変更も7設定と同じ適用処理を使います。現在と同じスコープでも設定フラグを適用します。スコープ由来の Change Control と手続きの行は新しい既定値に追随し、人の明示指定と旧記録の未保存行は維持します。memory が strict を強制していても、暗黙のスコープ変更ではスコープ由来の Change Control 行を更新し、実効値は memory が決めます。明示フラグはスコープ既定値より優先し、人の指定として記録します。`review adversarial` は `Review Override` を空文字へ戻すため、ステージ定義とスコープのレビュー上限は引き続き有効です。

### 手続きの切り替え

スコープは3つの手続きの既定値を独立して持ちます。値は `on` / `off` で、省略時は `on` です。Classic はセンサーと学びを `on`、サマリー確認を `off` にします。

| スコープのキー | インテントのフラグ | 全体を無効化する環境変数 | off で省くもの |
| --- | --- | --- | --- |
| `sensors` | `/aidlc --sensors on\|off` | `AIDLC_DISABLE_SENSORS=1` | センサーの実行とゲートでの検査 |
| `learnings` | `/aidlc --learnings on\|off` | `AIDLC_DISABLE_LEARNINGS=1` | ステージの学びの読み書き手順 |
| `summary_confirmation` | `/aidlc --summary-confirmation on\|off` | `AIDLC_DISABLE_SUMMARY_CONFIRMATION=1` | 成果物出力前の独立したサマリー確認 |

優先順位は、無効化する環境変数 `1`、有効なインテント設定、スコープ既定値、`on` の順です。無効化は `aidlc config flags --bypass <NAME>` でも記録できます。新規インテントは `aidlc-state.md` の `Change Control` の後に `Sensors`、`Learnings`、`Summary Confirmation` を、`on (from scope classic)` のような設定元付きで保存します。フラグを指定すると `set by you` となり、`CEREMONY_SET` を記録します。`/aidlc --status` は実効値と設定元を表示します。スコープ変更はスコープ由来の値だけを更新し、個別指定は維持します。行がない、または不正な場合は、実行を止めずスコープの値に戻ります。

これらを無効にしても、承認ゲート、Plan Approval、人間のターンの権限、監査、チームの Unit 間の書き込み保護は残ります。Classic は Walking Skeleton を省き、ゲート付き実行のレビューを advisory に抑えますが、明示的な自律実行ではマージ前の一度のレビューを維持します。

`--single` の単独実行は、メインインテントの上書きではなく、選択したスコープのポリシーを使います。そのスコープを単独実行のステージ開始イベントへ記録し、完了まで固定します。異なるスコープでの再開は拒否します。スコープを記録しない旧形式の単独開始では、サマリー確認を維持し、スコープ一致の検査はしません。

### Change Control

Change Control は設定 1 つ、値は `strict` と `relaxed` の 2 つです。すでに承認または確認したものの入力が変わったときの扱いを決めます。コード計画を承認したあとにソースが動いた、レビュー済み文書がレビュー後に編集された、現在の要約確認無しで出力が保存された、などです。

- `strict` は承認を開き直します。実行は、何が変わったかを 1 文で名指しして止まり（例: `2 files changed since this plan was approved: src/api.ts, src/db.ts. Look them over and approve the plan again to continue.`）、もう一度尋ねます。
- `relaxed` は進みます。変化は監査証跡に `CHANGE_ACCEPTED` として 1 行残り、1 行で知らせ（`... Continuing (Change Control: relaxed). Say 'review the plan again' to reopen approval.`）、実行は続きます。承認とその証拠は消しません。そのまま残します。

どちらの値もゲートは外しません。承認の質問は毎回出ます。レビュアーの判定は変わりません。承認した計画そのもの（またはテスト指示、Testing Contract）を編集すると、どちらの値でも承認が開き直ります。Change Control が決めるのは、入力変化の帰結だけです。フレームワークが気づくかどうかではありません。

#### スコープごとの既定

| スコープ | 既定 |
|-------|---------|
| enterprise, security-patch, infra | strict |
| poc, express, classic, bugfix, feature, mvp, refactor, workshop | relaxed |

compose したスコープは、ゲートでコンポーザーが提案し人が承認した値を持ちます。一致した配布スコープは、そのスコープの既定です。

#### 設定する場所は 3 つ

1. **スコープファイル。** `scopes/aidlc-<name>.md` の `change_control: strict | relaxed` が、そのスコープの新しいインテントの開始値です（ないときは strict）。
2. **メモリ。** `aidlc/spaces/<space>/memory/org.md`、`team.md`、または `project.md` の `## Change Control` に 1 行 `Mode: strict` があると、リポジトリの全員に strict が効きます。scope とインテント値に優先します。明示的な relaxed 指定は、併記した設定や scope 変更を含むコマンド全体を拒否し、memory ファイルを示します。`Mode: relaxed` または空の節は何も変えません。それ以外の値は、ファイルと許される 2 値を名指しする検証エラーです。
3. **インテント。** `/aidlc --change-control strict|relaxed`、`/aidlc config set change-control <value>`、通常の会話による要求は共通の config-change を使います。他の設定フラグと同じトランザクションで適用でき、status は `Change Control: relaxed (set by you)` のように表示します。

#### 値の置き場所

解決した値は、インテント作成時に `aidlc-state.md` へ `- **Change Control**: <value> (from scope <name>)` として書かれ、フラグまたはチャット依頼で書き直され、値だけを読みます。状態ファイルはインテントと一緒にコミットするので、セッションを越えて残り、同僚も同じ値を見ます。実行中のインテントの実効値を変えるメモリ編集は、Change Control の対象となる検査の次の実行で、そのメモリファイルを名指しする `CHANGE_CONTROL_SET` 行として残ります。この欄がない昔のインテントは、設定するまで `strict (not set)` です。無効な欄は `/aidlc --change-control strict|relaxed` で直すまで使えません。次のインテントは、またそのスコープの既定から始まります。

---

## ステージのカスタマイズ

各ステージは `.claude/aidlc-common/stages/[phase]/` の独立した `.md` です。ステージファイルが書くのは次です。

- **Metadata** — ステージ番号、フェーズ、実行モード、リード / サポートエージェント
- **Inputs** — 読む先行成果物
- **Steps** — 番号付きの実行手順
- **Outputs** — 出す成果物
- **Completion** — 承認ゲートの形

振る舞いを変えたいときはステージファイルを直接編集します。承認ゲート、質問の形、状態追跡など共通の型は、全ステージがステージプロトコルを参照します。

### 深度

各スコープに既定の深度があり、成果物の詳しさを決めます。

| 深度 | 内容 |
|------|------|
| **Minimal** | 短い成果物。狙いを絞った分析。任意の内容は書かない |
| **Standard** | バランス。主と副の関心を覆う |
| **Comprehensive** | 全部。厚い分析。任意の内容も含める |

どの承認ゲートでも、別のレベルを求めて上書きできます。

---

## ステータスライン（Claude Code のみ）

**Claude Code** では、ターミナルのステータスバーにワークフロー進捗が出ます。ほかのハーネスにステータスラインはありません。位置は `/aidlc --status`（Kiro、Cursor、opencode）と、`update_plan` のタスク進捗 + `$aidlc --status`（Codex）で見ます。

```
[AIDLC] IDEATION [▓▓▓▓▓░░░░░] 4/7 > Intent Capture -- Product Agent
```

順に、現在のフェーズ、フェーズ内進捗（バーと比率。どちらも今のフェーズ範囲）、ステージの表示名、リードエージェントです。右にコンテキスト使用量（例: `ctx:15%`）。残りが減ると色が変わります。Claude の usage ledger にデータがあれば、続けて `↑<in> ↓<out> $<usd>` が出ます。対象はアクティブなワークフローと今のトランスクリプト / セッションだけで、以前のワークフローやセッションは入りません。`AIDLC_DISABLE_USAGE_TRACKING=1` で使用量追跡を止め、この区間も消えます。

### 設定

ステータスラインは `.claude/settings.json` です。

```json
"statusLine": {
  "type": "command",
  "command": "bun \"$CLAUDE_PROJECT_DIR/.claude/tools/aidlc.ts\" engine statusline"
}
```

### 表示のカスタマイズ

`.claude/hooks/aidlc-statusline.ts` を直接編集します。出力形式はファイル末尾近くの `main()` です。フックは `aidlc-state.md` からフェーズ、ステージ、エージェントを読み、ステージスラッグを表示名にマップし、同じフェーズ内チェックボックス解析から unicode の進捗バーと `n/m` 比率の両方を作ります。

### ステータスラインを消す

`settings.json` から `statusLine` ブロックを削除します。ターミナルのステータスバーは Claude Code の既定に戻ります。

---

## ツール権限

`.claude/settings.json` の `permissions.allow` は、Claude Code のツールを事前承認するので、呼び出しごとの許可プロンプトなしでワークフローが実行されます。

```json
"permissions": {
  "allow": [
    "Read", "Edit", "Write",
    "Bash(bun .claude/tools/*)",
    "Bash(date -u *)", "Glob", "Grep", "Task", "WebSearch"
  ]
}
```

コピー版は `Bash(bun .claude/tools/*)`、ネイティブ版は `Bash(aidlc engine *)` を事前許可します。`Bash(date -u *)` は時刻取得用です。裸の Bash は許可しません。複合コマンドの各要素は個別に照合し、安全と認識する固定の環境変数以外は取り除かないため、`cd ... &&`、絶対 `$CLAUDE_PROJECT_DIR` パス、`VAR=1`、jq への pipe、`$(...)` で包むと確認が必要です。プロジェクト固有の build / test コマンドも初回に確認し、「Yes, and don't ask again」で `.claude/settings.local.json` に保存します。

### 権限の動き

- **プロジェクト全体の上限**: `settings.json` の許可リストが使えるツールの上限
- **Claude Code のエージェントは既定でセッションのツール一式を継ぐ**。このハーネスでは `disallowedTools: Task` が入れ子のサブエージェント起動を止める
- **任意のエージェント単位の絞り込み**: frontmatter に `tools:` 許可リストを足すと狭まる。省略すれば全部を継ぐ。`tools:` を書くと継承していた MCP ツールは落ちる。残すなら完全修飾の `mcp__<server>__<tool>` も列挙する

### 権限を広げる

許可リストにツールを足すのは、追加能力が要るカスタムステージを書いたときだけにしてください。

### 権限を狭める

許可リストから外すと、使うたびに人手の承認が要ります。`Task` を外すと、委譲する 4 ステージ（2.1 Reverse Engineering パイプライン、2.2 Practices Discovery サブエージェント、2.4 User Stories モブ、3.5 Code Generation サブエージェント）が、委譲のたびに許可を聞きます。ワークスペース検出（0.2）は `aidlc-utility intent-create` の中で決定論的に実行されるので、`Task` は使いません。

---

## AI-DLC を広げる

ここまでの設定・スコープ・深度・ステージ編集は、回しているワークフローの日常チューニングです。フレームワークそのものをチーム向けに作り変えたい（ステージやエージェントを足す、スコープを定義する、常設ルールを教える、決定論的検査を配線する、ドメインナレッジを足す）のは別の仕事で、案内も別です。**[Harness Engineer Guide](../harness-engineering/00-overview.md)**。

境目はデータかコードかです。あのガイドにあるのは YAML frontmatter 付き Markdown か、フレームワークが読む JSON 設定だけで、TypeScript は触りません。拡張ごとの入り口:

| やりたいこと | 最初に見る場所 |
|--------------|----------------|
| ステージの中身を変える、またはステージを足す | [Anatomy of a Stage](../harness-engineering/01-anatomy-of-a-stage.md)、[Adding a Stage](../harness-engineering/02-adding-a-stage.md) |
| エージェントを足す、または直す | [Adding an Agent](../harness-engineering/03-adding-an-agent.md) |
| スコープを定義する、または調整する | [Scopes](../harness-engineering/04-scopes.md) |
| 常設ルールを教える、またはラーニングループを回す | [Rules and the Learning Loop](../harness-engineering/05-rules-and-the-loop.md) |
| 決定論的検査（センサー）をステージに配線する | [Sensors](../harness-engineering/06-sensors.md) |
| チームのドメインナレッジを足す | [Team Knowledge](../harness-engineering/07-team-knowledge.md) |

フレームワークの *コード*（オーケストレータ、フック、CLI ツール、コンパイルパイプライン）を触るなら [Developer Reference](../reference/00-overview.md) です。

---

## ナレッジとルール

二層のナレッジと、ルール / ラーニングループの詳細は次です。

- [ナレッジ](08-knowledge.md) — チームナレッジディレクトリと方法論の参照ファイル
- [ルールとラーニングループ](09-rules-and-the-learning-loop.md) — 振る舞いルールと自己学習の流れ

---

## 次の章

- [スコープ・深度・テスト戦略](05-scopes-and-depth.md) — スコープからステージへの対応
- [エージェント](06-agents.md) — エージェントの権限と能力
- [トラブルシュート](15-troubleshooting.md) — ステータスライン、フック設定
- [用語集](glossary.md) — スコープ、深度、ガードレール、ナレッジ
