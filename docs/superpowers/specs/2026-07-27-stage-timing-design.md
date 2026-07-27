# ステージ所要時間の可視化と見積り — 設計

- 日付: 2026-07-27
- 対象: `reader-core` / `api-core` / `dashboard` / `vscode-extension`
- 状態: 承認済み（ブレインストーミング完了）

## 目的

aidlc-workflows のステージがどのくらい時間を要するかを、VS Code 拡張から把握できるようにする。具体的には次の2つに答える。

1. 現在実行中のステージが、いま何分経過していて、あとどのくらいかかりそうか
2. これから実行する各ステージが、どのくらいの所要量を要求するか（およびワークフローの残り総量）

## 前提と制約

- aidlc ワークスペース（`aidlc/spaces/**`）および監査ログへの**書き込みは禁止**（NFR-1 / C-T2）。aidlc-workflows コア（エンジン、ステージ定義、監査ログ形式）の変更も禁止。
- したがって新たな計測イベントを監査ログに追加することはしない。
- reader-core は UI / トランスポート非依存（team.md 構造規約1）。パース境界は `ReadResult` の判別可能ユニオンを返し throw しない（同規約3）。

## 採用した方針: 導出のみ、永続化レイヤーなし

監査ログは既に git 管理された永続記録であり、intent ごとに全ステージの開始・終了時刻を保持している。よって**新たな記録層は作らない**。読むたびに監査ログから算出する。

根拠となる実測: 3,395 イベント / 33,345 行のフルパースが **12–48ms**。NFR-2 の「起動→初回表示 3秒」に対して誤差である。intent が増えても `intents.json` から列挙して各 audit を読むだけで、約 15ms/intent。

この方針の副次的な利点として、**導入初日に過去21ステージ分の実績が遡って埋まる**。キャッシュ方式では未来の分しか蓄積されない。

却下した案:

- **globalStorage への rollup 永続化** — 40 intent で 0.6s を節約するために、キャッシュ無効化・スキーマ移行・削除済み intent の掃除という3つの状態管理を抱える。監査ログが真実であるにもかかわらずキャッシュがずれる不整合を自前で作ることになる。intent が数百規模に達したときに、純関数である `getStageTimings` の外側へ後付けできる。
- **拡張によるリアルタイム自前計測** — サブエージェント単位の粒度が必要な場合にのみ意味を持つ。監査ログに `SUBAGENT_STARTED` 相当のイベントが存在しない（`SUBAGENT_COMPLETED` のみ）ため、拡張が起動していた区間しか埋まらず履歴がまだらになる。今回のスコープ（ステージ単位 + 残り時間）では不要。

## データモデル

`shared-types` に追加する。

```ts
export interface StageTiming {
  stage: string;
  /** ISO 8601, STAGE_STARTED の Timestamp。 */
  startedAt: string;
  /** null = 実行中。 */
  endedAt: string | null;
  /** (endedAt ?? now) - startedAt。 */
  wallMs: number;
  /** アイドル控除後の実作業推定。 */
  activeMs: number;
  /** 区間内の監査イベント数。見積りの信頼度指標。 */
  eventCount: number;
}

export interface StageEstimate {
  stage: string;
  estimateMs: number | null;
  /** [min, max]。sampleCount >= 2 のときのみ。 */
  rangeMs: [number, number] | null;
  sampleCount: number;
  basis: "stage" | "phase" | "global" | "none";
}

export interface RemainingEstimate {
  currentStage: {
    stage: string;
    elapsedActiveMs: number;
    remainingMs: number | null;
  } | null;
  /** WorkflowModel.stages のうち EXECUTE かつ未完了のもの。 */
  pendingStages: StageEstimate[];
  /** 現在ステージの残り + pendingStages の合計。 */
  totalRemainingMs: number | null;
  /** basis !== "stage" を含む、または sampleCount < 2。 */
  lowConfidence: boolean;
}
```

## 導出規則

全監査イベントを時刻昇順に走査し、`STAGE_STARTED` で区間を開き、同名の `STAGE_COMPLETED` で閉じる。未クローズの区間が「実行中」。

### activeMs — アイドル控除

`activeMs = Σ min(隣接イベント間隔, IDLE_THRESHOLD)`、`IDLE_THRESHOLD = 10分`。

各間隔を閾値で**頭打ちにする**のであって、閾値超の間隔を捨てるのではない。実測比較:

| stage | wall | 捨てる | 頭打ち | イベント数 |
|---|---|---|---|---|
| nfr-requirements | 26m | 1m | 21m | 9 |
| scope-definition | 12h47m | 18m | 1h18m | 100 |
| code-generation | 9h03m | 7h07m | 8h07m | 1201 |

`nfr-requirements` は 26 分を要しているのに監査イベントが 9 件しかない。これは LLM が無音で生成している区間であり、「捨てる」ルールでは 1 分に潰れて、最も知りたい生成時間が消える。頭打ちなら誤差の上限が 1 間隔あたり閾値で抑えられる。

既知の天井（コードにコメントとして明記する）:

- 10 分未満で戻ってきた人間の離席は作業時間に混入する
- 10 分を超える無音生成は 10 分に切り詰められる（`code-generation` の 8h07m は真値より短い可能性が高い）
- `eventCount` が少ない区間は推定が粗い。UI 側で参考値として区別する

### 決定性

`getStageTimings(recordDir, now)` として **`now` を引数で注入**する。実行中ステージの `wallMs` は `now` に依存するため、注入なしではゴールデンテストが再現しない。

### 異常系

すべて `ReadResult` で返し、throw しない。

| 状況 | 扱い |
|---|---|
| 同名ステージの `STAGE_STARTED` が二度（リトライ / 差し戻し） | 前の区間を中断として破棄し warning に記録 |
| シャード間のクロックずれで区間が負 | 0 に丸めて warning |
| `STAGE_COMPLETED` に対応する `STARTED` が無い | 無視して warning |
| audit ディレクトリ無し | 空配列（既存 `readAuditEvents` の挙動を踏襲） |

## 見積りアルゴリズム

サンプル母集団は、同一 space の全 intent の完了区間（`endedAt !== null`）の `activeMs`。ステージ名でグループ化する。

**中央値**を用いる。実測の分散が 13 分〜8 時間あり、`functional-design` のような外れ値 1 件が平均を壊すため。要素数が偶数のときは両中央値の平均とする（ms 単位のため端数は問題にならない）。n=1 のときは中央値＝その実績値。

フォールバック階段:

1. 同一ステージの実績（`basis: "stage"`）
2. 同フェーズの中央値（`basis: "phase"`）
3. 全体中央値（`basis: "global"`）
4. 何もなければ `null`（`basis: "none"`）

現在のプロジェクトでは ideation〜construction の 21 ステージに実績があり、operation フェーズ（`deployment-*`, `observability-setup` 等）は未実行のため phase フォールバックが効く。

残り時間は `pendingStages`（EXECUTE かつ未完了）の見積り合計に、現在ステージの残り `max(0, estimate - elapsedActiveMs)` を加えたもの。SKIP 行と完了済み行は除外する。

### 完了時刻は提示しない

「完了見込み 18:30」のような**壁時計の時刻は出さない**。壁時計の完了時刻は「人間がいつ席に着くか」で決まり、実測でも `feasibility` は壁時計 6h38m に対し実作業 51m だった。予測不能な数字を予定として提示すると信頼を失う。表示は一貫して「残り実作業 ≈ 3h20m」という**所要量**とする。

## サーフェス

### reader-core

新規 `src/timing/stage-timings.ts`:

```ts
/** 1 intent 分。I/O あり。 */
getStageTimings(recordDir: string, now: number): Promise<ReadResult<StageTiming[]>>
/** space 内の全 intent を列挙し、各レコードの結果を連結する。I/O あり。 */
getStageTimingSamples(rootPath: string, now: number): Promise<ReadResult<StageTiming[]>>
/** 純関数。samples は getStageTimingSamples の結果。 */
estimateRemaining(samples: StageTiming[], workflow: WorkflowModel): RemainingEstimate
```

`getStageTimingSamples` は既存の `resolveIntents(rootPath)` で intent を列挙する（`intents` ディレクトリの readdir）。読めない intent は warning に記録して読み飛ばし、残りのサンプルで見積りを継続する（audit シャードの既存の縮退方針と同じ）。

既存の `readAuditEvents` は `limit` で新しい順に切るため timing には使えない。**パーサを複製せず**、既存ファイル内のパースループを内部関数 `readAllAuditEvents` に切り出し、`readAuditEvents` はその結果を slice するだけにする。監査ログのパース箇所は 1 つのままに保つ。

必要なフィールド（`event` / `stage` / `timestamp`）は既存の `AuditEvent` に揃っているため、型の追加は不要。

### api-core

新エンドポイント `GET /api/timings` → `{ timings: StageTiming[], remaining: RemainingEstimate }`。

既存の `/api/workflow` には**載せない**。ADR-03 の段階的初回描画に従い、初回表示のクリティカルパス（NFR-2 の 3 秒）に全監査ログ走査を入れないため。

WS には**新しい push 種別を追加しない**。監査ログ更新時に既存の `{ type: "change", scope: "audit" }` が飛ぶので、クライアントはそれを受けて `/api/timings` を再取得する。timings は audit の従属関数であり、push を増やすと同じ事実を 2 経路で流すことになる。

### dashboard

| 場所 | 追加内容 |
|---|---|
| `NowStrip` | 現在ステージ行に `経過 2h10m · 残り ≈ 45m` |
| `StageRail` | 完了行に実績、未着手行に見積り |
| ヘッダ | `残り実作業 ≈ 3h20m` |

推定値は `≈` 記号 + 「推定」テキストで示し、**色だけに依存させない**（project.md rough-mockups の学習に準拠）。`basis !== "stage"` または `sampleCount < 2` を低信頼として区別する。

### vscode-extension

`status-bar.ts` は既に 30 秒間隔で `currentStage` を更新している。そこに経過と残りを足す:

```
$(list-tree) code-generation · 2h10m / ≈45m
```

ダッシュボードを開かずに「今どのくらいかかっているか」が見えるため、当初の要望に対して最も効くサーフェス。

## テスト

team.md のテストポスチャに従い、reader-core（パーサ / リーダ層）は branch coverage を重視する。ランナーは Vitest。

### 導出の単体（合成イベント列、純関数）

- 正常ペア / 未クローズ（実行中）/ 重複 `STARTED`（前区間破棄 + warning）/ `COMPLETED` 単独（warning）/ 時刻逆転（0 丸め + warning）/ 空 audit / audit ディレクトリ無し
- `activeMs` の頭打ちは **gap < 閾値 / gap == 閾値 / gap > 閾値** の 3 分岐を明示的に突く
- 区間内イベントが 1 件のみ → `activeMs` は 0

### 見積りの単体

- n=1 → `estimateMs` = その実績、`rangeMs: null`、`basis: "stage"`
- n が偶数のときの中央値が両中央値の平均であること
- ステージ実績なし → phase フォールバック → global → `basis: "none"` で `null`
- SKIP 行と完了済み行が `pendingStages` から除外されること
- `elapsed > estimate` のとき `remainingMs` が負にならず 0 になること

### ゴールデン

実レコード `260720-aidlc-guide-prd` に対する 21 区間の算出結果をスナップショットで固定する。監査ログは read-only であり、書き換えずに読むだけ。

### UI

`@testing-library/react` で `NowStrip` / `StageRail` が低信頼を `≈` + テキストで表示することを検証する（色に依存しない検証）。

### 性能

フルパースを min / p50 / p95 / max で、cold と warm を分けて記録する（project.md performance-validation の学習に準拠）。実測済みの 12–48ms を基準線とする。

## 失敗モード

いずれも他の表示を巻き込まずに縮退する。

| 状況 | 挙動 |
|---|---|
| 監査ログが壊れている | timings 空 + warning。Dashboard の他要素は通常表示を継続 |
| サンプル 0 件 | 見積り欄は「実績なし」、経過時間のみ表示 |
| State Version が非対応 | 既存の unsupported 表示に従い timing も出さない |
| 現在ステージが未検出 | 履歴の実績表示のみ、残り時間は非表示 |

## スコープ外

- サブエージェント 1 回 / 成果物 1 件といったステージ内の粒度（監査ログに開始イベントが無い）
- 壁時計での完了予定時刻の提示
- 拡張ストレージへの実績の永続化
- 複数リポジトリ横断での集計
