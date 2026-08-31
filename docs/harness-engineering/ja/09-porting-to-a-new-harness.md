# AI-DLC を新しいハーネスへ移植する

AI-DLC は **1 つのコア、多数のハーネス**から出荷されます — 現時点では Claude Code、Kiro CLI、Kiro IDE、Codex CLI、Cursor、opencode、GitHub Copilot であり、この集合は開かれています。手作業で書かれるソースは、ハーネス非依存の `core/` と、CLI ごとの薄い `harness/<name>/` 面です。パッケージャー（`scripts/package.ts`）が、コミットされた各 `dist/<harness>/` ツリーを再生成します。別のハーネスを追加するのは、**1 つのディレクトリとマニフェストの 1 行**です — エンジン、手法、ハーネスディレクトリ／ルールの解決に `core/` の編集はまったく要りません。唯一の任意の例外は、ハーネスごとの `--doctor` の分岐です（手順 2 を参照）。このページはその契約を辿ります。

> このリポジトリにおける「ハーネス」の 3 つの意味: **`harness/`**（トップレベル — このページが扱う CLI ごとの配布面）、**`docs/harness-engineering/`**（本ガイド）、**`tests/harness/`**（テストスイートのヘルパーライブラリ）。互いに無関係で、配布物なのは最初のものだけです。

## 全体像

```
core/                      # ハーネス非依存のソース — ハーネス追加では編集しない（任意の --doctor 分岐を除く）
harness/
  claude/  manifest.ts · skills/aidlc/ · CLAUDE.md · settings.json
  kiro/    manifest.ts · skills/aidlc/ · agents/*.json · hooks/aidlc-kiro-adapter.ts · settings/cli.json · AGENTS.md
  codex/   manifest.ts · emit.ts · skills/aidlc/ · hooks/aidlc-codex-adapter.ts
  opencode/ manifest.ts · emit.ts · skills/aidlc/ · command/ · plugin/
  copilot/ manifest.ts · emit.ts · skills/aidlc/ · hooks/aidlc-copilot-adapter.ts
scripts/
  package.ts               # bun scripts/package.ts [<name>] [--check]
  manifest-types.ts        # すべてのマニフェストが実装する HarnessManifest 契約
dist/<name>/               # 生成物。コミットされ、乖離ガード付き
```

`core/` の散文は `{{HARNESS_DIR}}` トークンでハーネスディレクトリを名指しし、パッケージャーがマニフェストの宣言する `harnessDir`（`.claude` / `.kiro` / `.codex` / あなたの `.foo`）に置換します。`.ts` は変換せずバイトコピーされます — `core/tools/aidlc-lib.ts` の実行時 `harnessDir()` の継ぎ目が、実行時に出荷レイアウトからディレクトリを導出するため（開かれた集合: ハードコードされた一覧ではなく、ツール自身のパスからディレクトリ名を読みます）、同じツールのソースがすべてのツリーで動きます。受け入れのゲートは**バイト一致**です。ハーネスを再生成すると、コミット済みの dist を厳密に再現しなければなりません（`package.ts --check`）。

パッケージャーは、`harness/` を走査して `manifest.ts` を探すことでハーネスを**発見**します。したがって新しいディレクトリは、パッケージャー自身を編集しなくても、既定の `bun scripts/package.ts` と `--check` でビルドされます — 「1 つのディレクトリとマニフェストの 1 行、共有コードの編集ゼロ」の文字どおりの意味です。

## 手順 1 — マニフェスト（宣言的な 80%）

`HarnessManifest`（`scripts/manifest-types.ts`）をエクスポートする `harness/<name>/manifest.ts` を作ります。フィールドは次のとおりです。

- `name` / `harnessDir` — トークンが置換される先のディレクトリ（例: `.foo`）。
- `coreDirs: DirMap[]` — どの `core/<src>` ディレクトリを `<harnessDir>/<dst>` へ投影するか。ここでディレクトリの改名や除外を行います（Kiro は `rules → steering`、Codex は `rules → aidlc-rules` で `skills/` を除外 — emit を参照）。3 つのセッションスキルは、ツリー内ハーネス（claude、kiro、kiro-ide）ではコアのディレクトリです。codex は代わりにそれらを emit します。
- `harnessFiles: FileMap[]` — `harness/<name>/<src>` から dist へそのままコピーされる、作成された面（`.md` はトークン置換を受けます）。`projectRoot: true` はファイルをハーネスディレクトリの隣に置きます（例: `AGENTS.md`）。
- `orchestratorSkillPath`（任意） — 組み立てられたオーケストレーター `SKILL.md` への、プロジェクトルート相対のパス。既定は `<harnessDir>/skills/aidlc/SKILL.md` です。`.agents/skills/aidlc/SKILL.md` のように、そのツリーの外にある emit 所有のレイアウトでは宣言してください。
- `frontmatterAdditions`（任意） — 投影の際に、コアから投影される `.md` のフロントマターへ追記される、ファイルごとの YAML 行。他のハーネスへ出荷してはならない、ハーネス**ネイティブ**のフィールドのためのものです（kiro-ide は委譲先のエージェントファイルへ `tools: ["read", "write", "shell"]` を注入します — IDE はサブエージェントのツール許可を `.md` フロントマターから読みます）。コアを単一ソースに保つためマニフェストのデータとして宣言され、パッケージャーは、打ち間違えたパス、フロントマターブロックの欠落、コアが既に宣言しているキーに対してエラーを出します。
- `rulesRename` — 改名されたルールディレクトリ（`"steering"` | `"aidlc-rules"` | `null`）。パッケージャーはこれを、コピーされたディレクトリにも、散文中の `<harnessDir>/rules/` への言及にも、コンパイル済みステージグラフのルールパスにも適用し（コンパイル時に `AIDLC_RULES_DIR` を設定して `loadRules` が改名後のディレクトリを見つけられるようにします）、さらにマニフェスト名とルールディレクトリの両方を記録した `tools/data/harness.json` を生成して出力します。実行時のパス解決は、エンジンディレクトリを共有するハーネスを区別するために名前を使い、`rulesSubdir()` が改名を読みます — つまり実際のインストールは、ハードコードなしに両方の事実を解決します。これが `rulesRename` を純粋なマニフェストデータにしている継ぎ目です。ここで設定すれば、すべての層（ビルド時の散文、コンパイル済みパス、ランタイム）が `core/` の編集なしに追随します。
- `skipRunnerGen` — ハーネスが `<harnessDir>/skills/` を出荷しない場合に設定します（Codex は `emit` 経由でスキルツリーを `.agents/skills/` へ出力します）。その場合、パッケージャーは標準の runner-gen の手順を飛ばします。
- `emit` — 任意のプラグイン（手順 3）。不要なハーネスでは `null` です。

Claude のマニフェストが最小のリファレンスです（改名なし、emit なし）。Kiro のものは改名と `harnessFiles`（エージェントの JSON、アダプター、プロジェクトルートの AGENTS.md）を加えています。

## 手順 2 — フックアダプター（ハーネスごとのシム）

コアのフックは、Claude 形の stdin を標準形として消費します。新しいハーネスは、**作成されたアダプター 1 つ**（`harness/<name>/hooks/aidlc-<name>-adapter.ts`。`harnessFiles` に列挙）を出荷し、そのハーネスのフックペイロードをその契約へ正規化して、共有されたコアフックへサブプロセスでパイプします。コアフックをロジックとアダプターに分割してはいけません — コアの本体はすべてのハーネス間でバイト共有のままです（`--check` がそれを証明します。dist 内のすべての `.ts` は、その `core/` のソースとバイト単位で同一です）。

アダプターをハーネスのイベントへ配線する方法は、そのハーネスのやり方に従います。Kiro は `agents/aidlc.json` にターゲットを登録し、Codex は `hooks.json` を出力します。登録するのは、実際にコアフックの消費者があるイベントだけにしてください。

6 つのフックはフロー変更型であり、単にパイプするだけでなく、その制御チャネルを転送する必要があります。Stop フックは標準出力で `{"decision":"block"}` を返します。dispatch-rules は委譲されるプロンプトを書き換えます。そして PreToolUse の reviewer-scope、review-freeze、plan-approval、state-transition の各ガードは、終了コード 2 と標準エラー出力の理由で応答します（アダプターがその終了コードを中継したら、ツール呼び出しは拒否されなければなりません）。新しいハーネスが pre-tool の継ぎ目からツール呼び出しをハードブロックできない場合は、reviewer-scope と review-freeze の登録を外し、死んだフックを配線するのではなくその欠落を文書化してください — そこでも stage-protocol-reviewer.md §12a の散文上の制約は引き続き支配します。ハーネスのペイロードがサブエージェントの同一性を運ばない場合、ハーネスがエージェントごとのフックに対応しているなら、reviewer-scope の登録をレビュアーエージェント自身へスコープしてください（Kiro CLI のパターン。この場合アダプターは `agent_type` の一致ではなく `scoped_registration` をアサートします）。

> **唯一認められた `core/` の編集: doctor の分岐。** `/aidlc --doctor`（`core/tools/aidlc-utility.ts`）はインストール済みツリーの健全性を検査し、新しいハーネスは、自分のインストール面（アダプターと配線ファイルの存在、必要ならバイナリのバージョン下限）のための、ハーネスごとの分岐をそこに追加します。これは意図的にハーネスごとの*ロジック*であってデータではありません — バージョン検査は CLI を起動して semver を比較するもので、マニフェストの 1 行では表現できません（3 つの関心事の規則: 知識はコードに住む）— したがって「`core/` の編集ゼロ」の祝福された例外であり、違反ではありません（意図的な設計上のトレードオフです）。これは優雅に劣化します。分岐を持たないハーネスは、失敗するのではなく単に汎用の検査を受けます。それ以外 — ディレクトリの解決、ルールディレクトリの改名、パッケージング — は純粋なマニフェストデータのままです。

## 手順 3 — `emit.ts`（命令的な 20%。必要な場合のみ）

宣言的な 1 行では表現できない構造上の食い違いは `emit.ts` が担います — マニフェストが参照するプラグインで、パッケージャーが `EmitContext`（`coreRoot`、`harnessRoot`、`distRoot`、`harnessDir`、`substituteToken`、`tierCap`）を渡して呼び出します。エミッターは出力を `distRoot` の下に書きます。Codex のものが実例です: `config.toml`、`hooks.json`、フック信頼の事前シード、`AGENTS.md` のマージ、エージェント TOML への転置、そして `.agents/skills/` ツリー（`AIDLC_HARNESS_DIR` の下で `core/tools/aidlc-runner-gen.ts` がエクスポートするレンダー関数から組み立てられ、決して再実装されません）。面がすべて作成済みファイルであるハーネス（Claude、Kiro）は `emit: null` を設定します。

`--check` のもとでは、パッケージャーが一時的な `distRoot` を与えて同じエミッターを走らせ、生成されたルート全体をコミット済みの配布物と比較します。したがって `<harnessDir>` の外にある emit 所有のファイル（たとえば `.agents/skills/` やルートの `AGENTS.md`）も、宣言的な出力と同じく、欠落・相違・孤立の各検査に参加します。

## 手順 4 — 唯一許される変換の種類

許される唯一のテキスト変換は、スラッシュで区切られたハーネスディレクトリの一族です。`.md` の散文における `{{HARNESS_DIR}}` → ハーネスディレクトリ、そしてルールディレクトリの改名です。当てずっぽうの `sed` は禁止です。`core/` にある真正なハーネス固有のリテラル（`$CLAUDE_PROJECT_DIR` の注記、workspace-detection におけるハーネスディレクトリの列挙）はトークンを持たず、そのまま通過します — コア衛生テスト（`t146-core-hygiene`）が、新しい生のパスリテラルの紛れ込みを防ぎます。

## 手順 5 — テストとゲート

- パッケージング一致テスト（`t145`）が `package.ts --check` を実行します。マニフェストを持つすべてのハーネスを自動的にカバーします。
- `<name>` のフックアダプター契約テストが、実機で捕捉したペイロードをアダプターへ流し、観測可能なコアフックの効果をアサートします。
- 実機のジャーニーは、`skipReason()`（`AIDLC_<NAME>_*_LIVE=1` の環境変数 + バイナリの存在 + 認証済み）でゲートされた e2e として出荷され、決定論的なティアではきれいにスキップされ、移植がマージされる前にローカルで green になります。

再生成には `bun scripts/package.ts <name>`、乖離ガードには `--check`、そしてゲートには決定論的スイート（`bash tests/run-tests.sh --smoke --unit --integration -P 8`）と実機ジャーニーを実行します。

## 次に読む

これで弧が閉じます。あなたはデータの面を形づくり（01〜08 章）、いまコアを新しい CLI の上へレンダリングしました。ここからは:

- 全体の地図は [ハーネスエンジニアガイドの概観](00-overview.md) へ戻ってください。
- 新しいハーネスには、他と並ぶ**ユーザー向けの章**が付きます — 既存のものがどう書かれているかは、ユーザーガイドの [他のハーネスでの実行](../guide/harnesses/README.md) の一族を見てください。
- 規範となるビルド契約（マニフェストの型、`emit` プラグイン API、`harnessDir()` の継ぎ目）は、開発者リファレンスの [アーキテクチャ § ソースと配布物](../reference/01-architecture.md#source-vs-distribution-one-core-many-harnesses) にあります。
