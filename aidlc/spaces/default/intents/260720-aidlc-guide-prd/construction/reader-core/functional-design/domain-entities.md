# Domain Entities — Unit: reader-core

> functional-design (3.1) / Unit: reader-core / 2026-07-23
> 入力: component-methods.md（共通型）+ business-rules.md（文法・縮退規則）+ requirements.md FR-1
> これらの型は `packages/shared-types` に置かれ（Q2: 同梱）、全サーフェスが参照する。

## 型定義（shared-types）

```ts
type ReadResult<T> =
  | { ok: true; value: T; warnings?: string[] }
  | { unsupported: true; version: string }
  | { error: true; reason: string };

type StageStatus = "not-started" | "in-progress" | "awaiting-approval"
                 | "revising" | "completed" | "skipped";
type Phase = "INITIALIZATION" | "IDEATION" | "INCEPTION" | "CONSTRUCTION" | "OPERATION";
type Verdict = "READY" | "NOT-READY";

interface StageInfo {
  slug: string;
  phase: Phase;
  execution: "EXECUTE" | "SKIP";
  status: StageStatus;
  unparseable?: string;          // G-3 未知 mark 等の行級縮退
}

interface WorkflowModel {
  project: string;
  scope: string;
  depth: string;
  stateVersion: 7;
  phase: Phase;                  // Lifecycle Phase
  currentStage: string | null;
  nextStage: string | null;      // G-5 系: Current Status の Next Stage
  gate: StageStatus | null;      // 現在ステージの mark（[?] なら awaiting-approval）
  stages: StageInfo[];
  done: number;                  // G-5（フィールド優先、[x]+[S] 集計フォールバック）
  total: number;                 // G-6（Total Stages フィールド優先、EXECUTE 行数フォールバック、不一致は warnings）
  unparseable?: Record<string, string>;  // フィールド級縮退
}

interface NextStep {              // getNextStep() / FR-2.3 / US-02 NextStepCallout
  nextStage: string | null;      // null = ワークフロー完了
  requirement: string;           // そこで人間に求められること（ゲート種別/質問有無）
}

interface MatrixCell {
  unit: string;
  stage: string;
  count: number;
  verdict: Verdict | null;
  error?: string;                // 失敗モード④の局所縮退
}
interface Matrix { units: string[]; stages: string[]; cells: MatrixCell[]; }

interface AuditEvent {
  event: string;                 // Event フィールド（taxonomy 名）
  stage: string | null;
  timestamp: string;             // ISO 8601
  shard: string;                 // 由来シャードファイル名
}

interface IntentList {
  space: string;
  active: string | null;         // 失敗モード①: null
  all: string[];                 // 失敗モード②: 常時列挙
}

interface ChangeEvent {          // watch() 通知（変更）
  type: "change";
  scope: "state" | `matrix:${string}` | "audit";
  path: string;
}
interface WatchWarning {         // watch() 通知（ライブ性劣化 — R-RC-4）
  type: "watch-warning";
  reason: "watcher-lost" | "resubscribe-failed";
}
type WatchEvent = ChangeEvent | WatchWarning;  // cb は判別可能ユニオンを受ける（規約3と同型の設計）
```

## ライフサイクル / 関係

- 全型は**読取スナップショット**（イミュータブル）。watch の ChangeEvent を受けた消費者が再フェッチして新スナップショットを得る（差分適用はしない — 単純さ優先、593規模で再構築は軽い。性能規定は nfr へ）。
- `WorkflowModel.stages` と `Matrix.units` は独立に構築される（state の checkbox と FS 走査 — 不一致があり得るのは正常で、UI は双方をそのまま表示）。
- 本文（成果物・監査の全文）はどの型にも保持しない（BR-RC-6）。

## テスト対象境界（tb-lxp ゴールデン + ブランチ重視）

**公開ユーティリティ export**: `guardPath(recordDir, relPath): ReadResult<string>` — L6 の containment 純関数をパッケージの named export として公開する（dashboard-server の AnswerWriter・mcp-server の read_artifact が境界検査に再利用。nfr-design/logical-components.md `util/guard-path.ts`）。

**標準エラー reason 値**: `"state-missing" | "state-unreadable" | "no-active-intent" | "outside-record" | "artifact-not-found" | "file-too-large"`（消費者はこの文字列で UI 分岐する — 変更は破壊的変更）。

- parse: G-1〜G-6 の各分岐（正常 / Version≠7 / 欠落 / 未知mark / フィールド欠落 / total 不一致 warning）
- read-artifact: 3ベクタ拒否（`../` / 記録外絶対パス / symlink 脱出）+ startsWith 誤許可ケース（`/rec/foobar`）
- tree: 件数・verdict 抽出・セル級 error
- audit: マージ順序・シャード skip
- intents: cursor 4態（正常/不在/壊れ/宙吊り）
- watch: 一時ディレクトリでの変更→scope 分類（debounce はタイマーモック）
