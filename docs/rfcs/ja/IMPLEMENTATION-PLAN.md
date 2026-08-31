# RFC 0001 実装計画 — 設計ステージの再構成

> レビュー用の作業計画。機能の作業とともにコミットするものではありません — このファイルは
> 実装の会話のための走り書きです。

## レビューで確定した決定

- **Q1**: contract-design は units-generation の直後に置く新しいステージ。
  delivery-planning はインセプションの締めくくりのまま。契約は delivery-planning へ
  畳み込み**ません**（関心事が異なります: 契約 = アーキテクトによるユニット間の
  API／イベント／スキーマの仕様、delivery-planning = デリバリーエージェントによる
  Bolt の順序付け／チーム配分）。
- **Q2**: 全面的な番号の振り直しで構いません。**番号を超えた影響**: ステージ番号は散文
  （ナレッジファイル、ステージの NOTE、stage-protocol の Bolt 用語集「stages 3.1–3.7」）にも
  現れます。それら散文の参照も更新が必要で、明示的な手順として追跡します。
- **Q3**: 最初のコミット = ブランチ作成 + RFC（html のみ。md は削除）。
- **Q4**: 各タスクは、4 つのハーネス（claude、kiro、kiro-ide、codex）すべてに対して
  完全なビルド（`bun scripts/package.ts`）と `--check` を実行します。
- **Q5**: `blueprint-shape` センサー — 完全実装。
- **Q6**: **選択肢 C**（議論の末に決定） — 所有するステージが安定した
  `cmp-NNN` / `ent-NNN` / `rule-NNN` の ID を生成し、下流のステージはそれらの ID を
  参照します（ファイルの再出力なし、リテラルの持ち回りなし）。`blueprint-shape` センサーが
  形状とステージ横断の ID 参照を検証します。ステージ本文には、ID を出力し上流の ID を
  参照するための軽い散文の更新を入れます — 持ち回りの全面書き直しでは**ありません**。
- **Q7**: タスクごとに push。

## 目標の番号（再構成後）

Inception:
```
2.6 domain-design        (was application-design — renamed)
2.7 units-generation     (unchanged)
2.8 contract-design      (NEW — CONDITIONAL, auto-skip single-unit)
2.9 delivery-planning    (was 2.8 — capstone, shifts +1)
```
Construction:
```
3.1 functional-design    (unchanged number, reworked outputs)
3.2 nfr-design           (was 3.3 — absorbs nfr-requirements; nfr-requirements 3.2 REMOVED)
3.3 infrastructure-design (was 3.4)
3.4 code-generation      (was 3.5)
3.5 build-and-test       (was 3.6)
3.6 ci-pipeline          (was 3.7)
```
差し引き: inception は 8→9 ステージ、construction は 7→6 ステージ、合計は **32** のまま。

## 先に依頼する権限（一度付与すれば、全タスクで使用）

1. `git checkout -b feature/v2-design-stage-rework v2`（v2 からブランチ作成）
2. `git rm docs/rfcs/0001-design-stage-rework.md`（md を削除し、html は残す）
3. `git add` + `git commit` — タスクごとに 1 回、タスク固有のメッセージで
4. `git push -u origin feature/v2-design-stage-rework`（最初の push）と
   `git push`（以後タスクごと）
5. `bun scripts/package.ts` と `bun scripts/package.ts --check`（タスクごと）
6. `bun test <file>` と `bash tests/run-tests.sh --smoke`/`--unit`（タスクごと）
7. `core/`、`harness/`、`tests/`、`docs/`、および生成される `dist/`（再生成してコミット）
   配下のファイルの編集・作成・削除

---

## タスク一覧

各タスクは 5 つの手順に従います: (1) 文脈を読んで理解する、(2) 実装する、
(3) テストケースを追加・更新する、(4) コンパイル + 全 dist のビルド + `--check`、
(5) 具体的なメッセージでコミットして push。

### タスク 0 — ブランチ + RFC
- **0.1** `v2` から `feature/v2-design-stage-rework` を作成。
- **0.2** RFC の Markdown を `git rm`。`0001-design-stage-rework.html` は残す。
- **テスト**: なし（ドキュメントのみ）。
- **ビルド**: なし。
- **コミット**: `chore: branch + RFC 0001 (html) for design-stage rework`。`-u` 付きで push。

### タスク 1 — application-design → domain-design のリネーム
- **文脈**: application-design.md、stage-graph.json の番号付け、生成される成果物
  （`components`、`component-methods`、`services`、`component-dependency`、`decisions`）の
  すべての消費者、そして散文の参照を読む。
- **実装**:
  - `core/aidlc-common/stages/inception/application-design.md` を
    `domain-design.md` へリネーム。フロントマターの `slug` と本文のタイトルを更新。
  - 出力を再概念化（選択肢 C）: `produces: [components, domain-design-questions]`。
    `components` 成果物は Markdown 中の YAML で、各コンポーネントが安定した
    `cmp-NNN` ID + 振る舞い + 依存 + 所有エンティティを持つ。
    component-methods / services / component-dependency / decisions の内容をそこへ
    畳み込む（コンポーネント = コードであってインフラではない。依存とコンポーネント。
    トポロジーの決定はしない）。v2 の手順スタイルを保ち、`cmp-NNN` の ID を割り当てる
    手順を追加する。
  - `stage-graph.json` に `domain-design` の行を事前シード（slug／番号／名前 2.6）し、
    `application-design` の行を削除する。
  - 削除された成果物名について、消費側の各ステージの `consumes[].artifact` を更新
    （functional-design、delivery-planning、infrastructure-design など）。
  - application-design を名指ししている散文の参照（ナレッジファイル、NOTE）を更新する。
  - ランナースキル `/aidlc-application-design` → `/aidlc-domain-design` をリネーム
    （runner-gen が再生成する — 追随することを確認）。
- **テスト**: t01（ステージ一覧／数）、t30 のスコープ対応、t32 のグラフ整合性、
  成果物語彙のテストがあればそれを更新。domain-design の存在テストを追加・調整する。
- **ビルド**: 完全な package + `--check`。
- **コミット**: `feat: rename application-design to domain-design (component model)`。

### タスク 2 — contract-design の追加（新規、inception 2.8）
- **文脈**: units-generation の出力（`unit-of-work`、`unit-of-work-dependency`）、
  delivery-planning（2.9 へずれる）、CONDITIONAL／スキップの仕組み、そして
  再構成ブランチの contract-design の定義を読む。
- **実装**:
  - 新規 `core/aidlc-common/stages/inception/contract-design.md`:
    `slug: contract-design`、`phase: inception`、`execution: CONDITIONAL`
    （条件: 単一ユニットのときスキップ）、`reviewer: aidlc-architecture-reviewer-agent`、
    `requires_stage: [units-generation]`、
    `produces: [contracts, contract-summary, contract-design-questions]`、
    `consumes: units-generation outputs + components/requirements`、
    `scopes: [enterprise, feature, mvp, classic, workshop]`。本文は v2 の手順スタイル。
  - delivery-planning を 2.8 → 2.9 へ振り直し、stage-graph.json に contract-design 2.8 を
    事前シードする。
  - `functional-design.requires_stage` へ `contract-design` を追加する。
- **テスト**: t01／t30／t32 の更新。contract-design の存在とスコープのテストを新設。
- **ビルド**: 完全な package + `--check`。
- **コミット**: `feat: add contract-design stage (inter-unit contracts, inception)`。

### タスク 3 — functional-design の出力の再構成
- **文脈**: functional-design.md、その消費者（nfr 系ステージ、code-generation）、
  再構成ブランチの functional-design を読む。
- **実装**（選択肢 C）: `produces` を
  `[entities, rules, api-specification, functional-spec, functional-design-questions]`
  へ変更（business-logic-model／business-rules／domain-entities／frontend-components を
  置き換え）。consumes へ `contracts` と `components` を追加。新しい成果物を説明するよう
  手順の散文を更新する（entities と rules は、自分が属する **`cmp-NNN` を参照**する
  安定した `ent-NNN` / `rule-NNN` の ID を持つ埋め込み YAML。提供側の api-specification、
  人間向けの functional-spec）。`sensors:` 一覧へ `blueprint-shape` を追加する
  （センサーは先行タスクで既に存在する）。
- **テスト**: t01／語彙の更新。functional-design の produces テスト。
- **ビルド**: 完全な package + `--check`。
- **コミット**: `feat: rework functional-design outputs (entities, rules, api spec)`。

### タスク 4 — nfr-requirements + nfr-design → nfr-design の統合
- **文脈**: 両方のステージファイル、それらの成果物のすべての消費者、散文の参照
  （「stages 3.1–3.7」、nfr-requirements への言及）を読む。
- **実装**:
  - `nfr-requirements.md` を削除。`nfr-design.md` を書き直して自己完結させる
    （解決済み O-5） — `produces: [nfr-specification, nfr-design-questions]`
    （5 つの要件成果物と 5 つの設計成果物を 1 つの仕様へ吸収）。`consumes` は
    nfr-requirements の成果物を落とし、requirements と functional-design を保つ。
    `requires_stage: [units-generation, functional-design]`。スコープは security-patch を
    含む和集合。欠けている NFR の目標値を引き出す質問の手順を追加する。
  - 番号の振り直し: stage-graph.json で nfr-design 3.3→3.2、
    infrastructure-design 3.4→3.3、code-generation 3.5→3.4、build-and-test 3.6→3.5、
    ci-pipeline 3.7→3.6（nfr-requirements 3.2 の行は削除）。
  - 散文の更新: stage-protocol の Bolt 用語集「stages 3.1–3.7」→「3.1–3.6」。
    nfr-requirements やステージ番号へのナレッジファイルの参照。
  - `/aidlc-nfr-requirements` ランナーの削除（ステージ削除に伴う）。
- **テスト**: t01（数／一覧）、t30、t32、語彙。nfr-design の統合後 produces テスト。
  古い「3.7」「nfr-requirements」に対する grep ガードのテストがあればそれも。
- **ビルド**: 完全な package + `--check`。
- **コミット**: `feat: merge nfr-requirements into nfr-design (self-sufficient)`。

### タスク 5 — infrastructure-design の出力の再構成
- **文脈**: infrastructure-design.md とその消費者、再構成ブランチ版を読む。
- **実装**（軽微）: `produces: [infrastructure-specification, infrastructure-design-questions]`
  （5 つのインフラ成果物を 1 つの仕様へ畳み込む）。`consumes` を
  `nfr-specification`（+ 任意で contracts／functional）へ更新。番号の振り直しは
  タスク 4 で処理済み。統合された仕様に合わせて手順の散文を更新する。
- **テスト**: t01／語彙。インフラの produces テスト。
- **ビルド**: 完全な package + `--check`。
- **コミット**: `feat: consolidate infrastructure-design to one specification`。

### タスク 6 — blueprint-shape センサー（完全）
- **文脈**: 既存のセンサーマニフェスト（`core/sensors/aidlc-*.md`）と、センサーの
  ディスパッチ／チェッカーモデル（`aidlc-sensor.ts`）、タスク 1／3 の埋め込み YAML の
  成果物の形を読む。
- **実装**:
  - 新規 `core/sensors/aidlc-blueprint-shape.md` マニフェスト（blueprint 系成果物の
    能力グロブ）。
  - 完全なチェッカーのロジック。検査は 2 つ: (1) **形状** — components／entities／rules の
    ```yaml フェンスブロックが必要なキーを持つこと。(2) **ID 参照** —
    entities／rules／nfr-specification／infrastructure-specification／contracts が
    参照するすべての `cmp-NNN` が、上流の `components` 成果物のコンポーネントへ
    解決されること（孤立 → 該当 ID を伴う SENSOR_FAILED）。
  - 同じタスクの中で、domain-design（この時点で存在する）の `sensors:` フロントマターへ
    配線する。以後のステージは、再構成される際に追加する（T4／T5／T6）。
- **テスト**: 専用のセンサーユニットテスト（妥当なものは通る。不正な形状は落ちる。
  孤立した `cmp-NNN` 参照は、正しい SENSOR_FAILED の詳細とともに落ちる）。
- **ビルド**: 完全な package + `--check`。
- **コミット**: `feat: add blueprint-shape sensor (shape + cmp-NNN ID references)`。

### タスク 7 — ドキュメント + スコープ表 + changelog／バージョン
- **文脈**: ステージ／フェーズ／スコープを説明するドキュメント
  （`docs/reference/04-stages/*`、`docs/guide/03-phases-and-stages.md`、
  成果物語彙、用語集）、README／SKILL のスコープ表。
- **実装**: リネーム・新設・統合されたステージについてステージのドキュメントを更新。
  スコープ表を再生成。バージョンを上げ、破壊的変更のアップグレード注記を含む
  CHANGELOG のエントリを書く。
- **テスト**: バージョンと changelog の同期（t68）。ドキュメント参照のガードがあればそれも。
- **ビルド**: 完全な package + `--check`。
- **コミット**: `docs: update stage docs, scope table, changelog for design rework`。

---

## 順序（決定済み）

`aidlc-graph compile` は未知のセンサー ID で例外を投げるため、`blueprint-shape` の
センサーマニフェストは、いずれかのステージのフロントマターがそれを参照する**前に**
存在していなければなりません。
**タスク順: 0 → 1 → 2 → 6(sensor) → 3 → 4 → 5 → 7。**（すべてのタスクのビルドが green の
ままになるよう、センサーのタスクを functional-design の再構成より前へ移しています。）

振り直し後のタスクの並び:
1. **T0** — ブランチ + RFC（html。md は削除）
2. **T1** — application-design → domain-design のリネーム（`cmp-NNN` を出力）
3. **T2** — contract-design の追加（2.8）。delivery-planning を 2.9 へずらす
4. **T3**（旧 T6） — `blueprint-shape` センサー（完全: 形状 + ID 参照）
5. **T4**（旧 T3） — functional-design の再構成（`ent-NNN` / `rule-NNN` を出力し `cmp-NNN` を参照。センサーを配線）
6. **T5**（旧 T4） — nfr-requirements → nfr-design の統合。construction の番号振り直し
7. **T6**（旧 T5） — infrastructure-design の統合
8. **T7** — ドキュメント + スコープ表 + changelog／バージョン

## 着手前の未確認事項

- **C-1**: contract-design を独立した 2.8 のステージとする（delivery-planning へは
  統合し**ない**）。_（議論で確認済み — 分離のまま。）_
- **C-2**: コンパイルが green のままになるよう、センサーのタスクを functional-design の
  再構成より前へ移す。_（解決済み — 上の「順序」を参照。）_
- **C-3**: 各タスクの一部として、固定されたテストの件数（t01／t30／t32／語彙）を
  更新してよいか。以前の 11→13 のエージェント修正と同じパターン。_（確認が必要。）_
