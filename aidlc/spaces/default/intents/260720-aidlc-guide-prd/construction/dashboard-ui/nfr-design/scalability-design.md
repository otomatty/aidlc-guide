# Scalability Design — Unit: dashboard-ui

> nfr-design (3.3) / Unit: dashboard-ui / 2026-07-24
> 入力: nfr-requirements/scalability-requirements.md（SC-UI-1〜3）

## 設計

| 要件 | 機構 |
|------|------|
| SC-UI-1（rail 32件） | 素の DOM。仮想化なし |
| SC-UI-2（matrix ≤500セル） | 行単位 memo（performance-design P-UI-4 と同じ機構）。仮想化なし |
| SC-UI-3（監査は範囲外） | audit scope の WS メッセージは reducer で明示的に無視（default 節でなく明示 case で「無視」と書き、将来の追加時に見落とさない） |

## 再訪トリガー

ユニット数 50（=250セル）超で実測が P-UI-4 を破ったら行仮想化（react-window 等）を導入。それまでは依存を増やさない。
