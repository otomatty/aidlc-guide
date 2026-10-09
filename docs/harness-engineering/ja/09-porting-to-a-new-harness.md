# 新しいハーネスへの AI-DLC の移植

AI-DLC は1つのコアから、Claude Code、Kiro CLI、Kiro IDE、Codex CLI、Cursor、opencode、GitHub Copilot 向けの配布物を生成します。ハーネスは追加できます。ソースはハーネスに依存しない `core/` と、CLI ごとの `harness/<name>/` です。パッケージャー `scripts/package.ts` は、Bun コピー形式を `dist/<harness>/`、ネイティブ形式を `dist-release/<harness>/` に生成します。どちらも Git の管理対象外です。新しいハーネスの追加に必要なのは、ディレクトリ1つとマニフェストの登録です。エンジン、手法、配布物の所有権、ハーネスやルールのディレクトリ解決のために `core/` を変更する必要はありません。任意のハーネス別 `--doctor` 検査だけが例外です。手順2で説明します。

> このリポジトリの「harness」には3つの意味があります。`harness/` は CLI ごとの配布定義、`docs/harness-engineering/` は本ガイド、`tests/harness/` はテストのヘルパーライブラリです。配布定義を表すのは最初のものだけです。

## 構成

```
core/                      # ハーネス非依存のソース。任意の doctor 検査を除き、ハーネス追加時には編集しない
harness/
  claude/  manifest.ts · skills/aidlc/ · onboarding.fills.ts · settings.json
  kiro/    manifest.ts · skills/aidlc/ · agents/*.json · hooks/aidlc-kiro-adapter.ts · settings/cli.json · onboarding.fills.ts
  codex/   manifest.ts · emit.ts · skills/aidlc/ · hooks/aidlc-codex-adapter.ts
  opencode/ manifest.ts · emit.ts · skills/aidlc/ · command/ · plugin/
  copilot/ manifest.ts · emit.ts · skills/aidlc/ · hooks/aidlc-copilot-adapter.ts
scripts/
  package.ts               # bun scripts/package.ts [<name>] [--check]
  manifest-types.ts        # 各マニフェストが実装する HarnessManifest
dist/<name>/               # 生成物。Bun 呼び出し形式
dist-release/<name>/       # 生成物。ネイティブ aidlc 呼び出し形式
```

`core/` の文章では、ハーネスのディレクトリを `{{HARNESS_DIR}}`、フレームワークの呼び出しを `{{INVOKE}}`、生成時のコマンド接頭辞を `{{TOOL_PREFIX}}` で表します。パッケージャーは宣言されたディレクトリと、次の呼び出し形式を代入します。

| 配布形式 | `{{INVOKE}}` | `{{TOOL_PREFIX}}` |
| --- | --- | --- |
| `dist/` | `bun <harness-dir>/tools/aidlc.ts` | `bun <harness-dir>/tools/` |
| `dist-release/` | `aidlc` | `aidlc ` |

変換対象は Markdown、構造化されたコマンド設定の `.json`・`.toml`・`.hook`、TypeScript 内の呼び出しトークンです。ソース全般を書き換える機能ではありません。
`core/tools/aidlc-lib.ts` の `harnessDir()` は、配布後のツール自身の配置からディレクトリを求めます。ハーネス名の固定一覧に依存しないため、同じツールソースがどの配布物でも動きます。
検証では生成結果の再現性を確認します。`package.ts --check` は両配布形式と全プラグイン配布物を別々の一時ディレクトリで2回生成し、全出力をバイト単位で比較します。ローカルの `dist/` や `dist-release/` は読みません。

パッケージャーは `harness/` 内の `manifest.ts` を走査してハーネスを検出します。新しいディレクトリは、パッケージャーを変更しなくても `bun scripts/package.ts` と `--check` の対象になります。

## 手順1: マニフェストで宣言する

`harness/<name>/manifest.ts` を作成し、`scripts/manifest-types.ts` の `HarnessManifest` をエクスポートします。

- `name` / `harnessDir`: 名前と、トークンの置換先ディレクトリ。例は `.foo`。
- `productName` / `configNextStep`: ライフサイクル処理と `aidlc config` が使う利用者向けの情報。ホストのコマンドは正確に記述します。
- `firstRunSteps` / `editorTerminalApp` / `hookActivation`: 任意。初回実行に他のハーネスにない手順が要るホストのためだけのものです。`firstRunSteps` は、`aidlc config` で終わる次の手順の 2 行を置き換えます。`editorTerminalApp` はエディターの内蔵ターミナルが設定する `TERM_PROGRAM` の値で、そこで `aidlc config` を実行すると、このハーネスがウィザードの既定の選択肢になります。`hookActivation` は、本人が操作するまでフックを 1 つも実行しない可能性のあるホスト向けです。その中のどの文も、本人自身の手順だけをホスト自身の言葉で示し、フック、エンジン、理由には決して触れません。`<entry>`、`<folder>`、`<next>` はインストールに合わせて埋められます（`<next>` はエンジンの `next` コマンドです。`next` の停止時には、止まったコマンドをもう一度実行するよう伝える固定の文言になるので、その依頼は保たれます）。`recovery` は doctor の修正案です。`agentStep` を設定するのは、エージェント自身のシェルコマンドに対するフックが、それ自身の検査をオフにしていても、エンジンが動く前に記録へハートビートを残す場合だけにしてください。これはエージェント自身が何をするかを述べ、そのあと本人に示す正確な行を引用します。ステージがハートビートのないまま始まると、`next` は作業の前にそれを `print` として示して止まります。同じ状態では、有人実行の「新しい人間の返答がない」という拒否も、「もう一度答えるよう頼まないでください」という言葉とともにそれを伝えます。それ以外の場合、または `agentStep` のないハーネスでは、その拒否は代わりに `missedReply` を示します（`AIDLC_UNATTENDED=1` の実行には専用の説明があります）。これは、まだ返答していないかもしれない人に向けた言い回しです（「すでに返答した場合は…」）。`missedReplyInHost`（`{ env, text }`）は、名指しした環境変数のいずれかがエージェントのシェルに設定されているとき、1 つのホストに専用の行を与えます。Kiro IDE はこれを `VSCODE_IPC_HOOK` / `VSCODE_PID` に使います。`notRunYet` を設定するのは、ハーネスのフックが、ワークフロー開始前の最初のものも含めて、すべてのチャットメッセージでハートビートを残す場合だけにしてください（human-turn フックはそうしますし、Copilot と Kiro IDE のアダプターもそうです）。すると doctor は、ハートビートがない間はその文で警告し、`agentStep` があれば、本人のメッセージがハートビートを残さなかったときに、最初の `next` が作業の前にエージェントの手順を示して止まります。`notRunInWorkflow` は `agentStep` と一緒の場合だけ設定します。本人がプレゼンス検査をオフにして `next` が止まらないとき、エンジンはその一文を代わりにすべてのディレクティブの `change_notices` に加えます。Claude Code、Codex CLI、Kiro CLI、opencode は `recovery`、`agentStep`、`notRunYet` を宣言します（Kiro CLI はさらに、エージェントピッカーを名指しする `missedReply` も）。Copilot はさらに `notRunInWorkflow` を宣言します。Kiro IDE は `recovery`、`missedReply`、`notRunYet` を宣言し、エージェントの手順はオーケストレーターのスキルに置きます。Kiro がコマンドの実行を許されていないフォルダでは、AI-DLC のコマンドは 1 つも実行できないためです。
- `directiveMaxBytes`: 任意。エンジンのディレクティブ上限 28 KiB より短いシェル結果しか保持しないホスト向けです。エンジンはすべてのディレクティブをこの値以下に保ちます。ステージのルールは収まる間だけインラインで載せ、読み込みを指示する部分は収まるように削ります。末尾の改行の余裕を見て、ホストの切り詰めより小さく設定してください（UTF-8 のバイト数が文字数を下回ることはありません）。宣言しているのは Copilot だけです（VS Code のターミナル結果の 20,000 文字に対して 19,000 バイト）。ネイティブのエンジンは、出荷するランタイムから、古いリリースで設定したプロジェクトにもこれを適用し、プロジェクト自身の値がこれを超えることを決して許しません。複数のハーネスを入れたプロジェクトでは、宣言された最小の上限が採用されます。ある手順が収まらないとき、エラーはプロジェクトが編集できる `productName` からではなく、ハーネス名をキーとする固定の一覧（`core/tools/aidlc-runtime-paths.ts` の `HOST_LABELS`）からホストを名指しします。あなたのハーネスをそこに追加してください。追加しないと「this assistant」と表示されます。
- `rootIntegrations`: 通常の配布物が出力するプロジェクトルートの各ファイルと、初期化時のマージ方針。`managed-block`、`json-map`、`json-array`、`whole-file`、`jsonc-settings`、`json-entries` のいずれかを指定します。`json-entries` はチーム自身の JSON 設定ファイル（opencode の `opencode.json`）向けです。config は AI-DLC の値と配列の文字列を、どの深さでも存在しない場所にだけ追加し、マップの `"*"` ルールはマップにそれが無いときだけ追加し、それ以外はすべて保ちます。追従したり取り除いたりするのは、自分が書いた値をまだ保持している項目だけです。その部分は root-blocks に含めて出荷し、コピー形式のランタイムはこのファイルを除外します。`jsonc-settings` はエディター自身の JSONC 設定ファイル（Copilot の `.vscode/settings.json`）向けです。config は出荷する各トップレベルキーを、プロジェクトがそれを設定していないときだけ追加し、他の誰かが設定した値は決して変えず、他のすべてのキー、コメント、行を保ちます。追加したキーを記録するので、チームがあとで削除したキーが再び追加されることはなく、取り除くのは値が自分の追加したもののままのキーだけです。コピー形式のランタイムはこのようなファイルを除外するので、コピーがチーム自身のファイルを置き換えることはありません。マーカーや JSON の識別キー、省略可否、旧ファイルを引き継ぐための正確なハッシュもここで宣言します。管理対象ディレクトリにも、この宣言にも属さないトップレベルの出力は拒否されます。`shared: "union"` は、インストールされたハーネス間で管理ブロックの行集合を統合します。`shared: "identical"` は、宣言したどのハーネスが所有してもよいバイト一致の内容を宣言するので、それを出荷する 2 つのハーネスが共存できます。`shared` が無ければ、そのブロックは排他です。
- `nativeRootIntegrations`: 任意。信頼設定の初期ファイルなど、リリース形式だけに含めるルートファイル。同じマージ契約に加えてソースの `src` を指定します。
- `tierFlavor`: Claude、Codex、Kiro、OpenCode 向けのモデル・推論量の生成形式を選びます。`name` から推測せず、マニフェストに記述します。
- `kiroLayout`: Kiro の行だけ。`agent-v1`（フックを持つ JSON エージェント）か `kas`（Markdown エージェントと独立した `.kiro/hooks/*.json`。Kiro IDE 1.x と Kiro CLI v3 が実行します）。`harness.json` に書かれ、レイアウトに依存する実行時コードは、`name` からではなくインストール済みツリーからそれを読みます。
- `coreDirs: DirMap[]`: `core/<src>` のどのディレクトリを `<harnessDir>/<dst>` へ配置するかを指定します。改名や除外もここで行います。Kiro は `rules → steering`、Codex は `rules → aidlc-rules` とし、`skills/` を除外して emitter で生成します。3つのセッションスキルは claude・kiro・kiro-ide ではコアディレクトリとして配置し、codex では emitter が生成します。
- `harnessFiles: FileMap[]`: `harness/<name>/<src>` から各配布形式へコピーするファイル。対応するテキスト形式にはトークンを代入します。`projectRoot: true` なら `AGENTS.md` のようにハーネスディレクトリと並べて配置します。
- `orchestratorSkillPath`: 任意。組み立てたオーケストレーターの `SKILL.md` の、プロジェクトルートからの相対パス。既定は `<harnessDir>/skills/aidlc/SKILL.md` です。`.agents/skills/aidlc/SKILL.md` のように、その外で emitter が生成する場合に宣言します。
- `frontmatterAdditions`: 任意。コアから生成する `.md` のフロントマターへ、ファイルごとに追加する YAML 行です。他のハーネスには不要なホスト固有フィールドに使います。kiro-ide は委譲先エージェントに `tools: ["read", "write", "shell"]` を追加し、IDE はこれをサブエージェントのツール権限として読みます。パスの誤記、フロントマターの欠落、コアで既に宣言済みのキーはエラーになります。
- `nativeReplacements`: 任意。リリース形式が汎用の呼び出し書き換えの前に差し替える、正確な `{ from, to }` のテキスト。コピー形式の綴りに機械的なネイティブ形がない生成内容（kiro-ide のペルソナのシェル拒否）に使います。`from` が生成物に無ければパッケージャーはエラーにし、生成した呼び出しの検査では、ルート表から生成される `to` のテキストを対象外にします。
- `rulesRename`: ルールディレクトリの変更先。`"steering" | "aidlc-rules" | null`。コピー先、文章中の `<harnessDir>/rules/` 参照、コンパイル済みグラフのルールパスをまとめて更新します。コンパイル時には `AIDLC_RULES_DIR` を設定して `loadRules` が変更後の場所を読めるようにします。`tools/data/harness.json` にはマニフェスト名とルールディレクトリを記録します。実行時は名前で同じエンジンディレクトリを共有するハーネスを区別し、`rulesSubdir()` で改名結果を取得します。`core/` の変更は不要です。
- `onboarding: OnboardingSpec`: 中立な`core/templates/onboarding.md`とハーネス固有の`core/templates/onboarding-harness.md`を`harness/<name>/onboarding.fills.ts`で生成します。`dst`が出力先、`projectRoot: true`ならエンジンの隣です。`harnessDst`を指定すると中立部分とネイティブ部分を分け、省略するとネイティブ部分・空行・中立部分の順に結合します。ネイティブ側の先頭`frontmatter`は常時適用設定を受け付け、中立側にmarkerは置きません。`shared: "identical"`のルート出力はバイト一致を検証します。emitterが担当する場合、または配布しない場合だけnullです。
- `skipRunnerGen`: `<harnessDir>/skills/` を持たない場合に設定します。Codex は `emit` で `.agents/skills/` を生成するため、標準のランナー生成処理を省略します。
- `emit`: 必要な場合に指定する生成処理。手順3で説明します。不要なハーネスは `null`。
- `plugin`: 任意。ホストのプラグインマニフェストのディレクトリと配布方式。省略すると `<harnessDir>-plugin` とストア配布を使います。フォルダ配置型のホストだけ `kind: "kiro"` にします。

最小構成の例は、改名も emitter もない Claude のマニフェストです。Kiro は改名と `harnessFiles` を追加し、エージェントJSONとアダプターを配置し、ルートとネイティブのonboardingを分離します。Codex はネイティブ限定のルート設定と emitter の例です。

これらのフィールドから、パッケージャーは `tools/data/harness.json`、`aidlc-stamp.json`、`aidlc-projection.json` を生成します。順に、実行時設定、バージョン・配布形式・ハーネスの識別情報、インストールの所有権契約です。所有権契約の任意の `onboarding` パス（プロジェクト相対）は、診断が追跡するネイティブの導入文書を示します（導入文書がルートのファイルなら省略します）。`aidlc config` は矛盾や危険のある記述を拒否します。`emit.ts` で別の同種メタデータを生成しないでください。

## 手順2: フックアダプター

コアフックは Claude 形式の標準入力を受け取ります。新しいハーネスは `harness/<name>/hooks/aidlc-<name>-adapter.ts` を1つ作成し、`harnessFiles` に登録します。アダプターはホストのフックペイロードを共通形式へ変換し、サブプロセス経由でコアフックへ渡します。
コアフックをロジックとアダプターに分割してはいけません。明示的な呼び出しトークンの変換を除き、コアの本文は全ハーネスで共通です。`--check` が両配布形式のソース一致を検証します。

ホスト固有の方法でアダプターをイベントに登録します。Kiro は `agents/aidlc.json`、Codex は `hooks.json` を使います。対応するコアフックがあるイベントだけを登録してください。

6つのフックは処理の流れを変えるため、入出力の転送に加え、制御情報も引き継ぐ必要があります。Stop は標準出力に `{"decision":"block"}` を返します。dispatch-rules は委譲先プロンプトを書き換えます。PreToolUse の reviewer-scope、review-freeze、plan-approval、state-transition は終了コード2と標準エラーの理由で拒否を表し、アダプターがその終了コードを返したらツール呼び出しを拒否しなければなりません。
事前フックでツールを強制拒否できないハーネスでは、reviewer-scope と review-freeze を登録せず、制約を文書に記載します。その場合も stage-protocol-reviewer.md §12a の文章による制約は適用されます。サブエージェントの識別情報がペイロードにない場合は、ホストが対応していればレビュアーのエージェント自身に限定してフックを登録します。Kiro CLI の方式では、`agent_type` の照合に代えて `scoped_registration` を表明します。

> `core/` を編集できる例外は doctor の検査です。`core/tools/aidlc-utility.ts` の `/aidlc --doctor` に、アダプター・設定ファイルの存在やバイナリの最低バージョンなど、ハーネス別の検査を追加できます。CLI を起動して semver を比較する処理はマニフェストでは表せないためです。これは意図的なハーネス別の*ロジック*であり、データではありません（ナレッジはコードに置くという三つの関心事の規則）。そのため「`core/` を編集しない」の違反ではなく、意図した設計上のトレードオフとしての例外です。ハーネス別検査がなくても、失敗せずに共通の検査だけが動きます。ディレクトリ解決、ルールディレクトリの改名、パッケージ化は引き続きマニフェストだけで設定します。

## 手順3: 必要な場合だけ `emit.ts` を実装する

宣言で表せない構造上の違いは、マニフェストから指定する `emit.ts` で生成します。パッケージャーが渡す `EmitContext` には `repoRoot`、`coreRoot`、`harnessRoot`、`harnessName`、`distRoot`、`harnessDir`、配布形式を考慮する `substituteToken`、`tierCap` が含まれます。出力先は `distRoot` の下です。
Codex は `config.toml`、`hooks.json`、フック信頼設定の初期値、ネイティブonboardingのスキルパス書換え、エージェントの TOML、`.agents/skills/` を生成します。スキルは `AIDLC_HARNESS_DIR` のもとで `core/tools/aidlc-runner-gen.ts` の公開描画関数を組み合わせ、再実装しません。Claude や Kiro のように、用意したファイルだけで構成できる場合は `emit: null` にします。

`--check` は独立した2組の一時 `distRoot` で各配布形式の emitter を実行し、生成ルート全体を比較します。`.agents/skills/`のような `<harnessDir>` 外の出力も、欠落・内容差・余分なファイルの検査対象になります。生成するコマンド文字列には必ず `ctx.substituteToken` を適用してください。適用しないと、ネイティブ形式に Bun コマンドが混入するおそれがあります。

## 手順4: 変換の範囲を守る

許される変換は、ハーネス／ルールの配置、2つの呼び出しトークン、宣言されたティアやフロントマターの追加、`rewriteNativeInvocations` によるネイティブ設定への書き換えです。ネイティブ変換はコマンド許可リスト、フック・アダプター・ステータスラインの呼び出し、導入説明、ネイティブの信頼設定を更新します。AIDLC ツールやフックへの Bun 呼び出し、未展開のトークンが残っていれば拒否します。無差別な `sed` 置換は行いません。
`core/` 内の正当なホスト固有記述はそのまま残します。たとえば `$CLAUDE_PROJECT_DIR` の説明や workspace-detection のハーネスディレクトリ一覧には、置換トークンがありません。core-hygiene と native-projection のテストがこの境界を検証します。

もう 1 つの変換は、各ツリーを自分のツールのものだけに保ちます。construction、topology、reviewer、swarm のプロトコルモジュールは、いずれもハーネスごとに 1 つの `### <tool>` バインディング小節で終わり、`scripts/harness-bindings.ts` は各ツリーに自分の小節だけを出荷します。移植するには、それぞれの並びにあなたのツールの小節を加え、その見出しを `BINDING_HEADINGS` に追加してください。追加するまでは、あなたのツリーにすべてのツールの小節が出荷されます。

## 手順5: テストと検証ゲート

- `t145` の再現性テストが `package.ts --check` を実行します。検出した全ハーネスの両配布形式と全プラグインを対象とし、事前に生成済みのツリーを必要としません。
- `t243-install-mechanism` は、コピー形式に Bun 呼び出しが残り、リリース形式に AIDLC の Bun 呼び出しがなく、メタデータが安全かつ網羅的で、ネイティブ限定の設定が `dist-release/` にだけ現れることを確認します。
- `t238-build-binaries` はネイティブディスパッチャーをコンパイルし、`PATH` に Bun がない環境で各ハーネスのランタイムを実行します。
- `<name>` のフックアダプター契約テストは、実環境で取得したペイロードをアダプターへ流し、コアフックの作用を確認します。
- 実環境の e2e は `skipReason()` で制御します。`AIDLC_<NAME>_*_LIVE=1`、バイナリの存在、認証済みであることを条件とし、決定論的テストではスキップします。移植をマージする前にローカルで成功を確認します。

`bun scripts/package.ts <name>` で両形式を生成し、`--check` で再現性を確認します。さらに `bash tests/run-tests.sh --smoke --unit --integration -P 8` と実環境の動作確認を行います。

## 次に読む

これで、データの調整を扱う1〜8章に続き、別の CLI でもコアを実行できるようになりました。

- 全体の構成は [ハーネスエンジニアガイド](00-overview.md) を参照してください。
- 新しいハーネスには利用者向けの章も用意します。[他のハーネスでの実行](../guide/harnesses/README.md) にある既存の章を参考にしてください。
- マニフェスト型、`emit` の API、`harnessDir()` の正式なビルド契約は、[アーキテクチャ § ソースと配布物](../reference/01-architecture.md#ソース対ディストリビューション1-つのコア複数のハーネス) を参照してください。
