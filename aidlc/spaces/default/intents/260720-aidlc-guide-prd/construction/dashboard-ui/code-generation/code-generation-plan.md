# Code Generation Plan — Unit: dashboard-ui

> code-generation (3.5) / Unit: dashboard-ui (kind: ui, L) / 2026-07-25
> 入力: functional-design 4文書 + nfr-requirements 5文書 + nfr-design 5文書
> + refined-mockups（mockups.md M-1/M-2a/M-4・interaction-spec.md C-1〜C-4・
> design-system-mapping.md・accessibility-checklist.md）+ team.md / project.md

## スコープ

`packages/dashboard/` — Vite + React + TypeScript の SPA。dashboard-server が
`dist/` を配信する。データは同一オリジンの `/api` (GET) と `/ws` のみ。
**read-only サーフェス**（書込 UI は artifact-viewer Unit の責務 — BR-UI-7 / S-UI-1）。

依存: `@aidlc-guide/shared-types`（型のみ）+ react / react-dom +
Radix の FocusScope / DismissableLayer / Select の3プリミティブのみ。
**`reader-core` を依存に入れない**（BR-UI-1 / S-UI-2 — 構造的禁止）。

## チェックリスト

### パッケージ基盤

- [x] `packages/dashboard/package.json` — 依存は shared-types + react/react-dom +
      Radix 3件のみ（reader-core / docs-bridge / dashboard-server を含まない）
- [x] `tsconfig.json` — `lib: DOM`, `jsx: react-jsx`, `types: ["vite/client"]`。
      ルート tsconfig は本パッケージを exclude し、`check` が別 pass で型検査
- [x] `vite.config.ts` — ハッシュ付きアセット名（`assets/[name]-[hash]`）を明示。
      dashboard-server の `HASHED` 判定（immutable キャッシュ）と整合
- [x] ルート `package.json` に `build:dashboard`（vite build）と
      `dashboard`（build → serve）を追加。`check` に dashboard の tsc pass を追加
- [x] `vitest.config.ts` を projects 化（node = 既存全パッケージ / dashboard = jsdom）

### `src/main.tsx` — bootstrap（P-UI-2）

- [x] React マウント**前**にモジュール本体で `fetchWorkflow()` を発火し、promise を App に渡す
- [x] `#root` 不在は明示 throw（黙って白画面にしない）

### `src/store/` — 単一ストア・領域 slice

- [x] `state.ts` — `ViewState<T>` 5状態 / `AppState`（stageDoc・projectLinks slice 含む）
- [x] `context.tsx` — context + useReducer。state と dispatch を別 context に分離（P-UI-3）
- [x] `deriveViewState.ts` — ペイロード→ViewState の**唯一の漏斗**（R-UI-2）
- [x] `no-active-intent` → `empty` / `unsupported` → `error`（version を文言に出す）
- [x] `warnings` と値内部の縮退（`unparseable` / `cell.error`）で `success`→`partial` に降格
- [x] `reducer.ts` — WsMessage → slice 更新
- [x] `matrix-ready` → matrix slice
- [x] `change scope="state"` → workflow + nextStep のみ差し替え（matrix は同一参照を保持）
- [x] `change scope="matrix:<unit>"` → 当該 unit の行のみ差し替え
- [x] `change scope="audit"` → **明示 case で無視**（default 節ではない — SC-UI-3）
- [x] `live-status` → live slice（degraded + reason）

### `src/services/`

- [x] `api.ts` — GET のみ。**POST 関数を1つも持たない**（S-UI-1）
- [x] `/api/workflow` の裸ボディを `ReadResult` に持ち上げ、warnings を保持
- [x] `/api/matrix` の `{building:true}` を判別
- [x] fetch 例外 → `{error:true, reason:"server-unreachable"}`（白画面禁止 — R-UI-3）
- [x] `refetchAll()` は起動フロー1〜3のみ（オンデマンド取得は再実行しない）
- [x] `live.ts` — `useLiveConnection`: WS + 指数バックオフ 1s/2s/4s/8s/10s、
      open で `refetchAll()`、unmount で停止。**送信経路なし**（S-DS-6 と対）
- [x] `docs.ts` — 選択時に stage doc 取得（slug メモ化 = stageDoc slice 自体）、
      アイドル時に links 取得（requestIdleCallback / setTimeout フォールバック）
- [x] deep-link 生成 `safeHref()` — http(s) と相対パスのみ。他スキーム・
      protocol-relative は null（S-UI-4）

### `src/components/`

- [x] `StatusChip` — 7状態（`revising` 含む）× 色トークン + 記号 + ラベルの**三重**
      （design-system-mapping の7行と1:1 — BR-UI-2 / US-18）
- [x] `StatusLegend` — 同じマップから生成（凡例のドリフト不能）+ 空(·) / 対象外(—)
- [x] `NowStrip` — phase / currentStage / depth / gate / done・total を**そのまま**表示
      （BR-UI-3 数え直さない）。region + h2、empty→EmptyState、error→AreaError
- [x] `StageRail` — フェーズ見出しでグルーピング（サーバ配列順を保持 — R-UI-6）、
      roving tabindex（tabIndex=0 は常に1つ）、↑↓←→/Home/End、`aria-current="step"`
- [x] `SkipGroup` — 連続 SKIP を `<details>` に集約 + 理由（FR-4.5）
- [x] `UnitStageMatrix` — units × stages の直積を描画。**cells に不在 = 対象外(—)**、
      `count===0` = 空(·)。`<table>` + th scope、`overflow-x:auto` は自身が持つ
- [x] 行単位 memo（`matrix:<unit>` push で他行を再描画しない — P-UI-4）
- [x] `React.lazy` で matrix を分割チャンク化（P-UI-1）
- [x] `DetailPanel` — 非モーダル。FocusScope `trapped={false}` + DismissableLayer、
      開時に h2 へフォーカス、Esc / 外側クリックで閉じてトリガへ復帰、
      **`aria-modal` なし・トラップなし**
- [x] `StageCard` — 4フィールド（目的 / 入力 / 出力 / 担当 / ゲート要求）+ docs deep-link
- [x] `NextStepCallout` — **現在ステージのカードのときのみ**レンダリング（US-02）
- [x] `AreaBoundary` — 領域単位 ErrorBoundary（NowStrip / rail / matrix / panel）+
      App 直下の二段構え（R-UI-1）
- [x] `EmptyState`（role=alert）/ `UnparseableBadge`（role=status）/ `LiveStatus`
      （role=status + aria-live=polite）/ `Skeleton`（role=status + aria-busy）
- [x] `IntentPicker`（Radix Select）/ `ThemeToggle`（aria-pressed + data-theme）
- [x] `data-testid` を主要操作要素に付与（rail item / matrix cell / theme toggle /
      intent picker / panel close / retry）

### `src/hooks/` / `src/styles/`

- [x] `useDelayedLoading.ts` — 200ms 閾値を一元化（P-UI-5）
- [x] `tokens.css` — 意味的トークン（7状態色 + `--color-status-revising` を含む）。
      `:root` ライト / `prefers-color-scheme: dark` / `[data-theme]` の両方向上書き
- [x] `app.css` — トークン参照のみ（生 hex をコンポーネントに書かない）、
      `prefers-reduced-motion: reduce` でパネルのアニメーション無効

### テスト（Vitest + @testing-library/react / jsdom）

- [x] `reducer.test.ts` — 各 WsMessage → 該当 slice。**audit が無視される**こと
- [x] `derive-view-state.test.tsx` — 5状態全て + 縮退の可視化 + 200ms 閾値（fake timers）
- [x] `components.test.tsx` — StatusChip 7状態の三重表現 / NextStepCallout の表示条件 /
      StageCard 4フィールド / matrix の空 vs 対象外 / StageRail の SKIP・roving tabindex
- [x] `detail-panel.test.tsx` — h2 へのフォーカス移動、Esc でのフォーカス復帰、
      トラップ不在、`aria-modal` 不在
- [x] `live.test.tsx` — バックオフ表と実タイマー挙動、open での refetchAll、
      不正フレームの握り潰し、unmount 停止
- [x] `services.test.tsx` — API クライアント全分岐 / safeHref / slug メモ化
- [x] `app.test.tsx` — bootstrap を再取得しないこと、landmark・`aria-current=step`、
      LiveStatus の role/aria-live、AreaBoundary の領域隔離
- [x] `header.test.tsx` — links のアイドル取得と安全な href、read-only バッジ
- [x] `dependency-direction.test.ts` — reader-core / node builtin 非 import、
      依存リスト固定、**POST 系メソッド名ゼロ**、`dangerouslySetInnerHTML` ゼロ、
      fetch は `services/api.ts` のみ

## トレーサビリティ

| US / FR | 実装 | テスト |
|---------|------|--------|
| US-01 / FR-4.1 | `NowStrip`（phase/stage/depth/gate/done・total） | `app.test.tsx` NowStrip states |
| US-02 / FR-4.6 | `NextStepCallout`（現在ステージ限定・独立区画） | `components.test.tsx` / `detail-panel.test.tsx` |
| US-03 / FR-4.4 | `StageCard` 4フィールド + deep-link | `components.test.tsx` StageCard |
| US-05 / FR-4.3 | `UnitStageMatrix`（空 vs 対象外） | `components.test.tsx` UnitStageMatrix |
| US-16 / FR-4.2, 4.5 | `StageRail` + `SkipGroup` | `components.test.tsx` StageRail |
| US-18 | `StatusChip` 三重表現 7状態 | `components.test.tsx` StatusChip |
| US-11（M-3 差分） | `ReadOnlyBadge`（hostMode 時のみ） | `header.test.tsx` |
| US-15 / NFR-6 | `deriveViewState` + `UnparseableBadge` + `AreaBoundary` | `derive-view-state.test.tsx` / `app.test.tsx` |
