# Reliability Design — Unit: dashboard-ui

> nfr-design (3.3) / Unit: dashboard-ui / 2026-07-24
> 入力: nfr-requirements/reliability-requirements.md（R-UI-1〜6）+ functional-design/business-logic-model.md

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| R-UI-1（全画面クラッシュゼロ） | `<AreaBoundary name>` コンポーネント（ErrorBoundary ラッパー）を NowStrip / StageRail / Matrix / DetailPanel の4領域に配置。fallback は UnparseableBadge + 「この領域を再読み込み」 |
| R-UI-2（縮退の可視化） | ViewState 導出を `deriveViewState(payload)` 1関数に集約 — サーバ由来の unsupported/error/warnings/cell.error を必ず kind に反映（握り潰す経路を作らない） |
| R-UI-3（サーバ停止の明示） | fetch 例外 → `live.connected=false` + 全領域に「サーバに接続できません」+ 再試行ボタン（再試行は bootstrap の再実行） |
| R-UI-4（WS 再接続） | `useLiveConnection` フック: close/error で指数バックオフ（1s, 2s, 4s, 8s, 10s 上限）。open 時に REST 再取得（`refetchAll()`）で整合回復 |
| R-UI-5（ライブ性喪失の明示） | live-status メッセージ → LiveStatus が `role="status"` + aria-live=polite で「更新が止まっています（理由）」 |
| R-UI-6（決定性） | サーバ配列順を保持（UI で sort しない）。key は安定 ID（slug / unit+stage） |

## 回復パターン

- サーバ再起動 → WS 再接続 → refetchAll → 通常表示（ユーザー操作不要）
- 領域クラッシュ → その領域のみ fallback、他は生存。再読み込みボタンで当該領域の再マウント
