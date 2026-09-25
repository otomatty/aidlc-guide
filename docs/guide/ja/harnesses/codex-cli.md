# Codex CLI で AI-DLC を動かす

Codex ランタイムは、フレームワークのハーネス配布の一つで、OpenAI **Codex CLI** ハーネス向けです。決定論的なコアは一つ、ハーネスは複数。エンジン、状態機械、監査ログ、グラフ、スウォームの審判、ラーニングゲートは、どの配布でもバイト一致です。違うのはシェルだけです。ソース／開発用のディレクトリツリーは `core/` + `harness/codex/` から `bun scripts/package.ts codex` で、無視されるローカル `dist/codex/` へ **生成** されます。手で編集しないでください。

プロジェクトの `.codex/config.toml` の `developer_instructions` がオンボーディングを提供します。信頼したプロジェクトでは、ファイルを読ませなくてもセッションに届きます。`.codex/onboarding.md` は同じ内容の人間向けコピーです。ルートの `AGENTS.md` はこのコピーを案内するハーネス共通ブロックとなり、エンジンディレクトリの異なるハーネスと共有できます。新しいセッションでAI-DLCコマンドを尋ね、`$aidlc` と `.agents/skills/` が案内されることを確認してください。

## 前提条件

- **Codex CLI >= 0.145.0** — それより前のリリースは、ターン途中の自動コンパクションのあと compact 由来の `SessionStart` を遅らせるので、復元したワークフローの使命無しでモデルの継続が 1 回実行されることがあります。0.139.0 より前は、サブエージェントの役割帰属とハイフン付きエージェント TOML の解決も信頼できません。`/aidlc --doctor` がピンを案内します。確認は `codex --version`。
- **bun** は、ソース／開発用の `dist/` 投影を生成または実行するときだけです。ネイティブ導入と版付きリリースランタイムは自己完結です。
- **対象プロジェクトが Git リポジトリであること** — Codex がプロジェクトの `.codex/hooks.json` を見つけるのはその中だけです。ネイティブインストーラと AI-DLC ランタイム自体は Git に依存しません。
- **モデルプロバイダー** — 同梱設定はプロバイダーを選びません。`~/.codex/config.toml` からプロバイダー、認証、モデル、コンテキスト長、reasoning effortを継承します。agentもモデルを継承し、balanced reviewerはmediumのeffort上限だけを持ちます。プロバイダー設定はユーザーファイルへ置きます。プロジェクトの `model_provider` / `model_providers` は使われません。信頼済みプロジェクトの `model` などはユーザー設定より優先するため、共有上書きが必要な場合だけ追加します。

## インストール

### ネイティブチャネル（推奨）

```bash
tmp="$(mktemp -d)"
curl -fsSL \
  https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh \
  -o "$tmp/install.sh"
sh "$tmp/install.sh"
rm -rf "$tmp"
cd your-project
aidlc config
aidlc doctor
codex
```

インストーラは、リリースのメタデータ、実行ファイル、全ハーネスのランタイムアーカイブを、公開された SHA-256 チェックサムに対して検証します。入れたランタイムに Bun、Node.js、Git は不要です。ハーネスの選択は `aidlc config` で行います。

Windows では `install.ps1` をダウンロードし、`& $installer` で実行します。対話実行ではフラグを省略できます。リダイレクトした入力、`pwsh -NonInteractive`、`--yes`、`--json`、`--quiet` ではフラグが要ります。エアギャップのパッケージでは、Unix は `install.sh --from <release-directory> --offline`、Windows は `& $installer -From <release-directory> -Offline` です。

`aidlc config` は Codex シェルを投影し、`.gitignore` と `AGENTS.md` の AI-DLC ブロックをマージし、`.codex/config.toml`、フック、権限ルール、対応する `.codex/trust-seed.toml` を書きます。それらのフックが実行される前に、Codex はプロジェクト固有のフック信頼操作を 1 回求めます:

- `codex` を始め、フックダイアログで **Trust all and continue** を選ぶ。または
- `.codex/trust-seed.toml` の `<PROJECT_DIR>` をプロジェクトの絶対パスに置き換え、その完全な `[hooks.state]` 集合を `$CODEX_HOME/config.toml` へマージする。同じフックパスの既存集合は置き換えてください。重複する TOML テーブルを足さないでください。

生成された `.codex/config.toml` はプロジェクトに置きます。`developer_instructions` にこのプロジェクトのAI-DLC案内が入るため、ユーザー設定へ丸ごとマージしません。プロバイダーとモデルはユーザー設定に置き、Codexで `$aidlc --doctor` を実行します。

`sandbox_mode = "workspace-write"` はTOMLのトップレベル設定で、`[shell_environment_policy]` の中には置きません。フレームワーク所有なので、プロバイダー回答で変わることはありません。通常の更新では編集・削除を競合として報告します。明示的な `aidlc config --force` はユーザーのproviderテーブルを保持して同梱値を復元します。current選択は由来を確認できる旧Bedrock既定値だけを除去し、sandbox方針は変えません。

### 版付きの手動コピー（代替）

特定リリースの `aidlc-copy-runtime-X.Y.Z.tar.gz` を、[Install and Lifecycle: コピー経路](../18-install-and-lifecycle.md#コピー経路) のとおりダウンロードして展開し、`RUNTIME_ROOT` を展開した `runtime/` ディレクトリにします。

1. 配布をプロジェクトへコピーします（プロジェクトは **git リポジトリ** である必要があります。Codex がプロジェクトの `.codex/hooks.json` を見つけるのはその中だけです）:

   ```bash
   cp -r "$RUNTIME_ROOT/codex/.codex/"  your-project/.codex/
   cp -r "$RUNTIME_ROOT/codex/.agents/" your-project/.agents/
   cp -r "$RUNTIME_ROOT/codex/aidlc/"   your-project/aidlc/      # the workspace shell (spaces/default/memory) — a sibling of .codex/, not inside it
   cp "$RUNTIME_ROOT/codex/AGENTS.md"   your-project/AGENTS.md   # or merge into yours
   ```

   `aidlc/` ディレクトリはワークスペースシェルです。エンジンが読む、あらかじめ組んである `aidlc/spaces/default/memory/` の方法論ツリーを同梱します。`.codex/` の **兄弟** なので、別途コピーします（または `$RUNTIME_ROOT/codex/` 一式をまとめてコピーします）。ないと `$aidlc --doctor` の "workspace shell ready" 検査が落ちます。

2. ワークフローを始める **前に**、出荷の `AGENTS.md` の 「Git Integration」節から `.gitignore` エントリを入れてください。各インテントの `audit/` の下のクローンごとの監査シャードは意図してコミットします（クローンごとに自分の `<host>-<clone>.md` を書くので、並行追記が git 衝突しません）。ユーザーごとのカーソルとマシンローカルのランタイム状態は無視したままです。

3. プロジェクトを信頼し、フック信頼を事前シードします。Codex は未信頼のフックを実行しません（`--dangerously-bypass-hook-trust` フラグでも実行しません）。対話 TUI を一度実行し、フックダイアログで "Trust all and continue" を選ぶか、AI-DLC のソースチェックアウトから決定論的に事前シードします。ピンした開発依存を一度入れ、エントリを生成します:

   ```bash
   bun install --frozen-lockfile
   bun scripts/package.ts codex trust --project "/abs/path/to/your project"
   ```

   コマンドは `$CODEX_HOME/config.toml` へ貼れる `[hooks.state]` エントリを出します（ハッシュがカバーするのはフックの識別情報であり、パスではありません。出荷の `hooks.json` に対してエントリは正確です）。コマンドは出力全体を TOML として直列化するので、引用パス、空白、Windows のバックスラッシュは残ります。フックマニフェストが `<project>/.codex/hooks.json` にないときは、正確なパスを明示してください:

   ```bash
   bun scripts/package.ts codex trust \
     --project "/abs/path/to/your project" \
     --hooks-json "/abs/custom path/hooks.json"
   ```

   両方の引数をシェルで引用してください。`--hooks-json` は Codex の信頼識別情報としてそのまま使います。エントリを生成したあと正規化したり置き換えたりしないでください。コマンドの stdout 全体をユーザー設定へ貼ります。同じ `hooks.json` パスのエントリが既にあるときは、その集合をまるごと置き換えてください。二通目を足さないでください。重複する TOML テーブルは設定全体を無効にします。

   AI-DLC のアップグレードが `.codex/hooks.json` を変えたとき（新しいマッチャーを足すアップグレードも含む）は、この trust コマンドを再実行してください。新しい Codex セッションを開く前に古いテーブルを置き換えます。そうしないと Codex は新しいフックを静かに飛ばします。

4. `your-project/` に戻り、同梱設定を信頼済みプロジェクトの `.codex/config.toml` に保持します。プロジェクト固有の `developer_instructions` があるため、`~/.codex/config.toml` へ丸ごとマージしません。確認は次です:

   ```bash
   cd your-project
   bun .codex/tools/aidlc-utility.ts doctor
   ```

版付きランタイムはネイティブの `aidlc` コマンドを使います。Bun 形の投影が要るフレームワーク開発者は、リポジトリを clone し、`bun install --frozen-lockfile` と `bun scripts/package.ts` を実行し、無視されるローカル `dist/codex/` 出力を使えます。ソースチェックアウトの trust 生成は、それらの Bun 形フックコマンド向けであり、ネイティブランタイムでは使いません。

## 更新と版のずれ

`aidlc update` はマシンのランタイムを更新しますが、プロジェクトは書き換えません。`aidlc doctor` は、プロジェクトのランタイムスタンプを選んだエンジンと比べます。ワークフローの実行と実行の間に、プロジェクトの更新をプレビューして適用します:

```bash
aidlc config --dry-run
aidlc config
```

config はユーザー所有の内容を残し、ローカルのフレームワーク編集を衝突として出します。いずれかのワークフローがアクティブなあいだは更新を拒否します。先にワークフローを完了してください。アップグレードとロールバックは、プロジェクトファイルを触らないので、ワークフロー中でも安全です。更新は Codex のフック識別情報を変えることがあるので、Codex が求めたときは新しい信頼ダイアログを承認するか、config のあと対応する trust-seed エントリを置き換えてください。

## 使い方

オーケストレータの起動は `$aidlc`（または `/skills` → aidlc）のあとにスコープか説明です。コマンドは Claude ハーネスと同じです（`$aidlc --status`、`$aidlc --config [section]`、`$aidlc --help`、および関連形）。ステージランナーは明示だけです: `$aidlc-domain-design`、`$aidlc-bugfix` など（暗黙のスキル照合から外してあるので、ランナー説明 37 件が索引を汚しません）。

## Claude Code とのハーネス差分

- **ゲート** は、出荷設定のフラグが有効なら `request_user_input` ツールで出します。それ以外は番号付き散文へ落ちます（番号か自由文で答える）。ゲートの意味はどちらでもエンジン側にあります。
- **カスタムステータスラインはありません** — ワークフローの位置は `update_plan` ツール（`task-progress` ステータスライン項目）と `$aidlc --status` に乗ります。
- **サンドボックス下の git**: `workspace-write` は設計上、サンドボックス内の `.git` を読み取り専用にします。対話セッションは自動で昇格し、出荷の `.codex/rules/default.rules` は `git worktree`／`commit`／`add` を事前許可します。ヘッドレス実行（CI、exec ワーカー）は `writable_roots = ["<main repo>/.git"]` が要ります。テンプレートは出荷の `config.toml` にあります（リンクした worktree は `<main>/.git/worktrees/*` へ解決するので、メインリポジトリの `.git` である必要があります）。
- **スウォームフロア = `codex exec` ワーカー** — 出した Construction Unit ごとに、その Unit の Bolt の隔離 worktree でヘッドレスワーカーが 1 体（常に `< /dev/null`）。審判は同じ決定論的なものです。ここには Workflow ツールがないので `AIDLC_USE_SWARM=1` は目立つ劣化です（`SWARM_DEGRADED` が監査されます）。
- **セッションのライフサイクル**: Codex に SessionEnd イベントはありません。閉じていないセッションは、次のセッション開始で推定した `SESSION_ENDED` 監査行として突き合わせます。コンパクションのあと、Codex は `source=compact` の SessionStart を出します。この対応イベントが、コンパクション後の最初の継続の前にワークフローの使命を再注入します。この即時ドレインが、AI-DLC が Codex >= 0.145.0 を求める理由です。
- **成果物監査の忠実度**: ヘッドレスの `codex exec` では、モデルがシェル heredoc でファイルを書くことが多く、`apply_patch` フックマッチャーを迂回します。`ARTIFACT_*` 行は疎になりえます。対話 TUI セッション（システムプロンプトが `apply_patch` を義務付ける）が高忠実度の監査モードです。
- **AIDLC のルール層** はワークスペースルートの `aidlc/spaces/<active-space>/memory/` にあります（手で直せる正本は一つ、どのハーネスでも同じ）。`config.toml` の `AIDLC_RULES_DIR` 環境連携箇所が解決先をそこへ向け、オーケストレータは `@aidlc/spaces/<active-space>/memory/...` のプロンプト言及を注入します。Codex ネイティブの `.codex/rules/` は Starlark の権限ルールで、AIDLC 方法論とは別物です。
- **ウェルカムメッセージはありません**: Claude ハーネスはセッション開始時に `settings.json` の `companyAnnouncements` からフェーズ／ステージ／スコープのオンボーディングバナーを描きます。Codex に同等はありません。セッション開始の経路はワークフロー文脈だけを注入します。
- **MCP サーバー**: Codex は `config.toml`（プロジェクトの `.codex/config.toml` または `~/.codex/config.toml`）の `[mcp_servers.<name>]` テーブルから MCP 定義を読みます。必要なサーバーはそこに足してください。出荷設定は **無し** です（Claude ハーネスは `.mcp.json` で 5 つ出荷。Codex の既定はゼロ）。

## 再生成

```bash
bun scripts/package.ts codex          # regenerate dist/codex from core/ + harness/codex/
bun scripts/package.ts --check        # build twice and byte-compare (every harness)
```

コアの `.ts` ファイルは `core/tools/` と `core/hooks/` のソースとバイト一致です（`tests/unit/t150-codex-packaging.test.ts` がピンします）。散文はパッケージャが `.codex` に置換する `{{HARNESS_DIR}}` トークンを持ちます（加えて `rules/` → `aidlc-rules/` の名前付け替え）。許された変換クラスはこれだけです。実機の通しは `tests/e2e/t-exec-codex-status.serial.test.ts` です（ゲート: `AIDLC_CODEX_EXEC_LIVE=1`）。

## 次のステップ

導入と信頼設定が済んだら、方法論の説明へ進みます。方法論はどのハーネスでも同じです。ハーネス非依存の章へ進んでください。

- [最初のワークフロー](../02-your-first-workflow.md) — 注釈付きの通し実行。
- [フェーズとステージ](../04-phases-and-stages.md) — 5 フェーズと 33 ステージ。
- [スコープ・深度・テスト戦略](../05-scopes-and-depth.md) — 作業に合う実行範囲の選び方。
- [用語集](../glossary.md) — 用語の定義。

ほかのハーネス: [Kiro IDE で AI-DLC を動かす](kiro-ide.md) · [Cursor で AI-DLC を動かす](cursor.md) · [ハーネス一覧](README.md)。
