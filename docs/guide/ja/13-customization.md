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

> 同梱設定は特定のモデルプロバイダーを選びません。現在のハーネス設定を引き継ぎます。

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

## インテント設定

7つの基本設定は `depth`、`test-strategy`、`review`、`guard-policy`、`sensors`、`learnings`、`summary-confirmation` です。加えて `guard.plan-approval`、`guard.review-freeze`、`guard.state-transition`、`guard.reviewer-scope` の4キーで、その作業だけ個別ガードを切り替えます。CLIは原子的な `config-change` を共有します。人が入力したコマンドでガードを下げる場合は、human-turnフックが併記された設定も同一トランザクションで検査・適用します。

```text
/aidlc --depth standard --test-strategy minimal --review advisory --guard-policy relaxed --sensors off --learnings on --summary-confirmation off
/aidlc config set guard-policy strict --sensors on --learnings on
/aidlc --scope bugfix --review none --guard-policy relaxed --sensors off
```

ネイティブCLIでは `aidlc engine config set <key> <value>` に残りの `--key value` を続けます。`config get` と `config list` は11キーを読み取り、Guard Policy・個別ガード・手続きについては実効値と設定元も返します。`--json` も使えます。

```text
/aidlc config get guard-policy
/aidlc config get guard.plan-approval
/aidlc config get summary-confirmation
/aidlc config list --json
```

入力したset/get/listはディスパッチ中に実行し、そのターン内に実際の結果または拒否理由を返します。成功してもワークフローは進めません。ガードを下げる処理はhuman-turnフックが担当します。読取り専用の `guard.human-presence` は `on (default)` または `off (env AIDLC_SKIP_HUMAN_PRESENCE_GUARD)` を返しますが、作業単位の設定ではなくlistにも含みません。

`config-change` が受け付けるのは設定フラグと `--intent`、`--space`、`--project-dir` です。設定を1つ以上指定します。セレクターはアクティブカーソルを変えず、状態・memory・監査を同じインテントへ向けます。

```bash
bun .claude/tools/aidlc-utility.ts config-change --guard-policy strict --sensors off --intent login-fix --space platform --project-dir /work/shop
```

ガードを下げる場合、人が `/aidlc config set guard-policy relaxed --intent <name> --space <name>`、またはフラグ形式 `/aidlc --guard-policy relaxed --intent <name> --space <name>` を入力します。フラグ形式では末尾にタスクの説明を付けられます。存在しないインテントは拒否し、状態ファイルがない場合は作業を作成してから再入力します。

すべての値を変更前に検査します。不正値、未知フラグ、memoryのstrictに反する明示的なrelaxed/offは、併記した設定やスコープ変更も含めて全体を拒否します。strictへの変更と無関係な設定は可能です。状態読取り・適用・監査バッチ・状態書込みを1ロックで処理し、監査失敗時は状態を変えません。`Last Updated` は設定元を含む保存内容が変わる場合だけ更新します。同じ指定の繰返しは何もしません。

スコープ変更も同じ処理です。現在と同じスコープでも明示フラグを適用します。スコープ由来のGuard Policyは、より厳しい既定値には追随しますが、より弱い既定値では現在値を維持します。手続きは新スコープの既定値に追随します。人の上書きと旧記録の未保存行は維持し、memoryは引き続き実効値を決めます。明示フラグによる弱化にも人の入力が必要です。`review adversarial` は `Review Override` を空に戻し、ステージ定義とスコープ上限に従います。

### 手続きの切り替え

同梱スコープは3つの手続きをすべて明示します。省略した独自スコープでは `on` が既定です。Classicはsensors/learningsがon、summary confirmationがoff。Expressだけが3つともoffです。

| スコープキー | インテントのフラグ | 全体を無効化する環境変数 | offで省くもの |
|---|---|---|---|
| `sensors` | `/aidlc --sensors on\|off` | `AIDLC_DISABLE_SENSORS=1` | センサー実行とゲート検査 |
| `learnings` | `/aidlc --learnings on\|off` | `AIDLC_DISABLE_LEARNINGS=1` | ステージの学びの読み書き |
| `summary_confirmation` | `/aidlc --summary-confirmation on\|off` | `AIDLC_DISABLE_SUMMARY_CONFIRMATION=1` | 成果物出力前の独立した要約確認 |

優先順位は無効化環境変数の `1`、有効なインテント設定、スコープ既定値、onの順です。環境変数は `aidlc config flags --bypass <NAME>` でも記録できます。新規インテントは `aidlc-state.md` のGuard Policyの後に3設定を、`on (from scope classic)` などの設定元付きで保存します。明示フラグでは `set by you` と `CEREMONY_SET` を記録し、statusは実効値と設定元を表示します。不在・不正な行はスコープ既定値へ戻り、実行を止めません。

これらは承認ゲート、Plan Approval、人間の回答、監査、チームのUnit間書込み保護を省きません。Classicはwalking-skeleton手続きを省き、確認付き実行のレビューをadvisoryに抑えます。明示的な自律実行ではマージ前の1回のレビューが残ります。

独立した `--single` は主インテントの上書きではなく、選択スコープの方針を使います。スコープを合成STAGE_STARTEDに保存し、別スコープでの再開を拒否します。スコープ未記録の旧形式は要約確認を維持し、この比較は行いません。

<a id="change-control"></a>
<a id="guard-policy"></a>

### Guard Policy

値は **strict / relaxed / off** です。承認後に入力が変わったときの扱いと、ワークフローから求められていない操作へのガードを決めます。

| 値 | 承認済み入力の変更 | 下げる個別ガード |
|---|---|---|
| strict | 変更を示して再承認を求める | なし |
| relaxed | `CHANGE_ACCEPTED` と案内を1回記録し続行 | plan-approval、review-freeze |
| off | relaxedと同じ | 上記に加えstate-transition、reviewer-scope |

どの値でもhuman-presenceと、所有権のあるcheckoutから別Unitへ書くことの禁止は維持します。下げたガードを通過するたびに監査を記録します。元の承認・証拠・レビュー判定は書き換えません。

同じインテント・Unit／stage・attempt内で計画、テスト指示、Testing Contractが変わった場合、実効plan-approvalがoffなら強制再承認なしで続行します。Testing Posture、scope、test strategy、project typeの変更でも、契約と指示を更新して続行できます。strict既定または `guard.plan-approval on` なら再承認を求めます。最初のPlan Approvalと他の必須ゲートは残り、必要なら人が計画の再レビューを求められます。既存の委譲workerも、検証済み親インテントの現在の方針を次の検査から使います。

#### スコープごとの既定

enterprise / security-patch / infraはstrict、それ以外の8スコープはrelaxedです。

#### 設定する場所は3つ

1. **スコープ:** frontmatterの `guard_policy: strict|relaxed|off`。省略時はstrictです。新規作業ではスコープ既定値を使います。
2. **memory:** org → team → project → phaseの `## Guard Policy` に `Mode: strict|relaxed|off` を置きます。いずれかのstrictが優先し、インテント側から下げられません。不正値はファイル名と許可値を示して拒否します。
3. **インテント:** 人が `/aidlc --guard-policy relaxed`、`/aidlc --guard-policy off`、対応するconfig set、または `guard policy relaxed` / `guard policy off` を入力します。human-turnフックが対象の状態と監査を更新します。曖昧な自然文の弱化要求には、実行する代わりに入力すべきコマンドを示します。strictへの自然文要求は設定コマンドで直ちに上げられます。Kiro IDEがprompt本文を渡さない版では、進行中の作業を弱められません。IDEを更新するか、弱い既定スコープで新しい作業を始めます。

#### 値の置き場所と旧名称

状態には `- **Guard Policy**: <value> (from scope <name>)`、明示設定では `(set by you)` を保存します。セッションを越えて共有され、memory編集で実効値が変われば、次の対象検査時にファイル名付きの `GUARD_POLICY_SET` を記録します。未設定の旧インテントは `strict (not set)`、不正行は修復するまで利用不可です。

旧名称はこの版で読めますが、次のminor版で廃止予定です。`change_control`、`Change Control`、`## Change Control`、`--change-control`、`change-control` が対象です。旧フラグ／configキーには新名称の案内を表示します。新しい書込みでは旧行を取り除き、監査には `GUARD_POLICY_SET` を使います。旧 `CHANGE_CONTROL_SET` の読取りは維持します。

新旧の状態行が異なる値ならstrictとなり、statusは `strict (from conflicting state lines)` を表示します。memoryのstrictはさらに優先します。同値なら新行を使用します。どちらを採用するか人が選ぶまで、nextは両方の生の値と選択方法を案内し、表示だけでは状態を書き換えません。旧relaxed/offだけがある作業には、plan-approvalとreview-freezeも下がることを繰り返し案内します。人が新名称で値を選ぶと書換えとともに案内が終了します。旧strictにはこの案内は出ません。

### 5つの個別ガード

| ガード | 拒否する操作 | 作業単位のキー | 全体を無効化する環境変数 |
|---|---|---|---|
| Plan approval | 計画承認前のコード生成 | `guard.plan-approval` | `AIDLC_DISABLE_PLAN_APPROVAL_GUARD=1` |
| Review freeze | レビュー証拠取得後の対象編集 | `guard.review-freeze` | `AIDLC_DISABLE_REVIEW_FREEZE_HOOK=1` |
| State transition | ワークフローの指示を外れた直接の状態操作 | `guard.state-transition` | なし |
| Reviewer read scope | 委譲レビュアーによる別Unitの読取り・検索 | `guard.reviewer-scope` | `AIDLC_DISABLE_REVIEWER_SCOPE_HOOK=1` |
| Human presence | 実際の人間のターンのない承認・回答 | なし | `AIDLC_SKIP_HUMAN_PRESENCE_GUARD=1` |

```text
/aidlc config set guard.plan-approval off
/aidlc config set guard.plan-approval on
```

下げる操作は人自身の入力で行います。human-turnフックが `--intent` / `--space`、省略時はpayloadのセッション選択に適用し、状態と監査を記録します。CLI setterだけでは弱化せず、後で使う許可の保存もしません。すでにoff、または同値でset by youの無変更操作には新たな許可は不要です。画面の「この作業の検査をoffにする」を選んだだけでは実行せず、入力するコマンドを案内します。Codexでは `/aidlc` を `$aidlc` に読み替えます。

認める入力は、`/aidlc`（または `$aidlc`、`aidlc`）で始まり説明より前に設定フラグを置いたメッセージ、`config set guard-policy relaxed|off`、`config set guard.<fence> off`、単独の `guard policy relaxed|off` です。config形式の末尾にはintent/spaceを各1回だけ追加できます。それ以外の追加トークンは適用しません。大文字小文字と末尾の句点は問いません。設定に言及した質問、説明文より後ろのフラグは変更になりません。

作成時にスコープ既定値とは異なるrelaxed/offを直接指定する操作は拒否します。まず作成し、人が切替えを入力します。スコープ変更で既定が弱くなる場合も現在の厳しい値を維持します。`AIDLC_UNATTENDED=1` はprompt時の適用とCLI弱化を拒否します。memory strictとunattendedの検査後、テスト／ハーネス起動時のpresence bypassだけがCLIによる弱化を可能にし、ツール実行時の環境変数追加では許可を作れません。モデルのツールからhook呼出しやセッション／Plan Approval内部領域への書込みはできません。

memoryがstrictならoff要求はそのファイルを示して拒否し、以前に保存したGuards Offよりも優先します。保存行は残るため、memory strictを外すと再び効きます。onへの変更は可能で、マシン全体の無効化はmemoryより優先します。

offは `Guards Off` 行と `GUARD_DISABLED`、onはその一覧からの除去と `GUARD_RESTORED` を記録します。onでは `Guards On` にも保存し、policyが下げたガードを上げられます。human-presenceはこれらの行に保存しても無視します。statusの `Fences:` が5項目の実効値と設定元を示します。優先順位は全体無効化、memory strictがなければ作業のoff、作業のon、Guard Policy、既定onです。

reviewer-scopeは読取り・検索の境界です。チームUnit所有権による別Unitの `construction/` 書込み禁止は、Guard Policyや個別設定・環境変数では解除できません。human-presenceもpolicyと作業の設定では下がりません。`AIDLC_UNATTENDED=1` は人間のターン生成を止めるもので、ガードを下げる設定ではありません。

### 誰の指示による操作か

ガードは操作を、最後のワークフロー指示以後の人間のターン、エンジンが現在実行中の指示、どちらにも該当しない操作に分類します。判読できない場合は最も狭い権限と扱います。委譲時の権限をagent台帳に記録し、子agentへ継承します。agent自身は許可を作れません。この分類は弱化の許可とは別です。下げたガードを通過したときの監査が、その時点の指示元を説明するためのものです。strictで承認入力が変わった場合は分類にかかわらず確認します。

### ガードの結果の表示

- **通過:** 下げた理由を1行示し、`GUARD_STOOD_ASIDE` にガード・権限・根拠・実行者を記録します。再確認は挟みません。Claudeではユーザー向けのhook systemMessage、Codex/opencode/Kiro CLIでは通常行です。Kiro IDEの該当hook出力は見えないため監査を読みます。まだ監査台帳のない新規プロジェクトでは行も監査も残らない場合があります。
- **拒否:** メインセッションには不足条件と入力すべき切替えを示します。memory strictなら編集するmemoryファイルを示します。委譲agentには切替え文を示さず、メインセッションへ戻します。human-presenceは新しい人間の回答を求め、切替えを案内しません。
- **再確認:** strictで承認済み入力が変わった場合、変更点を示して一度確認します。

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
