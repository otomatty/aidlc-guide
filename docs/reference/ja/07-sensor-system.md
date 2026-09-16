# センサーシステム

この章の具体的な `dist/claude/` パスは、`bun scripts/package.ts` が実体化するgitignore 対象のローカル生成物を指します。インストール先プロジェクトは `.claude/` の下の同じ相対パスを使います。

> 読者: Tier 2/3（チームで入れる人、フレームワークの貢献者）。

この章は AI-DLC センサーマニフェストの **スキーマリファレンス** です。ステージの出力への書き込みで発火する決定論的な検査です。センサーは制御ループのフィードバック側、ルールはフィードフォワード側です（次の章 [Rule System](08-rule-system.md)）。[Plane Architecture](02-plane-architecture.md) は両方を、コンパイルが各ステージノードへ解決するコントロールプレーン入力として枠付けます。

この章はマニフェストの *ファイル形式* をカバーします。センサーマニフェストの内容、ステージがセンサーを取り込む仕方、同梱の 6 つのマニフェストの設定。ワークフロー中にセンサーがどう発火するかの利用者向けの説明は、User Guide の [Rules and the Learning Loop](../guide/09-rules-and-the-learning-loop.md) です。

> **パスの慣例。** 以下の `<record>/` = アクティブなインテントのレコードディレクトリ、`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`（コンパクトな UTC 日付接頭辞 + 短い kebab-case ラベル。レコードディレクトリが時系列で並ぶ。正準 id は `intents.json` レジストリ行に保存した UUIDv7）。文書形センサー 2 つの同梱マニフェストの `matches` glob は、まだレガシーの成果物木パスを運びます（スキーマを文書化する箇所でそのまま引用）。

実行時の振る舞いは [Stage Protocol](04-stage-protocol.md) です。ステージ定義のファイル形式に関する対応する説明は [Stage Definition](15-stage-definition.md) です。

---

## マニフェストの場所とファイル名

センサーマニフェストは次に配置します。

```
dist/claude/.claude/sensors/aidlc-<id>.md
```

フレームワーク同梱のマニフェストはどれも `aidlc-` ファイル名接頭辞を運びます（より広いフレームワークファイル慣習に合わせる）。frontmatter の `id:` フィールドは、`aidlc-` 接頭辞を外し `.md` 接尾辞を剥いだファイル名ステムと一致しなければなりません。

| ファイル名 | 必須の `id:` |
|---|---|
| `aidlc-required-sections.md` | `required-sections` |
| `aidlc-linter.md` | `linter` |

ファイル名↔id 規則は `tests/unit/t86-sensor-manifest-schema.sh` が強制します。`aidlc-` 接頭辞は **カスタムの利用者が提供するものも含め、どのセンサーにも必須** です。コンパイルリゾルバは `SENSOR_FILE_REGEX = /^aidlc-([a-z][a-z0-9-]*)\.md$/`（`aidlc-graph.ts` の `loadSensors`）でマニフェストを発見するので、接頭辞が無いファイルは黙って飛ばされ、ステージに決して結びません。カスタムセンサーは `aidlc-<id>.md` と名付け、`id: <id>` をセットします。

---

## センサーマニフェストのスキーマ

どのマニフェストも YAML frontmatter と本文付きの Markdown です。frontmatter は構造契約 — 純粋な能力記述子 — で、本文は検査を説明する文章です。マニフェストは *センサーが何か* を言い、どのステージが使うかは言いません。関係はステージ側にあり、ステージの frontmatter `sensors:` フィールド経由です（後述の [ステージがセンサーを取り込む仕方](#ステージがセンサーを取り込む仕方)）。

```yaml
---
id: required-sections                       # required
kind: deterministic                          # required
command: aidlc engine sensor-required-sections   # required
default_severity: advisory                   # required
fire_on: gate                               # optional; write (default) | gate
description: Checks that stage output ...    # required
category: document-shape                     # optional
matches: "**/{aidlc-docs,intents}/**"                  # optional capability filter
input_schema:                                # optional
  output_path: string
  stage_slug: string
output_schema:                               # optional
  pass: boolean
  missing_headings: string[]
timeout_seconds: 5                           # optional
---

# required-sections sensor

<body — prose documenting default mode, override mode, failure mode>
```

| フィールド | 必須 | 型 | 注 |
|---|---|---|---|
| `id` | ✓ | kebab-case 文字列 | `aidlc-` 接頭辞を外したファイル名ステム。ルールファイルの `pairing:` フィールドから相互参照（[Rule System](08-rule-system.md)） |
| `kind` | ✓ | enum | 現在受け入れるのは `deterministic` のみ。`llm` は v0.11.0 LLM ディスパッチ章向けに予約。[`kind` enum](#kind-enum) |
| `command` | ✓ | 文字列 | 正準起動接頭辞。同梱センサーは `aidlc engine sensor-required-sections` のようなネイティブ委譲を使う。サードパーティセンサーは別の実行時を宣言してよい。センサーディスパッチャは `--stage <slug>` に加え、文書センサーは `--output-path <path>`、コードセンサーは `--file-path <path>` を足す |
| `default_severity` | ✓ | enum | `advisory` または `blocking`。blocking の強制は `fire_on: gate`。write 発火の blocking 宣言はこのリリースでは advisory のまま |
| `description` | ✓ | 文字列 | 人間向けの 1 行の説明 |
| `category` | 任意 | 文字列 | 自由形式の説明ラベル（同梱マニフェストは `document-provenance`、`document-shape`、`code-quality` を使う。閉じた enum ではない） |
| `fire_on` | 任意 | enum | `write` または `gate`。既定は `write` |
| `matches` | 任意 | glob 文字列 | ディスパッチ時に消費する能力フィルタ。[`matches` filter](#matches-フィルタ) |
| `input_schema` | 任意 | オブジェクト | 現在は advisory。将来の LLM ディスパッチがテンプレート契約として使う |
| `output_schema` | 任意 | オブジェクト | 現在は advisory。将来の LLM ディスパッチがパース契約として使う |
| `timeout_seconds` | 任意 | int | 発火ごとの実経過時間の上限 |

---

## `kind` enum

`kind` フィールドはディスパッチ仕組みを宣言します。スキーマが現在受け付ける値は 1 つだけです。

- `deterministic` — マニフェストの `command:` は自己完結のシェル起動で、終了 0（通過）/ 非ゼロ（失敗）し、既知パスへ構造化した詳細を書く。

`llm` は **LLM ディスパッチ章向けに予約**（v0.11.0+）。その章が提供されるまで、消費者はパース時に `kind: llm` を落とさなければなりません。予約は書き込み時に強制されます。現在 `kind: llm` マニフェストを提供するのは、パーサが落とすマニフェスト著者エラーです。

`kind` の未知の値（`deterministic` 以外）はパース時に落とされます。前方互換は *未知キー* に効きます（[Forward-compat policy](#前方互換方針)）。既知キーの未知値には効きません。

---

<a id="how-stages-import-sensors"></a>

## ステージがセンサーを取り込む仕方

ステージ側からの取り込み: 各ステージの frontmatter が使うセンサーを宣言します。コンパイルリゾルバは宣言した各 id をマニフェストレジストリで引き、コンパイル済みグラフノードへ `sensors_applicable` 配列を焼き込みます。執筆の向きは参照の局所性です。ステージファイルを開くと、ステージが実行されるときどの検査が発火するかが正確に見えます。

```yaml
# dist/claude/.claude/aidlc-common/stages/construction/code-generation.md
---
slug: code-generation
phase: construction
# ...
requires_stage: [...]
sensors:
  - linter
  - type-check
inputs: ...
outputs: ...
---
```

`sensors:` は裸の id の一覧です。id は各マニフェストの frontmatter `id:` フィールドと一致し、それは（ファイル名↔id 契約どおり）`aidlc-` 接頭辞を外したファイル名ステムです。コンパイルリゾルバは:

1. `dist/claude/.claude/sensors/` を歩き、どの `aidlc-<id>.md` マニフェストもパースする。
2. 解決時の O(1) 参照のためにマニフェストを id で索引する。
3. 各ステージについて、宣言した取り込み id をそれぞれ引き、未知なら投げる（実行時に黙って無視せず、コンパイル時に明示的に失敗）。
4. `fire_on`、`default_severity`、`category`、`matches` を解決した `sensors_applicable[]` 項目へコピーする。
5. ステージごとの解決配列を正準 `data/stage-graph.json` へ出す（FIELD_ORDER ピン: `rules_in_context` のあと）。

実行時の PostToolUse フック、`gate-start`、`revise` はグラフノードから `sensors_applicable` を読みます。どれもマニフェストを開き直しません。ディスパッチフィールドはコンパイル時スナップショットです。ワークフロー中のマニフェスト編集は、実行中のワークフローが発火するものを変えません（BGP 安定性 — [Plane Architecture](02-plane-architecture.md)）。

### ステージごとのセンサーマトリクス（フレームワーク33 ステージ）

| ステージ | `sensors:` |
|---|---|
| 初期化 3（workspace-scaffold、workspace-detection、state-init） | `[]`（決定論のセットアップ、エージェントが書いた markdown 無し） |
| `intent-capture` | `[claim-sources, required-sections, upstream-coverage]`（`claim-sources` は見えるインライン出自、正本のソース登録値、人の明示確認した仮定をステージの成果物横断で検査） |
| ほかの ideation 6、ほかの inception 6、operation markdown 7 | `[required-sections, upstream-coverage]` |
| `user-stories`、`domain-design`、`units-generation` | `[required-sections, upstream-coverage, traceability]` |
| `build-and-test` | `[required-sections, upstream-coverage, type-check]`（linter は意図して省略 — ビルドが正準 lint を走る） |
| `ci-pipeline` | `[required-sections, upstream-coverage, linter, type-check]` |
| Unit ごとの construction 設計 4（`functional-design`、`infrastructure-design`、`nfr-design`、`nfr-requirements`） | `[required-sections, upstream-coverage, linter, type-check, traceability]` |
| `code-generation` | `[linter, type-check, traceability]` |

フォークはステージの `sensors:` 一覧を直接直してステージを寄せます。結びは寄せるものの隣にあります。マニフェストは純粋な能力記述子です。ステージ指定のフィールドは持ちません（`applies_to:` は無し — ステージ側からの取り込みが外しました）。厳格加算のランタイムが効きます。フォークがステージにセンサーを欲しいなら取り込み、欲しくないなら省略します。推論する上書き層はありません。

---

<a id="matches-filter"></a>

## `matches` フィルタ

`matches` はマニフェスト上の任意のトップレベル能力記述子です。センサーが分析できるファイルの glob 形を宣言します — *「このセンサーはこの glob に一致するファイルを分析する」* — コンパイル時のリゾルバではなく、ディスパッチ時に消費されます。

| マニフェスト | `matches` |
|---|---|
| `aidlc-claim-sources.md` | `**/{aidlc-docs,intents}/**` |
| `aidlc-required-sections.md` | `**/{aidlc-docs,intents}/**` |
| `aidlc-upstream-coverage.md` | `**/{aidlc-docs,intents}/**` |
| `aidlc-traceability.md` | `**/traceability.json` |
| `aidlc-linter.md` | `**/*.{ts,js}` |
| `aidlc-type-check.md` | `**/*.{ts,tsx}` |

`fire_on: write` では、`matches` は発火フィルタです。フックは書かれているパスを glob と比べ、glob が無い項目は決して発火しません。`fire_on: gate` では、`gate-start` と `revise` が存在する宣言済み成果物を全部列挙し、各センサーの `matches` 能力の外のパスを飛ばし、一致するパスだけをディスパッチします。省略した glob はどの成果物も受け入れます。同梱 6 つはどれも glob を宣言します。コンパイルリゾルバはそれを `sensors_applicable[]` へコピーします。

空文字列（`matches: ""`）はパース時に落とされます。write 発火のセンサーは glob を宣言すべきです。gate 発火のセンサーは、宣言済み成果物全部を分析するために省略してよいです。

### ルールとセンサーの相互参照

ルールファイルはセンサーへフィードフォワードするために `pairing: aidlc-required-sections`（`aidlc-` 接頭辞付き）を使います。センサーマニフェストの `id:` は `required-sections`（接頭辞無し）です。doctor のカバレッジ検査は、マニフェスト `id` と合わせる前にルールの `pairing:` 値から `aidlc-` 接頭辞を剥いで正規化します。

---

## `default_severity`

`advisory` の結果は監査行を出しますが、ステージゲートを止めません。`blocking` のゲートに結び付いたセンサーは、検証済みの合格でのみ進みます。報告された所見、ディスパッチャの終了 / 起動 / タイムアウト失敗、壊れたまたは不一致の判定、`SENSOR_BUDGET_OVERRIDE`、`tool-unavailable` または `script-error` を運ぶ `SENSOR_PASSED` 行は、ゲートが開く前に `gate-start`、`revise`、または承認時の回復した改訂再入場を止めます。

運用者は所見を直して再試行するか、別の明示オーバーライド判断ができます。コンダクターは `Fix findings,Override blocking sensors` を出す `DECISION_RECORDED` を記録し、新しい人のターンを待ち、正確な `QUESTION_ANSWERED` を記録し、それから `--override-blocking-sensors --user-input "Override blocking sensors"` でゲート報告を再試行します。裸のフラグ、出していない / 言い換えた選択、人間の応答に裏付けられたレシートが無いこと、自律モードは拒まれます。成功したオーバーライドはセンサー id、任意の詳細パス、評価理由を `STAGE_AWAITING_APPROVAL` に記録します。すでに開いたゲートの再検証は `Revalidated: true` の新しい行を出し、認可レシートを再利用可能のまま残さず消費します。このリリースでは、write 発火のセンサーは `blocking` を宣言できますが、PostToolUse ディスパッチは advisory のままです。

---

## `fire_on`

`write` が既定で、増分の PostToolUse フィードバックを保ちます。`gate` は、`gate-start` が最初のゲートを開く直前、改訂仕事のあと `revise` がゲートに再入場する前、承認時の改訂バックストップが回復した再入場をする前に、存在する宣言済み成果物ごとに一度発火します。ディスパッチは状態トランザクションの外です。`aidlc-sensor.ts fire` が `SENSOR_FIRED` と終端行の両方の周りで監査ロックを取るからです。blocking ディスパッチは評価前に一致する各成果物をフィンガープリントし、各センサーのあとそれを検査し、状態トランザクション内でもう一度検査します。変わったバイトはゲート入場を拒み、再試行で評価しなければなりません。

ディスパッチャは終端行のあとコンパクトな JSON 判定を 1 つ印字します。`fire_id`、`sensor_id`、`stage`、`output_path`、`result`、`detail_path`、任意の `note`。ゲート強制は判定の識別情報を検証し、注無しの `passed` 結果以外を、blocking 結びの不合格として扱います。明示の `--artifacts` パスと発見した成果物は正準に解決され、ステージの正準 produce ディレクトリ内に残らなければなりません。絶対パス、走査、シンボリックリンク脱出はセンサーをリダイレクトできません。

---

## `command:` 起動契約

マニフェストの `command:` は **正準起動接頭辞** であり、完全な argv ではありません。同梱センサーはそれぞれ自分のセンサーごとのスクリプトを指名します。ディスパッチャ（`aidlc-sensor.ts`）は発火時に実行時文脈を足します。いつも `--stage <stage-slug>`、それからセンサーの入力形に合うファイルフラグ — 文書センサーは `--output-path <file>`、コードセンサー（`linter`、`type-check`）は `--file-path <file>`:

```
<command> --stage <stage-slug> --output-path <file-being-written>   # document sensor
<command> --stage <stage-slug> --file-path   <file-being-written>   # code sensor
```

だから次のマニフェスト:

```yaml
command: aidlc engine sensor-required-sections
```

が `requirements-analysis` に対して、インテントのレコードディレクトリ内の要件成果物を書いているときにディスパッチされると:

```
aidlc engine sensor-required-sections \
  --stage requirements-analysis \
  --output-path aidlc/spaces/default/intents/260624-inventory-api/inception/requirements-analysis/requirements.md
```

マニフェストは発火ごとのフラグを符号化しません。ディスパッチャが足します。マニフェストは純粋な能力記述子のままです。

---

## ゲート儀式の引き渡し（surface stdout / selections-file in）

§13 ラーニングゲートはツールが処理を担当します。決定論ツール（`aidlc-learnings.ts`）とコンダクター（実行中の `/aidlc` セッション）の往復は 2 段階で、あいだにナレッジ手順と判断手順があります。

1. **`surface`（stdout）。** `aidlc engine learnings surface --slug <stage-slug>` はステージの `memory.md` を読み、構造化した JSON を印字します。`candidates[]`（空でない Interpretation / Deviation / Tradeoff 項目ごとに 1 つ。それぞれ `id`、`source_heading`、`ts`、`summary`、`context`、`default_scope: "project"` を運ぶ）と、読み取り専用の `parked_open_questions[]`。AskUserQuestion フィールド名は無し。純粋な領域データ。Open questions は決して候補になりません（調査項目です）。
2. **コンダクターが AskUserQuestion を描く（ナレッジ）。** 候補ごとに選択肢 1 つ（ラベル = 候補 `summary` そのまま。説明 = 導出した行き先、例: `→ memory/project.md (Deviation)` とチームへ昇格する手段）。`multiSelect` のあと、コンダクターは残した各ラベルを候補 `id` + `source_heading` へ戻して対応付けます。それからいつも「次回のために足すことは？」と聞きます。自由文は見出し選び AUQ を 1 つ得ます（Interpretation / Deviation / Tradeoff / Open question）。見出し選びが利用者の唯一の分類で、行き先はそこから導きます。
3. **入場衝突検査（ナレッジ → オーケストレータ LLM。どの選択が persist に届くかをゲート）。** 残した各学びについて、コンダクターは提案した日付付き項目 1 つを `org.md` の一致する `## <section>` と比べます（§5 入場ゲートの一行変種）。矛盾があると、コンダクターは衝突する org の文をインラインで提示し、利用者は直す / 飛ばす / エスカレートします（判断 → 利用者。利用者上書きの道は無し）。衝突が無い、または利用者がエスカレートした選択だけが進みます。センサーマニフェストに org 見出しの類似は無く、検査を飛ばします。
4. **`persist`（selections-file in）。** コンダクターは残した選択を `<record>/.aidlc-engine/learnings/<slug>-selections.json`（インテントのレコードディレクトリ内）（gitignore）へ書き、`aidlc engine learnings persist --slug <slug> --selections-json <path>` を呼びます。ツールは決定論のライターです。衝突を判断しません。各学びをプラクティスとして `aidlc/spaces/<surface-time-space>/memory/{project,team}.md` へ経路し、センサー選択については2 ファイルへの書き込み（マニフェスト + 元ステージの `sensors:` frontmatter）を 1 つの `withAuditLock` 内で行い、それから `RULE_LEARNED` / `SENSOR_PROPOSED` を出します。

selections-file は再実行の成果物です。落ちた persist は人に再プロンプトせず同じ JSON を再実行します（書いた行ごとの `<!-- cid:<intent-slug>:<slug>:<content-hash> -->` マーカー経由の内容存在冪等 — 位置候補 id ではなく、学び自身のテキストの完全 SHA-256 ハッシュ）。selections-file は候補が提示されたときに一度結んだ `space` / `intent` も運びます。`persist` はそれらを使い、現在のアクティブインテントカーソル自身を再解決しません。書く前に、このスペースと非 null のインテントレコードがまだ存在すること、要求した slug が提示されたときの `stage_slug` と一致することを検証します。

---

## 新規作成するマニフェストの既定

センサー提案がゲートで確認されると、ゲート儀式ツールは新しい **プロジェクト層** マニフェストを `<project>/.claude/sensors/aidlc-<id>.md` に作成します。同梱のフレームワーク配布には決してしません（プロジェクトごとのラーニングループがフレームワークを変えてはいけない。フレームワーク配布パスは落とされる）。フィールドの既定:

| フィールド | 既定 | 注 |
|---|---|---|
| `id` | 利用者の自由文から導く（kebab-case にする） | |
| `kind` | `deterministic` | 現在唯一受け入れる値 |
| `command` | `bun ./plugins/acme/aidlc-sensor-<id>.ts` | サードパーティの Bun 裏付け例。プラグインはその実行時要件を宣言しなければならない |
| `default_severity` | `advisory` | 非ブロッキング既定 |
| `fire_on` | `write` | 増分の write ディスパッチ |
| `description` | 利用者の自由文から | |
| `category` | `""` | 利用者が欲しければ埋める |
| `matches` | 書き込みパス glob | 足場はセンサーが適用する glob 形を促す（成果物木 glob または `**/*.ts` のようなコード glob）。`matches` が無い write 発火項目は決して発火しない |
| `input_schema` | `{ output_path: string, stage_slug: string }` | ディスパッチャが足すフラグに一致 |
| `output_schema` | `{ pass: boolean }` | ディスパッチャが頼る最小構造 |
| `timeout_seconds` | `30` | 保守的な既定。遅いディスパッチャ向けに調える |

マニフェストを作成したあと、ゲート儀式ツールは — 同じ `withAuditLock` トランザクション内で — 新しい id を元ステージの `sensors:` frontmatter 一覧に足します（ステージ側からの取り込みの2 ファイルへの書き込み）。センサーは次のワークフローがコンパイルするとき完全に結ばれます。これが許される唯一のステージ frontmatter 編集です。取り込み一覧を伸ばします（形は不変、中身は不変ではない）。`## Steps` / `## Sensors` / `## Learn` 本文は決して直しません。

同梱の 6 つのマニフェストが、これらの既定があとで進化する変化を示します。`aidlc-claim-sources.md`、`aidlc-required-sections.md`、`aidlc-upstream-coverage.md` は `timeout_seconds: 5` と成果物木の `matches` glob（上の `matches` 表の値）を使います。`aidlc-linter.md` は `30` と `matches: "**/*.{ts,js}"`。`aidlc-type-check.md` は `60` と `matches: "**/*.{ts,tsx}"`。

---

<a id="forward-compat-policy"></a>

## 前方互換方針

センサーマニフェストの消費者（コンパイル、ディスパッチャ、ゲート儀式の足場、doctor）は **未知のマニフェストキー** を許さなければなりません。将来のリリースが任意の `cool_new_field:` を足しても、古い消費者はマニフェストをパースし、フィールドを無視し、続けます。これにより、フォークやアップグレード前のワークスペースを壊さずにスキーマの加算進化ができます。

前方互換は既知キーの未知値には効きません。上の [`kind` enum](#kind-enum) どおり、`kind` の未知値はパース時に落とされます。同じ原則がほかの enum 形フィールド（`default_severity`、`fire_on`）にも効きます。

---

## 将来のリリース向け予約

センサー能力のいくつかはスキーマに予約されていますが、まだアクティブではありません。着地するときフィールド形が安定するようにです。

- **`kind: llm` ディスパッチ** — LLM 評価センサー（v0.11.0）。スキーマは現在 `kind` を受け入れますが、パース時に `deterministic` 以外を落とします。
- **書き込み時 blocking** — write 発火マニフェストで `blocking` は受け入れますが、このリリースで強制されるのは gate 発火の失敗だけです。

どちらも書き込み時に強制されます。いまそれらを使うマニフェストを提供するのは、パーサが落とす著者エラーです。

## 次

- **ルール** — 制御ループのフィードフォワード側は `pairing:` フィールド経由でこれらのセンサーと対になります。[Rule System](08-rule-system.md)。
- **利用者が見るラーニングループ** — センサー提案がゲートでどう提示され確認されるか、確認した提案が新しいマニフェストをどう足場にするか。User Guide の [Rules and the Learning Loop](../guide/09-rules-and-the-learning-loop.md)。
- **コンパイル境界** — `sensors_applicable` がワークフロー開始時に一度解決され、発火時にグラフノードから読み取られる仕組み。[Plane Architecture](02-plane-architecture.md)。

上のスキーマと `dist/claude/.claude/sensors/` の同梱の 6 つのマニフェストが動く例です。
