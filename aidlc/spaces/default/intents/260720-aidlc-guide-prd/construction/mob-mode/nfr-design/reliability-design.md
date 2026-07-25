# Reliability Design — Unit: mob-mode

> nfr-design (3.3) / Unit: mob-mode / 2026-07-25
> 入力: nfr-requirements/reliability-requirements.md（R-MM-1〜5）+ functional-design（M3 LiveStatus）

## 設計（要件→機構）

| 要件 | 実装所有 | 機構 |
|------|---------|------|
| R-MM-1（bind 失敗＝起動失敗） | U5 | 本 Unit は fallback 経路を追加しない（U5 の起動エラー終了をそのまま） |
| R-MM-2（NIC 列挙失敗でも継続） | 本 Unit | `buildExposureNotice` を try/catch し、失敗時は `addresses: []` で返す（警告表示と listen は継続） |
| R-MM-3（LiveStatus が嘘をつかない） | 本 Unit | `LiveStatusView` は `AppState.live` からの**純関数導出**（独自のタイマーや推測を持たない）。`connected=false` のとき「ライブ更新中」を返す分岐が存在しない（型と関数で保証） |
| R-MM-4（参加者切断の影響なし） | U5 | 本 Unit は接続管理に触れない |
| R-MM-5（復帰は dashboard-ui に委譲） | U6 | 本 Unit は再接続ロジックを持たない（`live` slice を読むだけ） |

## 縮退の可視化

サーバの `live-status degraded`（reader の watch-warning 由来）→ `LiveStatusView.degraded` → 「更新が止まっています（理由）」。ドライバー・参加者の双方に同じ表示（M3）。
