# Logical Components — Unit: dashboard-ui

> nfr-design (3.3) / Unit: dashboard-ui / 2026-07-24
> 入力: functional-design 4文書 + 本ステージ設計文書

## モジュール構成（packages/dashboard/src/）

| モジュール | 責務 | 依存 |
|-----------|------|------|
| `main.tsx` | bootstrap: `/api/workflow` の先行 fetch → React マウント（P-UI-2） | app |
| `app/App.tsx` | ThemeProvider + StoreProvider + 4領域の AreaBoundary 配置 | store, components |
| `store/reducer.ts` | AppState の reducer（WsMessage → slice 更新。audit は明示無視） | shared-types |
| `store/deriveViewState.ts` | ペイロード → ViewState（5状態。縮退を必ず反映 — R-UI-2） | shared-types |
| `services/api.ts` | GET クライアント（POST を持たない — S-UI-1）: workflow / matrix / **stage(:slug) / links** + `refetchAll()`（起動フロー 1〜3 のみ再実行） | — |
| `services/docs.ts` | オンデマンド取得の制御（選択時に stage doc を取得・slug メモ化、アイドル時に links 取得 — BLM 手順6/7）。deep-link URL 生成も担当（S-UI-4: docPath/docAnchor と projectLinks のみを解決） | services/api, store |
| `services/live.ts` | `useLiveConnection`（WS + 指数バックオフ + open で refetchAll） | services/api |
| `components/*` | frontend-components.md の各コンポーネント（NowStrip/StageRail/UnitStageMatrix/DetailPanel/StageCard/NextStepCallout/StatusChip/…） | store |
| `components/AreaBoundary.tsx` | 領域単位 ErrorBoundary（R-UI-1） | — |
| `hooks/useDelayedLoading.ts` | 200ms 閾値（P-UI-5） | — |
| `styles/tokens.css` | 意味的トークン + light/dark（design-system-mapping。7状態色を含む） | — |

## データフロー

```
main.tsx（先行 fetch）→ App → StoreProvider
   ├ services/api（GET /api/workflow, /api/matrix ← 起動フロー）
   ├ services/docs（GET /api/stage/:slug ← 選択時 / GET /api/links ← アイドル時。初回描画の予算外）
   ├ services/live（WS）→ reducer（matrix-ready / change:state / change:matrix:<unit> / live-status ／ audit は無視）
   └ components（store 購読 → memo 境界で領域単位再描画）
```

状態は単一ストア（context + useReducer）。テスト: reducer 単体 / deriveViewState 単体 / 各コンポーネント RTL（a11y ロール検査含む）/ StatusChip 7状態の三重表現。

## Review

**Verdict:** READY

- BLM「手順6/7」(business-logic-model.md:24-29) がオンデマンド取得を起動フロー1〜5と明確に分離: 手順6=選択時の stage doc 取得+同一セッション内 slug メモ化、手順7=初回描画完了後アイドル時の links 取得。両方とも「初回描画の予算外／クリティカルパスに含めない」と明記され、P-UI-2 の予算と衝突しない。
- domain-entities.md:25-26 の `AppState` に `stageDoc: Record<string, ViewState<StageDoc>>` と `projectLinks: ViewState<ProjectLink[]>` のスロットが追加され、直後の行(30)で「StageDoc / ProjectLink は docs-bridge が定義し shared-types 経由で参照する（docs-bridge/functional-design/domain-entities.md）。本 Unit では再定義しない」とトレース先が明記された。docs-bridge 側ファイルはレビュースコープ外（sibling unit read はツールにブロックされる）のため内容までは検証不可だが、少なくとも dashboard-ui 側の記述としては未定義状態が解消されている。
- logical-components.md:15 に `services/docs.ts` が新設され、責務が「オンデマンド取得の制御（選択時に stage doc を取得・slug メモ化、アイドル時に links 取得 — BLM 手順6/7）。deep-link URL 生成も担当」と明記。依存は `services/api, store`（同ファイル同行）で、`/api/stage/:slug` と `/api/links` の実 GET クライアント自体は `services/api.ts`（同ファイル14行目）が所有し、`refetchAll()` は起動フロー1〜3のみを対象とする設計（オンデマンド取得は再接続時に再実行されない）と整合している。データフロー図（同ファイル27行目）にも `services/docs（GET /api/stage/:slug ← 選択時 / GET /api/links ← アイドル時。初回描画の予算外）` が追記済み。
- frontend-components.md:18,23-26 に `AreaBoundary`（NowStrip/StageRail/Matrix/DetailPanel を個別に包む領域単位 ErrorBoundary、App 直下の全体 ErrorBoundary との二段構え）が明記され、logical-components.md:18 のモジュール表（`components/AreaBoundary.tsx`）と一致。前回の non-blocking finding は解消。
- リグレッション確認: StageCard Props（frontend-components.md:48）の `doc: StageDoc` が BLM 手順6・AppState の `stageDoc` slice と整合。docs.ts と api.ts の責務分離（制御 vs 実 fetch）に矛盾なし。新規の矛盾は見つからず。
