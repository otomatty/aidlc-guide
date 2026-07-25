# Performance Requirements — Unit: mob-mode

> nfr-requirements (3.2) / Unit: mob-mode / 2026-07-25
> 入力: functional-design/business-logic-model.md（M1〜M3 = 本 Unit の差分）+ requirements.md（NFR-3）+ dashboard-server P-DS 予算

## 適用範囲

サーバ本体の性能予算は U5（P-DS-*）が所有。本 Unit の差分（アドレス列挙・ReadOnlyBadge・LiveStatus）に固有の要件のみを定義する。

| ID | 要件 | 測定 |
|----|------|------|
| P-MM-1 | `buildExposureNotice()`（NIC 列挙）は ≤100ms（起動時1回。`os.networkInterfaces()` の同期呼出 + 整形のみ） | 起動計測 |
| P-MM-2 | ReadOnlyBadge / LiveStatus の描画は他領域の再描画を誘発しない（`live` slice のみ購読 — dashboard-ui の memo 境界に従う） | React profiler / 再描画テスト |
| P-MM-3 | 参加者への反映時間は NFR-3（2秒）を**ドライバーと同条件で**満たす（同一 broadcast のため追加コストなし。LAN 往復は localhost より遅いが、モブ規模の LAN で数 ms 差） | 実機モブでの計測（performance-validation 4.6） |

## 非目標

参加者数に応じた配信最適化（SC-MM で 10 接続上限 — 同期送出で足りる）。
