# コントリビューション

## 概要

この実装への貢献を歓迎します。本ガイドでは前提条件、開発ワークフロー、テスト、変更の提出方法を説明します。

> **パス規約。** 以下の `<record>/` は生成済みインテントのレコードディレクトリ、
> `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` を指します。インテントごとの状態、監査
> シャード、ナレッジ、成果物がここにあります。

## 前提条件

- **Claude Code** -- ネイティブインストール（推奨、自動更新）: マックOS / リナックス / WSL では `curl -fsSL https://claude.ai/install.sh | bash`; Windows PowerShell では `irm https://claude.ai/install.ps1 | iex`。または `brew install --cask claude-code`。（[Claude Code のドキュメント](https://code.claude.com/docs/en/quickstart) を参照）
- **bun** -- ビルド、パッケージ生成、テスト、作成した TypeScript ソースの直接実行、ローカル生成した `dist/<harness>/` の利用に必須です。ネイティブリリースのランタイムは、インストール済みの `aidlc` コマンドを使います。`curl -fsSL https://bun.sh/install | bash` でインストールします。Windows では `powershell -c "irm bun.sh/install.ps1 | iex"` を使います。
- **`timeout`**（GNU コアユーティリティ）-- テストスイートの LLM タイムアウト（L2/L3）に必須。リナックスには標準で入っています。マックOS: `brew install coreutils` のあと GNU 版コマンドパスを PATH に追加: `export PATH="/opt/homebrew/opt/coreutils/libexec/gnubin:$PATH"`（`~/.zshenv` または `~/.zshrc`）。
- **`Bash`** -- POSIX 互換ラッパー（`tests/run-tests.sh`）用の任意依存。主テストランナーは `bun tests/run-tests.ts`。実行時、配布フックはどれも `Bash` を必要としません。
- **Bedrock アクセス** -- ライブ統合テストと `e2e` テスト（L2/L3）の実行に必須。L1 プロトコルテストには不要です。

クローン後、パッケージャー、型検査、テストで使う、バージョン固定済みの開発依存関係をインストールします。

```bash
bun install --frozen-lockfile
```

## リポジトリ構成

```
core/                # Hand-authored, harness-neutral source (tools, stages, agents, rules, knowledge, hooks)
harness/<name>/      # Per-harness authored surfaces; claude/, kiro/, kiro-ide/, codex/, opencode/, copilot/
scripts/package.ts   # The build: materializes ignored local projections (`--check` builds twice and compares)
scripts/build-binaries.ts # Release-only compiled CLI artifacts in ignored build/binaries/ after package --check
dist/<harness>/      # GENERATED + ignored: dist/claude/, dist/kiro/, dist/kiro-ide/, dist/codex/, dist/opencode/, dist/copilot/ — never hand-edit or commit
tests/               # All-TypeScript test suite (t*.test.ts, run via bun)
docs/                # Documentation
  guide/             # User guide (how to use AI-DLC)
  harness-engineering/  # Harness engineer guide (configure AI-DLC without code)
  reference/         # Developer reference (how it works internally)
```

全体アーキテクチャは [アーキテクチャ](01-architecture.md) を参照してください。

## 開発ワークフロー

1. **フォークしてブランチ**を `main`（統合ブランチ、PR の提出先）から切り、`bun install --frozen-lockfile` を実行する
2. **アーキテクチャを読む** -- [アーキテクチャ](01-architecture.md) が実行モデル、エージェント委譲、フックシステムを説明します
3. **エントリポイントを理解する** -- 決定的エンジン `core/tools/aidlc-orchestrate.ts`（サブコマンドは `next`、`continue`、`report`、`park`、`team-board` のちょうど 5 つ。`continue` は内部のステアリング転送用で、`team-board` は Team Construction の読み取り専用クエリ）がルーティングを担当し、コンダクター `harness/claude/skills/aidlc/SKILL.md` はその指示に従う薄い転送ループです。規範となるエンジン / ディレクティブ / コンダクター / スウォーム契約は [スキルシステム](17-skill-system.md) を参照
4. **変更する** -- ハーネス非依存ソースは `core/`（ツール、ステージ、エージェント、フック、ルール、ナレッジ）、ハーネス固有の内容は `harness/<name>/`（オーケストレータースキル、設定）を編集する。その後 `bun scripts/package.ts` で、Git 管理対象外の `dist/` と `dist-release/` をローカル生成する。どちらも手編集やコミットはしない。`package.ts --check` は既存の生成ツリーを使わず、独立した一時ディレクトリに全配布ツリーを 2 回生成し、バイト単位で比較する
5. **テスト** -- 提出前に `bun tests/run-tests.ts` を実行
6. **提出** -- `main` 向けに PR を開く

リリース用バイナリは `dist/` に含まれず、パッケージャーも生成しません。`bun scripts/package.ts --check` が通った後、ホスト用は `bun scripts/build-binaries.ts`、リリース全対象は `--all-targets` を付けてビルドします。スクリプトは各実行ファイルを `build/binaries/<target>/` に置き、その対象の `runtime/<harness>/` に完全な配布ツリーを用意し、`build/binaries/build-results-<target>.json` を書き出します。ビルドホストで実行できる対象は、`PATH` に `bun` がない状態で、センサー、グラフコンパイル、検証、生成内容の検査、プラグインの選択／合成、オーケストレーション、通常 Bolt と自律スウォームの合成、パッケージ済みランタイムの不変性、フック、ステータスライン、アダプター、明示的なプロジェクトルーティング、doctor JSON、init の dry-run、バージョン／プラグイン一覧、Unix 補完、パッケージ検証を実行します。クロスビルドの成果物は内容検査を受け、`UNVERIFIED` と明示されます。ホスト上で実行した成果物は `VERIFIED` になります。用意した `runtime/<harness>/` は読み取り専用の代替ランタイムです。変更を行うコマンドは、インストール済みプロジェクトのハーネスを対象にする必要があります。ゲートが 1 つでも失敗するとビルドは失敗します。

対象バイナリがそろったら、`bun scripts/package-release.ts` がローカルの配布ツリーを再生成・検証し、`dist-release/` をバージョン付き `aidlc-runtime-X.Y.Z.tar.gz` にまとめ、`version.json`、`checksums.txt`、`install.sh`、`install.ps1` を生成します。対象別の `runtime/` ディレクトリはスモークゲート用です。リリースのデータアーカイブは、それらをコピーせず、新しく生成したネイティブ配布ツリーから作ります。`--require-release-matrix` は 7 対象すべてと、各バイナリに一致する検証記録を必須にします。生成される単一階層のディレクトリが、インストーラーと `release packaging tooling` の受け渡し契約です。

リリースワークフローは、検証した候補を公開まで維持します。検証とインストーラーの lint を先に実行し、対象ごとのネイティブジョブでバイナリと証拠を作ります。`package-release.ts` は 1 回だけ実行して `release-candidate` を作成します。ステージングジョブは署名をせず、チェックサムを検証してアップロードし、Unix／Windows のライフサイクルジョブは同じバイト列を使います。`publish` は候補を再検証して証明を付け、エクスポートしたバンドルを加え、全資産を検査して 1 つの `attested-release` 成果物をアップロードします。`release` はタグとチェックサムを再確認し、`GITHUB_TOKEN` でこのリポジトリに GitHub Release を作成して、アップロード済み資産の一覧を検証します。候補の再ビルド、再パッケージ、差し替えは行いません。

stable リリースは、プッシュされたバージョンタグを起点に `.github/workflows/release.yml` で実行します。独立した `.github/workflows/preview-release.yml` は、定期実行または手動実行で `main` から preview を作り、呼び出し可能な CI を通し、`AIDLC_BUILD_VERSION` を埋め込み、注釈付きタグのプレリリースとして公開します。preview は「latest」になりません。公開は UTC 日付ごとに最大 1 回です。定期実行と手動実行は `release-preview` の同時実行制御を共有します。後続の実行はリリース一覧を再取得し、その日の preview が公開済みなら、`main` が進んでいてもスキップします。ソースに変更がない場合もスキップします。下書きとリリースを持たないタグは、その日の公開枠を消費しません。計画生成は未使用の ID で再試行できますが、ID の `.N` カウンターは同日に追加公開する権限を与えません。

stable と preview の公開は、それぞれ `release` 環境と `preview` 環境を使い、独立して直列化されます。日をまたいだ公開時刻を日次上限へどう数えるかを含む信頼設計は、[サプライチェーンセキュリティ](19-supply-chain-security.md) を参照してください。

## テスト

スイートはすべて TypeScript（`t*.test.ts`、`bun` で実行）で、4 レベル — `smoke`、`unit`、`integration`、`e2e` — に分かれ、3 層ピラミッドに対応します（`smoke` + `unit` = L1 プロトコル、`integration` = L2 ステージ、`e2e` = L3 受入）。バージョン固定済みの開発依存関係を入れた後、L1 は外部サービスなしでローカル実行できます。ライブ統合と `e2e` ファイルは `claude` CLI ツール（と Bedrock 資格情報）を必要とし、無い場合はスキップします。

**クイックリファレンス:**

```bash
# L1 Protocol -- runs in seconds, no dependencies
bun tests/run-tests.ts

# L2 Stage -- CI pipeline (requires claude CLI tool)
bun tests/run-tests.ts --ci

# L3 Acceptance -- release gate (requires claude CLI tool)
bun tests/run-tests.ts --release

# POSIX compatibility wrapper
bash tests/run-tests.sh --ci

# Individual levels
bash tests/run-tests.sh --smoke        # File structure validation
bash tests/run-tests.sh --unit         # Hook behavior, stage content
bash tests/run-tests.sh --integration  # Cross-component and stage/CLI tests
bash tests/run-tests.sh --e2e          # Workflow, worktree, and terminal journeys
```

テスト戦略、スタブ、新規テストの追加方法の全体は [テスト](09-testing.md) を参照してください。

## ディスパッチャールートの変更

`core/tools/aidlc.ts` は、公開、非公開、ホスト専用コマンドのルートレジストリです。新しいルートは、意図せず動作を継承しないよう、すべてのポリシーを宣言します。

1. `projectRequirement`、`outputModes`、`visibility`、`networkPolicy`、`mutationScope` を設定する。
2. `pinPolicy` を明示的に選ぶ。マシンのライフサイクル／管理には `active`、稼働中バイナリの診断と修復には `inspect`、プロジェクトのエンジン動作には `pinned` を使う。
3. 既存のツールへルートを割り当てるか、`TOOLS` にツールを追加する。フック、ステータスライン、アダプター、下位の委譲先は、公開エイリアスではなくルート専用エントリーを使う。
4. `tests/unit/t230-dispatcher-routes.test.ts` にルートとポリシーの検証を追加する。必要に応じてグローバルフラグの順序、コンパイル版と開発版の一致も確認する。
5. 本文からコマンドを呼ぶ場合は `{{INVOKE}}` または `{{TOOL_PREFIX}}` を使い、コピー版とネイティブ版を区別する。ローカルの両チャネルを再生成し、パッケージの決定性検査を実行する。

## インストール処理への変更操作の追加

init、ライフサイクル、バージョン固定、プラグイン管理でプロジェクトやマシンを変更する処理は、`core/tools/aidlc-transaction.ts` を使います。ルート相対で重複しない操作から `TransactionPlan` を組み立て、コピー／ツリー操作には宛先の `expected` 状態とソースハッシュを含めます。意味に関わる検査は、トランザクションが成功して戻った後ではなく、`validateCandidates` または `validateCommitted` に置きます。コミット後のバリデーターの失敗もトランザクションに含まれ、ロールバックされます。

公開前に障害注入テストを追加します。必要に応じ、ステージング、スナップショット、コミット、コミット後検証の前後で失敗させ、すべてのバイトとモードが元に戻ること、ロックが解放されること、ロールバックが完了しない場合に復旧用の証拠が名前付きで残ることを確認します。エンジンの参考例は `t243-install-mechanism.test.ts`、プロジェクト変更の例は `t224-plugin-selection.test.ts` と `t242-plugin-state.test.ts` です。

## ユーティリティハンドラの追加

> **監査イベントを追加する前に**、[状態機械](12-state-machine.md) を読んでください。その章は分類体系の全イベント、出力元、「同一コミット規則」を列挙します — コードと章の表を同じ PR で更新しないと、ドリフトテストが失敗します。

ユーティリティハンドラは次の 2 種類です。

### 決定的ハンドラ（推奨）
LLM 推論が不要なハンドラ向け（テキスト表示、ファイルの読み取り／整形、前提条件チェック、ディレクトリ作成）:
1. `core/tools/aidlc-utility.ts` にサブコマンドを追加する
2. 意味に対応するディスパッチャーの名詞／動詞を登録し、`SKILL.md` から `aidlc engine <noun> <verb>`（または公開ルート）で呼び出す
3. タスク追跡は不要 -- スクリプトは 1 秒未満で終わる
4. 監査ログはスクリプト内で `aidlc-audit.ts` の `appendAuditEntry` 経由で処理する（`**Event**:` マークダウンブロックを手書きしない）
5. `aidlc-utility` の usage 文字列に動詞を追加する。生成された SKILL.md の領域を描画するハンドラなら、対応する `--check` ガードも本章に文書化する

`--help`、`--version`、`--status`、`--doctor` ハンドラが参考実装です。`--doctor` は `--export`（任意の `--output <dir>` 付き）も受け付けます。これは診断を改めて実行したうえで、秘匿情報を除去した小さな診断レポートを書き出します。共有の `DoctorFinding` モデルとレポート組み立てロジックは `core/tools/aidlc-doctor-bundle.ts` にあるため、ライブレポートとエクスポートされたレポートは同じ 1 組の検出結果から生成されます。

`codekb-path`、`codekb-snapshot`、`codekb-publish`、`codekb-scope-diff` の各ハンドラは**直接ユーティリティ動詞**です。ステージ本文は `/aidlc <verb>` ではなく `bun <harness-dir>/tools/aidlc-utility.ts <verb>` を呼びます。`codekb-path` はディスパッチャーの `aidlc engine workspace codekb` からも呼び出せます。`codekb-path` と `codekb-scope-diff` は読み取り専用です。`codekb-snapshot` は、ソース／ストアの世代を返す前に、中断された直前の CodeKB ディレクトリ入れ替えを復旧することがあります。`codekb-publish` は共有ストアへ書き込む唯一の動詞で、9 ファイルそろった候補を検証し、スペース + リポジトリ単位の compare-and-swap ロックの下でコミットします。いずれも監査イベントを出さず、`SKILL.md` のタスク追跡も駆動しません。

`project-description` と `document-input` も、同じ読み取り専用の直接ユーティリティの形をとります。これらを消費する両ステージは、まず `project-description` を呼びます。マーカー付きの記録は、その `project-description.json` の文字列を正確にデコードしなければならず、マーカーのない 2.6.115 以前の記録は、明示的に従来の `Project` 状態フィールドへフォールバックします。`bun <harness-dir>/tools/aidlc-utility.ts document-input` を呼ぶのは、選択したパスをネイティブのファイル書き込みツールで、アクティブな記録の固定された `.aidlc-document-input-path` 転送先へ書いた後です。顧客が選んだパスのバイト列がシェルコマンドへ入ることは決してありません。ハンドラはプロジェクトルート下の正確なパスを 1 つ解決し、含まれるファイルの同一性を記録し、読み取り前に、開いたディスクリプタがそれと一致することを要求します。親ディレクトリの差し替え、リダイレクト、非対応の入力は拒否されます。読み取りに成功した場合は、DocumentKB と同じインラインの「信頼できないパス」「信頼できない内容」注意書きを出力します。

### LLM 駆動ハンドラ
エージェント推論が有用なハンドラ向け（ファイルシステム走査、意思決定）:
1. **タスク追跡** -- 論理ステップごとに `TaskCreate` でタスクを作り、作業の進行に合わせて `TaskUpdate`（`in_progress` -> `completed`）で遷移させる。Claude Code のタスクサイドバーを駆動します。
2. **ステータスライン更新** -- アクティブなインテントの `aidlc-state.md` がある場合、実行中ユーティリティを表すよう一時的に `Current Stage` を設定し（例: `running health check`）、完了時に元の値へ戻す。`aidlc-statusline.ts` フックが端末ステータスバー用にこのフィールドを読みます。
3. **監査ログ** -- 意味に対応するネイティブディスパッチャールートを呼ぶ。背後のハンドラーが内部で `appendAuditEntry` を呼び出す。LLM 本文から `**Event**:` マークダウンブロックを手書きしない — [状態機械: 禁止パターン](12-state-machine.md) を参照。

`intent-create` ハンドラは完全に決定的です。3 つの初期化ステージ（`workspace-scaffold`、`workspace-detection`、`state-init`）は単一の `aidlc-utility intent-create` 呼び出し内で実行されます。ウェルカムメッセージはセッション開始時に `settings.json` の `companyAnnouncements` 経由で表示され、ステージではありません。

## スコープの追加

スコープは、ファイル（その識別）とステージごとの所属タグとして著述します。識別は `core/scopes/aidlc-<name>.md` に、所属は `core/aidlc-common/stages/` 配下の各ステージフロントマターの `scopes:` リストにあります。`init`、`scope-change`、`resolve-env-scope`、`doctor`、状態ツール一式の検証ロジックは、実行時に `.claude/scopes/*.md` から `core/tools/aidlc-lib.ts` の `validScopes()` 経由で有効スコープ一覧を導出します。EXECUTE/SKIP グリッドはステージごとの `scopes:` リストの転置で、`tools/data/scope-grid.json` にコンパイルされます。スコープ追加に TypeScript の編集は不要です。

### 手順

1. **`core/scopes/aidlc-hotfix.md` を作成** — スコープの識別。フロントマター:
   - `name`（必須）: スコープ名。ファイル名ステムと一致すること。
   - `depth`（必須）: `Minimal` | `Standard` | `Comprehensive`。
   - `keywords`（任意）: `/aidlc <freeform text>` 自動検出の自然言語トリガー。文字列リストはブロック形式（`- item`）とフロー形式（`[item, item]`）を使える。単語境界で照合し、同点ならスコープ名のアルファベット順で決める。空リストで推論対象から除外する。5 単語を超える説明では、コアの高特異度キーワード許可リストに否定されていない一致が必要。プラグイン固有の語には従来の長さによる判定が適用される。[スコープの自動検出](../guide/05-scopes-and-depth.md#auto-detection-from-freeform-intent) を参照。
   - `description`（任意）: `/aidlc --help` と `SKILL.md` のコンパイル済みスコープ表に出る一行要約。
   - `testStrategy`（任意）: 深さに依存しないテスト戦略の上書き。既定は深さに合わせる。
   - `review_cap`（任意）: `adversarial` | `advisory` | `none`。そのスコープでのステージレビューの上限。省略時はスコープによる引き下げなし。ステージ宣言の強度を下げることはできるが、引き上げることはできない。自律スウォームのレビューは対象外。
   - `runner`（任意）: `true` を設定すると、既定で生成されるランナー集合にそのスコープが含まれる。
   - `freeform_default`（任意）: `true` を設定すると、優先されるコア既定（`classic`）が有効でないときにこのスコープが指名される。主張できるのは有効なスコープのうち最大 1 つで、曖昧なプラグイン選択の組み合わせはグラフコンパイルが拒否する。明示的な `AWS_AIDLC_DEFAULT_SCOPE` の未知の値は引き続き検証エラーになる。
   - `change_control`（任意）: `strict` | `relaxed`。そのスコープで作る新しいインテントの Change Control 既定値。人間の承認／確認後に入力が変わったとき、strict は承認を開き直し、relaxed は変更を一度記録して続行する。省略時は strict。`skeleton` と同様に検証し、エラーにはファイル名と 2 つの有効値を示す。メモリ層の `## Change Control` にある `Mode: strict` は、どのスコープ既定値よりも優先される。

   本文は意図の散文 — 「なぜこれらのステージ、なぜあれをスキップするか」。`validScopes()` は `.claude/scopes/*.md` の存在から導出するため、ファイルが置かれた瞬間にスコープは有効です。編集後に `/aidlc --doctor` を実行して構造問題を検出してください。

   ```yaml
   ---
   name: hotfix
   depth: Minimal
   keywords:
     - hotfix
     - urgent
   description: Urgent production fix
   runner: true
   ---

   # hotfix scope

   Lean path for the urgent production patch — regression test and deploy, nothing else.
   ```

2. **所属ステージにタグ付け** — `hotfix` 下で実行すべき各ステージ（`core/aidlc-common/stages/<phase>/` 配下）のフロントマター `scopes:` リストに `hotfix` を追加する。タグ付けしないステージはそのスコープで `SKIP`。初期化ステージ 3 つ（`workspace-scaffold`、`workspace-detection`、`state-init`）には必ず含める — 常に実行されます。

3. **再コンパイル + スコープ表の再生成** — `aidlc engine graph compile` が `scopes:` タグを `tools/data/scope-grid.json` へ転置する。次に `aidlc engine gen scope-table` が、SKILL.md のコンパイル済みスコープ表用の正規 Markdown 領域を表示する。`<!-- BEGIN: compiled ... -->` / `<!-- END: compiled ... -->` マーカー間の領域は生成されたままに保ち、その後 `aidlc engine graph compile --check` と `aidlc engine gen scope-table --check` を実行して終了コード 0（ドリフトなし）を確認する。

4. **スコープ解決を検証** — `bun core/tools/aidlc-utility.ts intent-create --scope hotfix --project-dir /tmp/scope-smoke` が成功し、`Scope: hotfix` 付きの状態ファイルを生成すること。

5. **`doctor` が環境既定として受け入れることを検証** — `AWS_AIDLC_DEFAULT_SCOPE=hotfix aidlc doctor` がその環境変数を有効と報告すること。

6. **キーワード推論を検証**（`keywords` がある場合） — `aidlc engine scope detect --from-text --input "urgent customer issue" --project-dir /tmp/scope-smoke` が `{"scope":"hotfix","source":"keyword","matches":["urgent"]}` を返すこと。

7. **計画の一致を検証**（任意だが推奨） — `AIDLC_GRAPH_RESOLVE=1 aidlc engine graph resolve hotfix --stdout` がそのスコープの計画を出力するので、EXECUTE 集合がタグ付けと一致するか目視する。

8. **スコープ対応ドキュメントを更新** — `docs/guide/05-scopes-and-depth.md`（スコープ全体リファレンス。ステージ×スコープ・マトリクスを含み、そのセルはコンパイル済み `scope-grid.json` に対して `tests/unit/t244-scope-matrix-doc-sync.test.ts` でドリフトガードされています）、`docs/guide/13-customization.md`（有効値一覧とスコープ表）、`docs/reference/03-orchestrator.md`（スコープからステージへの対応）はいずれもスコープを明示列挙しています。本章末尾のドキュメント方針どおり、同じ PR で更新する。

9. **スコープルーティングのワークフローテストを追加** — 既存スコープと異なる振る舞い（新しいフェーズスキップパターン、新しい深さの組み合わせ）がある場合、`tests/e2e/t53.test.ts`（SDK スコープルーティング）または `tests/e2e/t-tui-t50-bugfix-scope.serial.test.ts`（TUI スコープ通し実行）をモデルにしたルーティング旅程テストを追加する。

### 自動で検証されること

- `.claude/scopes/aidlc-hotfix.md` が置かれた瞬間に `validScopes().has("hotfix")` が `true` を返す — すべての検証箇所がこのヘルパーを使います。
- エラーメッセージはコード変更なしで新しいスコープをアルファベット順に列挙します。
- `/aidlc --doctor` は `AWS_AIDLC_DEFAULT_SCOPE=hotfix` を有効として扱います。
- 進行中ワークフローでの `aidlc-utility scope-change --scope hotfix` は新しいスコープを受け入れます。
- 転置ドリフトガード: ステージの `scopes:` タグを編集して `scope-grid.json` を再コンパイルしないと、`aidlc-graph compile --check` がビルドを失敗させます。`SKILL.md` のコンパイル済みスコープ表にも独自の `--check` ドリフトガード（テスト 67）があります。
- 自由形式 `/aidlc <text>` 呼び出しのキーワード検出は、各スコープの `keywords` を `.claude/scopes/*.md` フロントマターから読みます。独自の自然言語トリガーを持つカスタムスコープは、`keywords` リストを埋めた時点で自動検出されます（`SKILL.md` の変更は不要）。ユーザーは推論を迂回するため `--scope hotfix` を明示指定できます。

### 自動では検証されないこと

- 誤字のあるスコープ名の `scopes:` タグでもコンパイルは通る — 誰も参照しないグリッド列ができるだけで、そのステージは実スコープから黙って落ちます。ガードレールは `/aidlc --doctor` とスコープ単位テストです。
- ステージスキップ意味論（`PHASE_SKIPPED` イベント）。`tests/integration/t39.test.ts` は既知の 9 スコープ名をスコープ単位ループにハードコードしており、そのリストを拡張するまで新スコープは行使されません。同じ PR でそのループに新スコープを追加してください。

## ステージの追加

ステージは YAML フロントマター付き Markdown ファイルとして `core/aidlc-common/stages/<phase>/<slug>.md` に著述します。コンパイラはフロントマターを `tools/data/stage-graph.json` に読み込み、ランナージェネレーターはコンパイル済みステージ一覧から、コアステージ向けに入力可能な `/aidlc-<slug>` スキルを出力します（プラグイン所有のステージは、プラグインプレフィックス付きスラッグをそのまま使います）。拡張契約は「ステージを足すにはステージファイルを書く」です — エンジンはコンパイル済みグラフでルーティングするため、登録のためのエンジン編集は不要です。（フィールド全体リファレンスと 3 区画本文形式はハーネスエンジニアガイドの [ステージの解剖](../harness-engineering/01-anatomy-of-a-stage.md) と [ステージの追加](../harness-engineering/02-adding-a-stage.md) にあり、スキーマは [ステージ定義](15-stage-definition.md) です。）

### 手順

1. **ステージファイルを書く** — `core/aidlc-common/stages/<phase>/<slug>.md` を作成。フロントマターは `slug`、`phase`、`execution`/`condition`、`lead_agent` と任意の `support_agents`（エージェントスラッグ）、`mode`（`inline`、`subagent`、`pipeline`、`mob` のいずれか。`agent-team` は予約済みで未実装）、`consumes` / `produces`（成果物語彙名）、ユニットごとに条件付きでのみ書く成果物用の `optional_produces`（ユニット単位カバレッジから除外）、`requires_stage`（順序エッジ）、`scopes:` 所属リスト、束縛する任意の `sensors:`、ユニットごとに反復するなら `for_each`、（ユニット単位ステージでは）各ユニットの種別へ `produces` 成果物を絞り込む任意の `produces_kinds` マップを宣言します。本文はステージの 3 区画を持ちます。フィールド契約の全体は [ステージ定義](15-stage-definition.md) を参照。

2. **グラフを再コンパイル** — `aidlc engine graph compile` が新しいフロントマターを `tools/data/stage-graph.json` に読み、`scopes:` タグを `tools/data/scope-grid.json` へ転置します。`aidlc engine graph compile --check` で終了コード 0（ドリフトなし）を確認。その後、`aidlc engine gen stage-table` と `aidlc engine gen scope-table` で生成された SKILL.md のミラーを更新し、`aidlc engine gen stage-table --check` と `scope-table --check` の両方が終了コード 0 で終わることを確認する。ステージは直後に `aidlc engine orchestrate next --stage <slug> --single` で実行可能です。

3. **ランナーを再生成** — `aidlc engine gen runners` が実行可能なコンパイル済みステージごとに `/aidlc-<slug>` ランナースキルを出すので、新ステージは手著述なしで入力可能コマンドを得ます。`aidlc engine gen runners --check` でディスク上のランナー集合がコンパイル済みステージ集合と一致することを確認（ドリフトガード。ブートストラップ初期化ステージは設計上除外）。

4. **ステージのルーティングを検証** — そのステージを含むスコープのワークフローで `aidlc engine orchestrate next` を駆動し、エンジンが解決済み `lead_agent`、ゲート、`consumes`、`produces` 付きでスラッグを名指しする `run-stage` ディレクティブを出すことを確認。

5. **スコープ対応・ステージ対応ドキュメントを更新** — 新ステージはステージ数とスコープごとの計画を変えます。`docs/guide/05-scopes-and-depth.md`（ステージ×スコープ・マトリクス。セルは `tests/unit/t244-scope-matrix-doc-sync.test.ts` でドリフトガードされています）、`docs/reference/16-artifact-vocabulary.md`（初期化以外のステージ数）、ハーネスエンジニアガイドのステージ章、計画を列挙するスコープリファレンスを更新。本章末尾のドキュメント方針どおり、同じ PR で行う。

6. **テストを追加しカバレッジを更新** — ステージの振る舞いに対する `t*.test.ts` を著述する（スイートは発見ベースなので、適切なレベルディレクトリにファイルを置くだけでよく、レジストリ行の追加は不要）。次に `bun tests/gen-coverage-registry.ts` でカバレッジ索引を再生成し、`bun tests/gen-coverage-registry.ts --check` がクリーンであることを確認。ステージランナードリフトガード `tests/unit/t129-stage-runner-drift.test.ts` は生成ランナー集合がコンパイル済みステージ集合と等しいことを検証し、`tests/integration/t55-test-suite-drift.test.ts` は古いパスとマーカーを掃引します。

### 自動で検証されること

- **グラフ配置。** `compile` するとステージのエッジ（`requires_stage`、`consumes`、`produces`）が解決・順序付けされ、ディスク上の `stage-graph.json` がフロントマターからずれると `compile --check` がビルドを失敗させます。
- **生成されたステージ表。** SKILL.md のステージグラフ表はコンパイル済み `stage-graph.json` から描画され、生成領域がずれると `aidlc-utility stage-table --check` が失敗します（t32）。
- **スキーマ + 参照。** `aidlc-graph.ts compile` は `aidlc-stage-schema.ts` 経由で各ステージのフロントマターを検証し、`/aidlc --doctor` は `validateStageFrontmatter` に加え、すべての `lead_agent` / `support_agents` / `consumes` スラッグが解決する「グラフ参照」検査を再実行します。
- **ランナー一致。** `aidlc-runner-gen.ts check`（と `t129`）は、コンパイル済みステージにランナーが無い、または消えたステージにランナーが残っている場合に失敗します。

### 自動では検証されないこと

- **コンパイラが認識しない新しいフロントマターキー。** スキーマ未実装のキーが欲しければフレームワーク変更です。データを読むコードを編集するため、このレシピではなくエンジン／コンパイルパイプライン経路に従います。[ステージ定義](15-stage-definition.md) の予約キー名前空間は、将来の構造拡張が予測どおり着地するためのものです。
- **ドキュメント上の列挙。** `docs/` 全体のステージ数やスコープごとの計画表は手メンテです。同じ PR で更新してください（下記ドキュメント方針を参照）。

## エージェントの追加

エージェントメタデータ（表示名、ナレッジファイル例）は `core/agents/` 配下の各エージェント `.md` フロントマターから読みます。`core/tools/aidlc-lib.ts` の `loadAgents()` ヘルパーがそのディレクトリのすべての `.md` を発見し、ステータスラインフックが消費するメタデータマップ（表示名の描画）を導出します。エージェント追加に TypeScript の編集は不要です。

### 手順

1. **エージェントファイルを作成** — 必須フロントマター付きで新しい `core/agents/<slug>-agent.md` を置く:

   ```yaml
   ---
   name: <slug>-agent
   display_name: <Human-Readable Name>
   examples:
     - example-knowledge-file-one.md
     - example-knowledge-file-two.md
   description: >
     One-paragraph description of the agent's responsibilities and which stages it leads or supports.
   disallowedTools: Task
   tier: judgment
   ---
   ```

   `name` フィールドはファイル名ステムと完全一致すること。`display_name` はステータスラインが使う人向けラベル。`examples` はエージェント→例表に文書化された推奨ナレッジファイル名の一覧 — ユーザーへの提案であり、実行時に読み込まれずディスクにも書きません。`tier`（`judgment` | `balanced` | `templated`）はパッケージャが各ハーネスのモデル／工数キーへ投影する著述ダイヤルです — コアフロンタマターに生の `model:`/`effort:` を書かないこと（[エージェントシステム](05-agent-system.md) を参照）。

2. **エージェントが発見されることを検証** — `bun -e "import { loadAgents } from 'core/tools/aidlc-lib.ts'; console.log(loadAgents().find(a => a.slug === '<slug>-agent'));"` が新しいエージェントのメタデータを表示すること。

3. **インテント生成がスペースナレッジディレクトリを作ることを検証** — `bun core/tools/aidlc-utility.ts intent-create --scope poc --project-dir /tmp/agent-smoke` が空のスペースレベル `aidlc/knowledge/` ディレクトリ（スペースの `intents/` と同階層）を作成すること。生成はエージェント別サブディレクトリや README をシードしません — チームは内容があるときに自分で `aidlc/knowledge/<slug>-agent/` を作ります。

4. **ステータスライン描画を検証** — `Active Agent: <slug>-agent` 付きの状態ファイルを用意してステータスラインフックを呼び出すと、出力の `--` 区切り後に表示名が含まれること。

5. **エージェントをステージへ配線** — ステージを主導または支援すべき新エージェントは、`core/aidlc-common/stages/<phase>/` 配下のステージ `.md` フロントマターの `lead_agent` / `support_agents` フィールドに名前を書く。次に `aidlc engine graph compile`（ドリフトガードとして `compile --check`）を実行し、そのフロントマターから `tools/data/stage-graph.json` を再生成する。`stage-graph.json` を手編集しない — コンパイル成果物であり、次の `compile` が手修正を上書きします。これは発見とは別です — `loadAgents()` がエージェントを可視化し、ステージフロントマター（グラフへコンパイル）がそれをアクティブにします。

### 自動で検証されること

- `loadAgents()` は次の呼び出しで `.claude/agents/` 内の新しい `.md` を発見する — コード編集は不要。
- パーサーは `name` または `display_name` が欠けると、ファイル名と欠落フィールドを示して例外を投げる。
- エージェントはスラッグのアルファベット順で返るため、どのプラットフォームでも `readdirSync` 順は同じ出力になる。
- インテント生成は空のスペースレベル `aidlc/knowledge/` ディレクトリを作る（エージェント別サブディレクトリや README はシードしない）。
- ステータスライン描画は同じメタデータ源から表示名を導出する。
- `tests/unit/t61.test.ts` はフィクスチャエージェントに対し 5 つの性質すべてをエンドツーエンドで検証する。

### 自動では検証されないこと

- **ステージグラフへの参加**。ステージフロントマターは `lead_agent` / `support_agents` でエージェントをスラッグ参照し、`aidlc-graph.ts compile` がそれを `stage-graph.json` へ運びます。どのステージフロントマターにも名前を書かずにエージェントを追加すると、存在しても実行されません。ステージグラフスキーマ検証（`core/tools/aidlc-stage-schema.ts`）は配線済みです。`aidlc-graph.ts compile` が各ステージのフロントマターを検証し（`compile --check` が CI ドリフトガード）、`/aidlc --doctor` は同じ `validateStageFrontmatter` に加え、すべての `lead_agent` / `support_agents` スラッグが解決する「グラフ参照」検査を再実行します。
- **ナレッジファイルの存在**。`examples` はエージェント→例表に文書化された推奨ファイル名の一覧であり、作成も検証もしません。実体はユーザーがスペースレベルナレッジディレクトリ `aidlc/knowledge/<agent>/` に置きます。
- **エージェントを列挙するドキュメント表**。`docs/reference/05-agent-system.md:119-131` のフェーズ参加マトリクスと、`core/knowledge/aidlc-shared/knowledge-readme-template.md:16-29` のエージェント→例表は手メンテです。エージェント追加と同じ PR で更新してください（下記ドキュメント方針を参照）。
- **`.claude/agents/<new-agent>.md` 本文**。パースされるのはフロントマターだけです。本文（主要責務、コラボレーション、任意のメモリフォーカス、主要原則）は有効化時にエージェント自身が読む — 既存のエージェントファイルと同じ構造で書いてください。

## ドキュメント方針

ファイル、ディレクトリ、コマンド、フラグを追加・削除・改名するときは:

1. `docs/` と `README.md` を `grep` して古い参照を探す
2. 同じコミットですべての参照を更新する

## 承認の根拠に関する方針

Plan Approval、レビュー、ゲート、Unit ライフサイクルの受領記録は、内容とステージの試行に結び付きます。質問を出したディレクティブの ID や、イベントの並び順には結び付きません。この 2 原則は [`12-state-machine.md`](12-state-machine.md#承認証跡の不変条件) に定義されています。提出前に次を確認してください。

1. フィンガープリント、epoch、受領記録の識別情報に入力を追加する変更か。その入力が検出する、人間に見える変更を明示する。人間の操作と無関係に変わるもの（`next` の再実行、プローブ、ステータス照会、マーカーの書き直し、メタデータ更新）は識別情報へ含めず、来歴として記録する。
2. クエリ経路に書き込みを追加する変更か。`next`、停止フックのプローブ、経路確認、`--status`、`--doctor`、`team-board` は、承認の根拠となる状態を書き換えない。エンジンの観測処理では、永続書き込みの基本操作にも型付きの防壁があり、意図しない書き込みはエラーになる。
3. ガードに証拠を削除させる変更か。ガードができるのは拒否だけであり、拒否するために受領記録、チャレンジ、マーカーを消してはならない。記録済みの判断を取り下げられるのは、人間の明示的な判断だけである。
4. `aidlc-state.md` にフィールドを追加する変更か。新しいフィールドは既定でアクティブなディレクティブの識別に含まれる。状態ダイジェストから除外する場合は、そのフィールドをキャッシュに分類する明示的な判断であり、項目 1 と同じ説明が必要になる。

## 変更の提出

1. 何が変わりなぜかを明確に書いた PR を `main` 向けに開く
2. L1 テストが通ることを確認: `bash tests/run-tests.sh`
3. フック変更の場合: `bash tests/run-tests.sh --unit` を実行
4. 統合テストの場合: `bash tests/run-tests.sh --integration` を実行（`claude` CLI ツールが必要）
5. 変更がファイル、コマンド、フラグに影響するならドキュメントを更新する（上記ドキュメント方針を参照）
6. フィンガープリント、epoch、受領記録の識別情報に入力を追加する場合は、その入力が検出する、人間に見える変更を明示する（上記の方針を参照）
