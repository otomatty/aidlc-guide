# Business Logic Model — Unit: dashboard-ui

> functional-design (3.1) / Unit: dashboard-ui (kind: ui, L) / 2026-07-24
> 入力: unit-of-work.md U6 + unit-of-work-story-map.md（US-01/02/03/05/16/18）+ requirements.md（FR-4）+ components.md C6 + component-methods.md（API クライアント）+ services.md
> 注: UI ロジック（データ取得・状態遷移・導出）を記述。見た目の仕様は refined-mockups、コンポーネント詳細は frontend-components.md。

## データ取得フロー（段階的初回描画の UI 側）

```
起動:
  1. GET /api/workflow → { workflow, nextStep }（第1段）→ NowStrip + StageRail を即描画
  2. WS 接続 → 以降の push を購読
  3. GET /api/matrix → {building:true} なら matrix 領域を loading 表示のまま待つ
     WS {type:"matrix-ready", matrix} 受信で matrix を描画
  4. 以降 WS {type:"change", scope, ...} で該当領域のみ再描画
     - scope "state"        → workflow + nextStep 差し替え（NowStrip/rail/NextStepCallout）
     - scope "matrix:<unit>" → 該当 unit の行のみ差し替え
     - scope "audit"        → **本 Unit では消費しない**（監査表示コンポーネントは U6 の境界外 —
                              unit-of-work U6 / FR-4.x に監査表示要件なし。受信しても無視）
     - {type:"live-status", degraded} → LiveStatus 表示（ライブ性喪失の明示）
  5. WS 切断 → 自動再接続（指数バックオフ 1s→最大 10s）+ 再接続成功時は 1〜3 を再実行
     （サーバは状態を覚えない設計のため、再取得が唯一の復帰手段 — dashboard-server R-DS-3）

オンデマンド取得（起動フローとは別経路・初回描画の予算外）:
  6. ステージ選択時（selected.kind==="stage"）→ GET /api/stage/:slug → stageDoc slice に格納
     （選択毎に取得。取得済み slug は同一セッション内でメモ化 — docs は変化頻度が低い）
     取得中は DetailPanel が loading、失敗は同パネル内で局所エラー表示（全画面に影響しない）
  7. 起動後アイドル時（初回描画完了後）→ GET /api/links → projectLinks slice
     （Header のリンク欄用。初回描画のクリティカルパスに含めない — P-UI-2 の予算外）
```

## 5状態の判定ロジック（refined-mockups Q2 の実装）

```
領域ごとに derive:
  loading  : 該当データ未取得 かつ 200ms 経過（それ未満はスケルトンを出さない — ちらつき防止）
  empty    : workflow が no-active-intent（サーバが空ペイロード）→ EmptyState + IntentPicker
  error    : ReadResult 由来の unsupported / error が該当要素に付く → UnparseableBadge（局所）
  partial  : matrix セルに cell.error がある / warnings がある → 該当セルのみ縮退表示 + 全体は通常
  success  : 上記以外
```

**原則**: サーバから来た縮退情報（unsupported/error/warnings/cell.error）を**握り潰さず可視化**する。全画面エラーにしない（NFR-6 の UI 面）。

## 導出ロジック

| 導出 | 規則 |
|------|------|
| Now strip の表示項目 | workflow の phase/currentStage/depth/gate/done/total をそのまま（計算しない — 数え直しは reader の責務、G-5/G-6） |
| Stage rail の並び | workflow.stages の配列順（reader が state 記載順を保持）。フェーズ見出しでグルーピング |
| SKIP 折りたたみ | execution が SKIP の連続をまとめ、details 要素で理由（スコープ由来のSKIP）を表示 — FR-4.5 |
| NextStepCallout の表示条件 | 対象 StageCard が workflow.currentStage と一致するときのみ（US-02 / project.md 規約） |
| StatusChip | StageStatus（6値）+ "unparseable" → 色トークン・記号・ラベル の静的マップ（design-system-mapping の三重表現表 7行そのまま。`revising` は ◑ / revising） |
| 空セル vs 対象外セル（FR-4.3） | **`Matrix.cells` に当該 (unit, stage) の要素が存在しない = 対象外（—）**、`count === 0` で存在する = 空（·）。行×列の直積を UI が生成し、cells に無い交点を「対象外」と描く（reader は実在するセルのみ返す — MatrixCell に専用フラグを持たせない設計との整合） |

## エラーハンドリング（UI 境界）

- fetch 失敗（サーバ停止）→ 「サーバに接続できません（dashboard を起動してください）」+ 再試行ボタン。白画面にしない。
- 予期しないレスポンス形 → その領域のみ UnparseableBadge（React ErrorBoundary を領域単位で置き、全画面クラッシュを防ぐ）
