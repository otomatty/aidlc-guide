# プラグインを作成する

> [ハーネスエンジニアガイド](00-overview.md) の一部。前提:
> [ステージの構造](01-anatomy-of-a-stage.md)。設計のリファレンス（機構、インストール時の
> 理由づけ、ハイブリッド配布モデル、実装状況）:
> [プラグイン機構](../reference/18-plugin-mechanism.md)。

**AIDLC プラグイン**（以下**プラグイン**）は、再利用可能で任意の AIDLC 貢献の集合です —
新しいステージ、エージェント、スコープ、メソッド／ルール（メモリ層）、センサー、手法の
ナレッジ、そして既存のコアステージへの加法的な変更 — を、それ自身のディレクトリへ
パッケージし、それ自身のリポジトリから公開し、利用者が選んだプラグイン集合の上へ
**合成**します。プラグインが `core/` を編集することは決してありません。すべてのプラグインを
無効にすれば、インストールは素のコアとバイト単位で同一です。

一次配布のプラグイン（AIDLC チームが出荷）と第三者のプラグイン（それ以外の誰か）は
**機構的に同一**です — 同じ構造、同じ継ぎ目、同じコンポーザー、同じ保証。違いは来歴だけです。
プラグインが誰のリポジトリに住み、誰がレビューしたかです。

新しいリポジトリは `aidlc-plugin-create.ts` で始めます。この章はその後、より充実した
`test-pro` の参照プラグインを最初から最後まで辿ります。

## プラグインを書くか、素のステージ／ルールにするか

- **ステージ／エージェント／ルール**（[2〜6 章](00-overview.md)）は、全員が得る
  フレームワークの恒久的な一部です。
- **プラグイン**は_任意で所有される_ものです — それ自身のリポジトリで出荷され、オプトインの
  スコープ（および／または `when:` の述語）でのみ有効になり、利用者が自分のインストールへ
  合成することを選びます。すべてのプロジェクトが欲しいわけではない領域パック（operation
  フェーズ一式、コンプライアンスのプラグイン、テストのプラグイン）に使ってください。

## 1. ディレクトリとマニフェスト

プラグインは、宣言的なマニフェストと、コアと同じ形のサブツリーを持つディレクトリ（かつ git
リポジトリ）です。

```text
test-pro/
  .aidlc-plugin/plugin.json                          # the manifest
  stages/construction/test-pro-integration.md        # NEW stages
  stages/operation/test-pro-full-suite.md
  contributions/construction/nfr-requirements.md      # MODIFY existing core stages (§3)
  contributions/construction/nfr-design.md
  contributions/construction/build-and-test.md
  contributions/operation/performance-validation.md
  sensors/aidlc-coverage-threshold.md                 # NEW sensor manifests
  sensors/aidlc-requirement-coverage.md
  tools/aidlc-sensor-coverage-threshold.ts            # the sensor scripts
  tools/aidlc-sensor-requirement-coverage.ts
  tools/test-pro-doctor.ts                             # optional /aidlc --doctor checks
  scopes/test-pro-validation.md                       # NEW plugin scope
  agents/test-pro-metrics-agent.md                    # NEW support persona
  knowledge/test-pro-metrics-agent/methodology.md     # plugin methodology knowledge
  tests/plugin.test.ts                                # plugin content and compose tests
```

`.aidlc-plugin/plugin.json` は**宣言的な**マニフェストです。そのトップレベルは、一般的な
プラグインマニフェストの形を映しており（マーケットプレイスやホストのツールが一覧・
バージョン管理・信頼付与できるように）、AIDLC 固有の設定は入れ子の `aidlc` ブロックに
住みます。

```jsonc
{
  "name": "test-pro",                 // == dir name; "core", "aidlc", and "aidlc-*" are reserved
  "version": "0.1.0",                 // semver; checked by dependents
  "description": "Full-featured testing plugin — unit/branch coverage, functional, integration, regression, edge, and API positive+negative.",
  "author": { "name": "AWS AIDLC" },
  "dependencies": ["core"],           // other plugins, e.g. ["compliance@^1.2.0"]
  "aidlc": {
    "contributes": {                  // which subtrees this plugin ships
      "stages": "stages/",            // NEW stage files
      "overlays": "contributions/",   // CONTRIBUTION files (§3 — modify existing)
      "agents": "agents/",            // NEW personas
      "scopes": "scopes/",            // NEW scope identities
      "knowledge": "knowledge/",      // methodology knowledge for agents
      "sensors": "sensors/",          // sensor manifests
      "tools": "tools/"               // runnable sensor + doctor scripts
    }
  }
}
```

`contributes` は、慣習的なプラグインのサブツリーを宣言します。設定可能なルーティングは
まだ実装されていないため、存在する各値は上に示した正確な正規パスを使わなければなりません。
VALIDATE、BUILD、TEST は、`"stages": "custom-stages/"` のような代替を、その内容を静かに
省くのではなく拒否します。
`tools` は CLI スクリプトをハーネスの `tools/` ディレクトリへ着地させるため、プラグインは
**実行可能なセンサー**（マニフェストを `sensors/` に、スクリプトを `tools/` に）と、任意の
doctor 検査を出荷できます。
テストとフィクスチャは、`tools/` の中ではなく、プラグインのトップレベルの `tests/`
ディレクトリに置いてください。合成は `tools/tests/`、`tools/__tests__/`、`tools/fixtures/`
配下のファイルと、隣接する `*.test.ts` / `*.spec.ts` のファイルを落とし、`/aidlc --doctor` が
可視化する助言のドロップを記録します。古い合成バージョンが残した積荷についても、
インストール済みの tools ツリーを走査します。それらレガシーのファイルは来歴を持たないため、
この移行の助言は、現在合成中のプラグインへ帰属させることなく、インストール先のパスを
名指しします。
`overlays` は特別です。その正規のディレクトリは `contributions/` であり、そのファイルは
プリミティブなサブツリーとしてコピーされるのではなく、マージによって消費されます。

`memory` の投影は引き続き延期されています。`contributes.memory` はまだ宣言しないで
ください。既定スペースのメソッドシードのマージが出荷されるまで、作成ツールがそれを拒否します。

あなたのプラグインが使うキーだけを出荷してください。`test-pro` は支援エージェント、
プラグインのスコープ、エージェントごとの手法ナレッジを出荷しますが、リードには引き続き
`aidlc-quality-agent` を再利用しています。

> **番号の範囲はありません。** ステージ番号は表示専用であるため、プラグインがマニフェストで
> 番号の範囲を要求することは**ありません**。§2 を参照してください。

## 2. 新しいステージを追加する

プラグインのステージは、ふつうのステージファイル（[ステージの構造](01-anatomy-of-a-stage.md)
を参照）に、追加の規則が 2 つ付いたものです。

- その `plugin:` フィールドが、あなたのプラグインを名指しします。
- `produces:` するどの成果物も `<plugin>-` の接頭辞が必要です（たとえば
  `test-pro-integration-test-results`）。

同じ論理的なプラグイン名が、所有するすべてのステージ、スコープ、エージェント、コントリ
ビューションに現れなければなりません。合成はその同一性を、出力されたホストのマニフェストから
導出します（ホスト層では `aidlc-<name>`、AIDLC のフロントマターでは `<name>`）。コンテンツが
自分のパッケージを改名したり、なりすましたりすることはできません。不一致は飛ばされ、
`/aidlc --doctor` のために記録されます。

`bundle:` は改名前の所有権のキーであり、修正方法を名指しするエラーとともに拒否されます -
`plugin:` と書いてください。この語は、将来のプラグインの集合という概念の可能性のために
予約されています。

ステージの**同一性は slug** であり、それが重要なあらゆる場所（エッジ、ジャンプ、解決）で
そうです。`number:` は**表示のヒント**にすぎません — ステージのグラフ上の位置は slug に
基づく `requires_stage` のエッジから来ますし、コンパイルされる番号の値を割り当てるのは
**エンジン**であって、決してあなたではありません。最初のコンパイルで、あなたのプラグインの
新しいステージは、それら自身の `requires_stage` のエッジで並べられ、独立したステージ同士の
タイブレークにだけあなたの書いた `number:` の値が使われ、そのフェーズにおける次の空き番号が
与えられます。したがって、意味の通る、かつ自分のエッジと合致する番号を書いてください
（`test-pro-integration` は `3.6` の `build-and-test` の後で `3.85`）— 効いてくるのは
**相対的な**順序です — が、絶対値がグラフへ着地することは決してなく、ステージを挿入しても
コアの番号が振り直されることはなく、あなたが範囲を要求することもありません（だからこそ、
調整していない 2 つのプラグインが番号で衝突することはありえません）。

ステージをスコープへ結び付けるには `scopes:` を使います（それ以外の場所では SKIP です）。
任意で `when:` の述語も宣言できます。`test-pro-full-suite` は、上流の生成者が計画に載って
いるときにだけ実行される*意図*です。

```yaml
scopes:
  - enterprise
when:
  producer-in-plan: test-pro-regression-suite
```

> **`when:` はパースされますが、まだ評価されません。** スキーマは述語を検証し、パーサーは
> それを読みますが、今日それに反応するエンジンの消費者はいません — `when:` を持つステージは、
> 宣言された `scopes:` の下で無条件に EXECUTE です。前方互換のために書いておくのは構いませんが、
> 当面は実際の振る舞いを `scopes:` でゲートしてください。

スコープのメンバーシップと `when:` の述語については [スコープ](04-scopes.md) を参照してください。

## 3. 既存のコアステージを変更する（コントリビューション）

これがコントリビューションの継ぎ目です — コアステージを**編集せずに**加法的に変更します。
コントリビューションは `<plugin>/contributions/<phase>/<slug>.md` に住みます。以下は
`test-pro` の `nfr-requirements` へのコントリビューションです。

```markdown
---
target: nfr-requirements      # the existing core stage you're enriching
plugin: test-pro
adds:                         # STRUCTURAL — set-unioned into the stage node
  produces:
    - test-pro-testability-requirements   # <plugin>- prefixed
  required_sections:
    - "Testability Requirements"          # machine-enforced
    - "Coverage Targets"
fragments:                    # PROSE — spliced into the stage body
  - anchor: after-step:6
    order: 100
---

## fragment: after-step:6

### Step 6b (test-pro): Capture testability NFRs

…prose the agent will see, appended after the target stage's Step 6…
```

追加できるもの（すべて加法的 — 設計上、**上書きや削除はできません**）。「ステータス」は、
合成フックが今日マージするものと、設計済みだが延期されているものを示します（doc 18 の
§5／§8 を映しています — 実装するか降格するかであって、静かな no-op にはしません）。

- `adds.produces` / `adds.consumes` / `adds.sensors` — ✅ 対象ステージのソースの
  フロントマターへ集合和として取り込まれます。
- `adds.required_sections` — ✅ ステージの `required_sections` へマージされます。ただし
  **今日は機械的に強制されません**。フィールドは書かれ検証もされますが、コンパイル済みの
  グラフノードには届かず、出荷される `required-sections` センサーは期待値をテンプレートから
  導くため、セクションの欠落でステージが落ちることはまだありません。当面は宣言的な意図として
  扱ってください。
- `adds.scopes` — ✅ 対象ステージの `scopes:` 一覧へ集合和として取り込まれます。ただし 2 つの
  ガードレールがあります（違反はいずれもドロップとして記録され、決してマージされません）。
  そのスコープの同一性ファイルがインストールされていること（`scopes/<name>.md` が同じ
  プラグインで出荷されている）、そしてそのファイルの `plugin:` フロントマターが、あなたの
  プラグインを厳密に名指ししていることです — コアのステージを、コアや他プラグインのスコープの
  下へ置くことはできません。所有権は、名前の接頭辞から推測されるのではなく、インストール済み
  ファイルが宣言する所有者から読まれます。既存のコアステージを、あなたのプラグインのスコープの
  下へルーティングするために使います — たとえば、独自の発見ステージに加えて、コアの Inception
  以降を自分のスコープに載せる手法プラグインなどです。
- `adds.requires_stage` — ⏳ **延期**: コントリビューションはこれを宣言できますが、合成は
  マージするのではなくドロップのログへ記録します（まだ DAG のエッジではありません）。
  これで振る舞いをゲートすることは、まだ当てにしないでください。
- `fragments` — ✅ ステージ本文へ挿入される散文のブロック。各フラグメントの散文は、
  コントリビューションファイル中の `## fragment: <anchor>` ブロックです。

### フラグメントのアンカー

| アンカー             | フラグメントを挿入する位置…                                              | ステータス |
| ------------------ | ------------------------------------------------------------------ | ------ |
| `after-step:<n>`   | `### Step <n>` の直後（次の `###`／`##` の前）            | ✅ |
| `before-step:<n>`  | `### Step <n>` の直前                                  | ✅ |
| `end-of-steps`     | `## Steps` ブロックの末尾                                 | ✅ |
| `in:<Compartment>` | 名指しされた `## <Compartment>` ブロックの末尾（例: `in:Sensors`） | ✅ |
| `after-questions`  | 質問を生成する手順の後                                | ⏳ 未実装 — `locateAnchor` にケースが無く、「unknown anchor」としてドロップします。`after-step:<n>` を使ってください。 |

フラグメントは `(order, plugin)` により決定論的に並べられます。同じ
`(plugin, anchor, order)` の衝突 — 1 つのファイル内でも、この実行における 2 つの
コントリビューションファイル間でも — は**ドロップとして記録**されます（最終書き込み優先では
ありません）。*異なる* 2 つのプラグインが同じステージへ貢献するとき、それらの構造上の追加は
集合和になり、フラグメントはこの同じ順序で交互配置されます — 本当にマージされます。

挿入される各フラグメントは、コンテンツハッシュを運ぶセンチネルコメント
（`<!-- plugin:<plugin>:<anchor>:<order>:<hash> --> … <!-- /plugin:… -->`）で囲まれます。
これが、再合成を冪等に保ち、更新されたフラグメントが以前のブロックを置き換える仕組みです。
合成はさらに、適用に成功した各フラグメントのアンカー・順序・ハッシュを、プラグインの
コントリビューションのサイドカーへ記録します。この来歴は散文だけのプラグインにも存在し、
エンジンの再インストール後にマーカーの欠落やフラグメント本文の変化を doctor が検出できる
ようにします。そこから作成上の規則が 2 つ導かれます。

- **フラグメントの散文に、センチネルそっくりの行を書かないでください。** 散文の中の
  `<!-- /plugin:… -->` に一致する行は、ブロックの終端と誤認され、アップグレード時に挿入を
  壊します。
- **プレリリースのビルドからのアップグレード:** このブランチの*レビュービルド*（ハッシュが
  センチネルへ加わる前）で合成されたインストールは、古いハッシュ無しのマーカーを持ちます。
  アップグレードはそれを認識せず、2 つ目のコピーを挿入してしまいます。影響を受けるのは
  PR ブランチのインストールだけです。きれいなベースから再合成するか、古いブロックを一度だけ
  手で削除してください。

### エンジンのアップグレードのライフサイクル

エンジンの再インストールは、素の `dist/<harness>/` のグラフとコアのステージソースを、
実効的なインストールの上へコピーします。プラグイン名前空間のファイルとコントリビューションの
サイドカーはそのオーバーレイを生き延びうる一方で、それらのグラフのエントリと、構造上または
散文のコントリビューションのマージは消えます。作成者は、再合成をアップグレードの手順に
含めるべきです。エンジンを再インストール／アップグレードしたら、そのつど
`/aidlc plugin sync` を実行してください（あるいは、プラグインの合成フックを持つホストで
新しいセッションを始めてください）。合成は冪等なので、これは変更のないコントリビューションを
重複させずに、同じ実効的な面を復元します。`/aidlc --doctor` は壊れた状態を
**合成済みプラグイン面**として報告します。有効なプラグインのサイドカーが読み取り不能または
不正なとき、記録された対象ステージがもはや存在しないとき、記録された構造上または散文の
コントリビューションが欠落または変化しているとき、この検査はフェイルクローズします。
consume のレコードは `artifact`、`required`、任意の `conditional_on` を保持して検証します。
古いサイドカーの成果物のみのレコードも引き続き互換です。不正なサイドカーを、すでに合成済みの
ステージから安全に再構成することはできません。素のエンジンを入れ直し、そのサイドカーを
削除してから `plugin sync` を実行してください。

## 4. 他のプリミティブのパッケージング

`test-pro` は、ステージ、コントリビューション、センサー、支援エージェント、スコープ、手法の
ナレッジを出荷します。より充実したプラグインは、後にメソッド／ルールも加えられます。
メモリの投影は引き続き延期されています（doc 18 §8 のステータス）。

- **エージェント。** `plugin:` を設定した `agents/<plugin>-<role>-agent.md` を置きます。
  プラグインの接頭辞がコアの `aidlc-` のファイル名接頭辞を置き換え、ファイル名の語幹は
  フロントマターの `name` と一致していなければなりません（たとえば
  `agents/test-pro-metrics-agent.md` は `name: test-pro-metrics-agent`）。合成後に自動的に
  発見され、あなたのプラグインのステージがそれを `lead_agent`／`support_agents` として
  名指しできます。同じパスで内容の異なる衝突は上書きされず、合成がドロップのログを記録します。
  OpenCode の合成では、ネイティブの `.opencode/agents/` サブエージェントの片割れも作成し、
  入れ子の `task` 委譲を拒否します。[エージェントを追加する](03-adding-an-agent.md) を
  参照してください。
- **センサー。** マニフェスト `sensors/aidlc-<id>.md` **と**、そのスクリプトを `tools/` の下へ
  出荷します（両方です — マニフェストだけでも発見はされますが、実行するにはスクリプトが
  `tools/` に無ければなりません）。`sensors/` 直下の `aidlc-<id>.md` という名前は慣習ではなく
  厳格な要件です。センサーの発見は `sensors/` をフラットに走査し、`aidlc-<id>.md` に一致する
  ベース名だけを索引するため、それ以外の名前（またはサブディレクトリに入れ子になったもの）の
  マニフェストは、合成はされても決して発火しません。合成はいまや、そのようなマニフェストを、
  ファイル名と要求される形を名指しする劣化ドロップ（`--doctor` が可視化）とともに拒否し、
  死んだまま着地させることはありません。センサーは `sensors:` で自分のステージへ、または
  コントリビューションの `adds.sensors` でコアステージへ結び付けます。
  [センサー](06-sensors.md) を参照してください。
- **メソッド／ルール。** *(⏳ 延期。)* 将来の `contributes.memory` の面が、
  `memory/phases/<phase>.md` と `memory/{org,team,project}.md` を、既定スペースのメソッド
  シード（`aidlc/spaces/default/memory/`）へマージします。パッケージャーと合成フックは、まだ
  そのサブツリーを投影しません。ビルドがそれを省いたまま成功を報告しないよう、作成ツールは
  その宣言を拒否します。`rules/` ディレクトリは出荷し**ないで**ください — そのパスはもう
  読まれません（ルール層はスペースごとのメモリへ移りました）。
  [ルールとループ](05-rules-and-the-loop.md) を参照してください。
- **ナレッジ。** エージェントごとの**手法**ナレッジを `knowledge/<agent-slug>/` の下へ
  出荷します。フレームワークが出荷する `<harness>/knowledge/` ツリーへ投影され、そのエージェントが
  ステージをリードまたは支援するときに読み込まれます。注意: **領域／チームのナレッジ**
  （`aidlc/spaces/<space>/knowledge/`）はブートストラップ時点で空のユーザー実行時状態であり、
  プラグインがそれを出荷することはありません。[チームナレッジ](07-team-knowledge.md) を
  参照してください。
- **スコープ。** スコープの**同一性**は、`scopes/<plugin>-<name>.md` の下へ出荷する 1 つの
  ファイルです。プラグインの接頭辞がコアの `aidlc-` のファイル名接頭辞を置き換え、ファイル名の
  語幹はフロントマターの `name` と一致していなければなりません（たとえば
  `scopes/test-pro-validation.md` は `name: test-pro-validation`）。コアの `classic` 既定が
  無効なときのフォールバックとしてプラグインのスコープを指名するには `freeform_default: true`
  を設定します。選択されたコア／プラグイン集合の中で、それを主張できる有効なスコープは多くとも
  1 つであり、曖昧な集合はグラフのコンパイルが拒否します。プラグインが作成したステージの
  メンバーシップは、その `scopes:` フロントマターの一覧です。コントリビューションの
  `adds.scopes`（§3）は、既存のコアステージへ**あなたの**スコープを加えます。
  [スコープ](04-scopes.md) を参照してください。

### doctor 検査を出荷する

プラグインにインストールの前提条件があるとき、あるいは `/aidlc --doctor` が検証すべき合成済み
ファイルがあるときは、`tools/<plugin>-doctor.ts` を追加します。このスクリプトは任意で、
プラグインが有効なあいだだけ実行されます。`AIDLC_PROJECT_DIR`、`AIDLC_HARNESS_DIR`、
`AIDLC_PLUGIN_NAME` を受け取り、他の標準出力を出さずに JSON の契約を出力しなければなりません。

doctor の発見は、インストール済みプラグインの同一性を、所有するステージとスコープの
メタデータから導出します。したがって doctor スクリプトが発見されるには、プラグインが少なくとも
1 つのステージまたはスコープを所有していなければなりません。tools だけ、sensors だけ、
knowledge だけのプラグインでは足りません。

```typescript
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(
  process.env.AIDLC_PROJECT_DIR ?? process.cwd(),
  process.env.AIDLC_HARNESS_DIR ?? ".claude",
);

console.log(JSON.stringify({
  checks: [{
    pass: existsSync(join(root, "tools", "my-plugin-helper.ts")),
    label: "my-plugin helper installed",
    fix: "Run `bun <harness-dir>/tools/aidlc-utility.ts plugin-sync` or re-run hooks/compose.ts.",
    severity: "error",
  }],
}));
```

既定の `error` の振る舞いでよければ `severity` を省いてください。doctor を失敗させてはならない
可視の指摘には `advisory` を使います。スクリプトは読み取り専用で依存なしに保ってください。
doctor はその実行時間と出力を区切り、スクリプトの失敗を診断の行へ変えます。

## 5. 配布とインストール

出荷されるビルダーは、あなたのプラグインを、1 度に 1 つのハーネス向けの**本物のホスト
プラグイン**として出力します。`.claude-plugin/plugin.json`、`.codex-plugin/plugin.json`、
Copilot の `.plugin/plugin.json`、そして Kiro のフォルダ投影を含みます。

```bash
bun <tools-dir>/aidlc-plugin-build.ts <plugin-root> <harness> [outDir]
```

既定の出力先は `<plugin-root>/dist/<harness>/` です。公開するハーネスごとに 1 回ずつ実行して
ください。リポジトリのパッケージャーは同じエミッターを使って一次配布の
`dist/plugins/<name>/<harness>/` ツリーをビルドするため、そのバイト一致のガードが外部の
ビルドも守ります。出力を semver のタグと `marketplace.json` を持つ git リポジトリへ公開すれば、
チームはホストのネイティブなコマンドでインストールできます。

### Claude / Codex（ホストのストア）

```bash
# teams run these in their host CLI:
/plugin marketplace add <your-org>/<your-plugin-repo>    # Claude
/plugin install test-pro@<marketplace>                   # Claude

codex plugin marketplace add <your-org>/<your-plugin-repo>   # Codex
codex plugin add test-pro@<marketplace>                      # Codex
```

**SessionStart フック**（出力されたプラグインに同梱）が自動的に合成します — 選ばれた
すべてのプラグインのサブツリーとコントリビューションをマージし、マージ結果を検証し、
ステージグラフとスコープグリッドをコンパイルし、結果を投影します。オーケストレーターは
完全にそのコンパイル済みグラフから経路を決めるため、プラグインのステージは合成された瞬間に
実行されます — 編集すべき散文もスキルファイルもありません。

### Kiro（ストア無し — フォルダを置いて、コンポーザーを明示的に実行）

```bash
# git pull your plugin repo, copy the Kiro projection into the project:
cp -r dist/plugins/<name>/kiro/. <project>/
# preferred when aidlc is on PATH:
AIDLC_PLUGIN_ROOT="<plugin-root>" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro aidlc plugin sync

# fallback: run the composer explicitly:
AIDLC_PLUGIN_ROOT="<plugin-root>" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro bun "<plugin-root>/hooks/compose.ts"
# open in Kiro IDE or kiro-cli chat → /aidlc
```

> **Kiro の注記。** Kiro IDE 1.0 以降では `kiro-ide` の投影を使ってください。そのフォルダ
> 配置には v2 の `.kiro/hooks/aidlc-<plugin>-compose.json` の SessionStart 登録が含まれ、
> ワークスペースルートからクロスプラットフォームの `hooks/aidlc-plugin-compose.ts` Bun
> ランチャーを実行します。Kiro CLI 向けの `kiro` の投影はフック登録を出力しないため、上記の
> 明示的なコンポーザーのコマンドのいずれかを実行してください。どちらの投影も、退役した
> `.kiro.hook` のプラグイン登録を出力しません。

### 信頼

信頼は**ホストネイティブ**です — あなたが作るものはありません。
- Claude: 組織の管理者が `strictKnownMarketplaces` を設定します（管理対象で、上書き不可）。
- Codex: プラグインごとに 1 度きりの信頼のプロンプト。コンテンツハッシュでピン留めされます。
- Kiro: 該当なし（フォルダ配置。ホストのゲートはありません）。

> **具体的な例** — `plugin.json`、`marketplace.json`、`managed-settings.json`（組織の信頼設定）、
> `aidlc.lock.json` — は [`examples/test-pro/`](../reference/examples/test-pro/) にあります。
> プラットフォームチームの完全な実例は
> [プラグイン機構 §8](../reference/18-plugin-mechanism.md) も参照してください。

## プラグインの作成とテスト

出荷される雛形から始め、そのうえで安価なものからもっとも現実的なものまで、3 つのテストの
ティアを使います。

### プラグインを作る

決定論的で最小限のプラグインリポジトリを作ります。

```bash
bun <tools-dir>/aidlc-plugin-create.ts <name> [targetDir]
bun <tools-dir>/aidlc-plugin-create.ts <name> [targetDir] --json
```

名前は小文字のケバブケースで、対象ディレクトリ名と一致していなければならず、`core`、`aidlc`、
そして予約された `aidlc-` の接頭辞は使えません。`targetDir` を省くと、出力は `./<name>/` へ
着地します。CREATE は空でない対象を拒否し、既存のファイルを決して上書きしません。

雛形には、スキーマ的に妥当なマニフェスト、名前空間付きの例となるステージ・スコープ・
エージェントが 1 つずつ、作成の流れ全体を書いたルートの README、そして `tests/` の README が
含まれます。意図的に `hooks/compose.ts` を省いており、検証は文書化された不在の警告を報告し、
BUILD が同梱の最新フックを注入します。

### プラグインを検証する

ビルドや合成の前に、出荷されるバリデーターをプラグインリポジトリのルートに対して実行します。

```bash
bun <tools-dir>/aidlc-plugin-validate.ts <plugin-root>
bun <tools-dir>/aidlc-plugin-validate.ts <plugin-root> --json
```

このツールはオフラインでスタンドアロンです。`<plugin-root>` は
`.aidlc-plugin/plugin.json` を含むディレクトリであり、AIDLC のプロジェクトも
フレームワークのチェックアウトも不要です。終了コード `0` は妥当、`1` は作成上の指摘、
`2` は不正なコマンドの使い方を意味します。JSON の出力は `{valid, errors, warnings}` で、
ファイル単位の安定した指摘を持ちます。

検証する内容:

- マニフェストが存在し、文書化された同一性、SemVer、`aidlc.contributes` の形を持つこと。
- すべてのステージがパースでき、出荷されるステージスキーマを通り、slug・ファイル名・
  プラグインの所有権が一致していること。
- スコープが `<plugin>-<name>.md` を使い、フロントマターの同一性と一致し、対応する深さを
  宣言し、宣言されたキーワードが空でないブロックまたはフロー形式のリストとしてパースできること。
- エージェントが `<plugin>-<role>-agent.md` を使い、フロントマターの同一性と一致すること。
- どのステージも消費していない場合であっても、`produces` と `optional_produces` にまたがって、
  2 つのプラグインステージが同じ成果物を生成していないこと。
- 生成される成果物がプラグイン名の接頭辞を使い、ステージ本文が空でなく、ステージのエージェント
  参照が同梱コアとプラグインの陣容に対して解決でき、コントリビューションの対象が同梱コアの
  ステージ slug へ解決できること。
- 作成されたプラグインのコンテンツが通常のファイルとディレクトリを使っていること。stages、
  scopes、agents、contributions、sensors、knowledge、tools、hooks の下のシンボリックリンクは、
  静かに省かれたり辿られたりするのではなく拒否されます。
- `tools/` に、合成がインストールへコピーしてしまう入れ子の `tests/`、`fixtures/`、`*.test.ts` の
  積荷が無いこと。
- ベンダリングされた `hooks/compose.ts` が存在する場合、バリデーターに同梱されたテンプレートと
  バイト単位で同一であること。不在は妥当です。プラグインのビルドが最新のテンプレートを
  注入するためです。

ユーザー向けの `aidlc plugin validate` と `aidlc plugin build` の動詞は、これら出荷ツールへ
委譲します。`aidlc plugin create` と `aidlc plugin test` は
[RFC #723 §2e](https://github.com/awslabs/aidlc-workflows/issues/723) へ延期されたままです。
出荷されている Bun のツールを直接呼び出してください。

リポジトリのテストヘルパーの `validatePluginContent()` は、これら共有の規則を同じツールへ
委譲しつつ、チェックアウトを意識したフィクスチャの統合を保持しています。

### プラグインをビルドする

検証済みのプラグイン 1 つを、ホストネイティブなプラグイン 1 つへ投影します。

```bash
bun <tools-dir>/aidlc-plugin-build.ts <plugin-root> claude
bun <tools-dir>/aidlc-plugin-build.ts <plugin-root> codex ./release/codex
bun <tools-dir>/aidlc-plugin-build.ts <plugin-root> cursor --json
```

ビルダーは何かを書く前に、インプロセスで検証を実行します。エラーは終了コード `1` でビルドを
拒否し、警告は続行します。不正なコマンドの使い方と未知のハーネス名は `2` で終了します。
`outDir` を省くと、出力は `<plugin-root>/dist/<harness>/` へ着地します。BUILD は、出力パスに
あるシンボリックリンク、既存の出力サブツリーの内側にあるもの、そして信頼されたビルド境界と
出力のあいだにあるものも拒否します。既定の出力ではその境界はプラグインのルートなので、
リンクされた `<plugin-root>/dist` は拒否されます。境界より上にある環境上のエイリアスが、
そうでなければ所有されている出力を無効にすることはありません。

作成の流れはこうです。

1. `aidlc-plugin-create.ts` で決定論的な雛形を **Create** する。
2. プラグインが所有するステージ、スコープ、エージェント、その他のコントリビューションを
   **Author** する。
3. 作成したルートをオフラインで **Validate** する。
4. 対応する各ハーネスの投影を **Build** する。
5. 実際のインストールの使い捨てコピーに対して合成を **Test** する。
6. 生成されたディレクトリとマーケットプレイスのメタデータを、自分のリポジトリから
   **Publish** する。

4 つのツールはいずれも、コピーされた AIDLC のツールバンドルから動き、AIDLC のプロジェクトも
フレームワークのチェックアウトも必要としません。

### 合成をテストする

「このプラグインは自分のインストールへきれいに合成されるか」という問いに、そのインストールを
変更せずに答えます。

```bash
bun <tools-dir>/aidlc-plugin-test.ts <plugin-root> \
  --install <project-root> [--harness <name>] [--json]
```

このツールはまず検証とビルドを行い、選択されたインストールの面を一時的な候補へコピーし、
実際に出力された `hooks/compose.ts` を実行し、候補のグラフを再コンパイルし、プラグインの
ステージとスコープが存在することを確認し、冪等性を証明するために合成をもう一度実行します。
合成のドロップ、グラフの失敗、プラグインノードの欠落、2 回目でのファイル変化があれば、
終了コード `1` になります。生きたインストールは前後でハッシュされ、決して合成の対象には
なりません。

インストールが曖昧なとき — `.kiro`（Kiro CLI か Kiro IDE か）や `.aidlc`（Copilot か
OpenCode か）を含みます — は `--harness` を渡してください。`--dist <version>` は、
RFC #722 のマイルストーン 2 がリリース済みランタイムバンドルの経路を定義するまで
予約されています。

1. **コンテンツ検証**は、常時オンのベースラインです。作成したプラグインのルートに対して
   `aidlc-plugin-validate.ts` を実行します。速く、作成上の指摘が正確ですが、パッケージングや
   合成が成功することは証明しません。
2. **合成の統合**は、既定の CI 検査です。実際のインストールに対して
   `aidlc-plugin-test.ts` を実行します。このリポジトリの内部では、
   `composePluginFixture()` が、フックのサブプロセスとドロップの読み取りを同じ出荷実装へ
   委譲しつつ、テスト専用のフィクスチャ API を保持しています。このティアは決定論的であり、
   実際のビルダーとコンポーザーを動かしますが、モデルを伴うハーネスは起動しません。
3. **実機ハーネスの e2e** は、オプトインの互換性の証拠です。`invokeHarness()` を呼ぶのは、
   `liveGateFor()` が返すゲートの裏側だけにしてください。実機のゲートは
   `AIDLC_CLAUDE_SDK_LIVE`、`AIDLC_KIRO_ACP_LIVE`、`AIDLC_CODEX_EXEC_LIVE`、
   `AIDLC_COPILOT_EXEC_LIVE`、`AIDLC_OPENCODE_RUN_LIVE`、`AIDLC_CURSOR_RUN_LIVE` です。
   実機の実行は、ホストが合成済みプラグインを発見して呼び出せることを証明しますが、
   インストール済みの CLI、認証情報、そしてより多くの時間を必要とします。ゲートが未設定なら
   スキップの結果を返すため、テストが green でも実機の検査が走らなかった可能性があります。

`plugins/<name>/tests/*.test.ts` 配下のプラグインのテストは自動的に発見され、統合ティアに
加わります。1 つのプラグインのテストを実行するには:

```bash
bash tests/run-tests.sh --integration --filter "plugin-<name>"
```

このリポジトリの内部では、このコンテンツのテストが、コピーできる最小の形です。ヘルパーは、
共有の規則を出荷ツールへ委譲します。

```ts
import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePluginContent } from "../../../tests/harness/plugin-kit.ts";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("plugin content is valid", () => {
  expect(validatePluginContent(pluginRoot)).toEqual([]);
});
```

プラグインがステージ、コントリビューション、エージェント、スコープ、センサー、ツールを
出荷する場合は、決定論的な合成のテストを追加してください。

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composePluginFixture } from "../../../tests/harness/plugin-kit.ts";

test("plugin composes into a Claude install", () => {
  const fixture = composePluginFixture({
    plugin: "your-plugin",
    harness: "claude",
  });
  const graph = JSON.parse(
    readFileSync(
      join(fixture.projectDir, ".claude", "tools", "data", "stage-graph.json"),
      "utf-8",
    ),
  ) as Array<{ slug?: string }>;
  expect(graph.some((stage) => stage.slug === "your-plugin-stage")).toBe(true);
});
```

## 道路の規則

- **番号は表示専用。** 意味の通る `number:` を書き、範囲は要求せず、ステージを挿入しても
  コアの番号は振り直されません。
- **成果物の名前空間。** あなたが生成するすべての成果物は `<plugin>-` の接頭辞を持ち、
  コアの成果物や他のプラグインのものと衝突してはいけません。
- **プリミティブの名前は一意。** あなたのスコープ／エージェント／センサーは、コアや他の
  プラグインと衝突してはいけません — 衝突は、帰属付きの合成エラーになります。
  （メソッドのファイルは、ファイル単位で加法的にメモリシードへマージされます。）
- **依存関係** *(⏳ 延期。)* `dependencies` は、依存側の `version` に対して `name@^x.y.z` の
  制約を解決し、循環を拒否するよう設計されていますが、**まだそのフィールドを読むものは
  ありません** — 今日それを宣言しても効果はありません（doc 18 §8 のステータス）。
- **加法的のみ。** コントリビューションは追加します — コアステージのフィールド、エージェント、
  散文を上書きしたり取り除いたりすることはできません。（上流の振る舞いを本当に_変える_必要が
  あるなら、それはフレームワークの設計判断であって、プラグインの関心事ではありません。）

## 関連

- [プラグイン機構](../reference/18-plugin-mechanism.md) — 規範となる設計: マニフェスト、
  合成モデル、コントリビューションの継ぎ目、インストール時の理由づけ、ハイブリッド配布モデル、
  マルチテナントのガード、そして実装状況（すべてがこの 1 章に集約されています）。
- [ステージの構造](01-anatomy-of-a-stage.md)、[スコープ](04-scopes.md)、
  [センサー](06-sensors.md) — プラグインが組み合わせる構成要素。
