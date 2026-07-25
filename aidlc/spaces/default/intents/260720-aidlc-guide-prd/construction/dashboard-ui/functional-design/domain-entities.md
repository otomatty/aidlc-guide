# Domain Entities — Unit: dashboard-ui

> functional-design (3.1) / Unit: dashboard-ui / 2026-07-24
> 入力: shared-types（WorkflowModel/Matrix/NextStep/WsMessage）+ business-logic-model.md

## UI 固有の型（サーバ由来型は shared-types をそのまま使用 — 再定義しない）

```ts
/** 領域ごとの表示状態（refined-mockups Q2 の5状態） */
type ViewState<T> =
  | { kind: "loading" }
  | { kind: "empty"; hint: string }
  | { kind: "error"; detail: string }               // unsupported/error の可視化
  | { kind: "partial"; value: T; notes: string[] }  // warnings/cell.error つき
  | { kind: "success"; value: T };

/** アプリ全体のストア（単一 store・領域別 slice） */
interface AppState {
  workflow: ViewState<WorkflowModel>;
  nextStep: ViewState<NextStep>;
  matrix: ViewState<Matrix>;
  selected: { kind: "stage"; slug: string }
          | { kind: "cell"; unit: string; stage: string }
          | null;
  stageDoc: Record<string, ViewState<StageDoc>>;   // slug → 解説（選択時にオンデマンド取得・メモ化）
  projectLinks: ViewState<ProjectLink[]>;          // Header のリンク欄（アイドル時取得）
  live: { connected: boolean; degraded: boolean; reason?: string };
  theme: "light" | "dark" | "system";
}
// StageDoc / ProjectLink は docs-bridge が定義し shared-types 経由で参照する
// （docs-bridge/functional-design/domain-entities.md）。本 Unit では再定義しない。

/** StatusChip の静的マップ（三重表現 — BR-UI-2） */
interface StatusPresentation { token: string; symbol: string; label: string; }
```

## ライフサイクル

- `AppState` は単一ストア（React context + useReducer で十分 — 外部状態管理ライブラリ不採用）。
- WS メッセージ → reducer アクション → 該当 slice のみ更新（領域再描画）。
- `selected` が DetailPanel の開閉を決める（null = 閉）。

## テスト境界

- stageDoc/projectLinks: オンデマンド取得の状態遷移（未取得→loading→success/error、同一 slug の再取得抑制）
- reducer: 各 WsMessage → 状態遷移（matrix-ready / change scope=state / change scope=matrix:<unit> / live-status）+ **scope=audit は無視されること**（本 Unit の境界外 — BLM 参照）
- ViewState 導出: 5状態の判定（loading 200ms 閾値はタイマーモック）
- StatusChip: **7状態**（StageStatus 6値 + unparseable）× 三重表現の存在（US-18 の自動検証。design-system-mapping の7行と1:1）
- NextStepCallout: 現在ステージのみ表示（US-02）
- UnitStageMatrix: 空セル（count=0）と対象外セル（cells に不在）の描き分け（FR-4.3 AC）
- a11y: RTL + role/label 検査（landmark・aria-current・フォーカス復帰）
