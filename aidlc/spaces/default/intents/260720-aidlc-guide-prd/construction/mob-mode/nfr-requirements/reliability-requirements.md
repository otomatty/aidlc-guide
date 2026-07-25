# Reliability Requirements — Unit: mob-mode

> nfr-requirements (3.2) / Unit: mob-mode / 2026-07-25
> 入力: functional-design（M3 LiveStatus・エラー境界）+ requirements.md（NFR-6/7）+ dashboard-ui R-UI-4/5

## 要件

> 実装所有欄は security-requirements.md と同じ規約（U5 = dashboard-server が実装、本 Unit は要求・検証）。

| ID | 要件 | 実装所有 | 検証 |
|----|------|---------|------|
| R-MM-1 | **bind 失敗は起動失敗**（loopback へ黙って落ちない — BR-MM-5）。理由と対処（ポート変更等）を stderr に出す | U5（bind 分岐） | ポート占有下の起動テスト |
| R-MM-2 | **NIC 列挙失敗でも起動継続**（addresses 空 + 警告のみ。公開自体は成立している） | 本 Unit | 列挙をモックで失敗させるテスト |
| R-MM-3 | **LiveStatus が実態と一致**: 4状態が `AppState.live` の変化に追随し、切断中に「ライブ更新中」を表示しない（嘘をつかない） | 本 Unit | 状態遷移テスト |
| R-MM-4 | 参加者の切断・再接続がドライバー側に影響しない（サーバはクライアント Set から除くだけ） | U5（WS クライアント管理） | 多クライアント切断テスト |
| R-MM-5 | 参加者ビューの復帰は dashboard-ui の再接続機構に委譲（R-UI-4 の指数バックオフ + REST 再取得）。本 Unit 独自の復帰機構を作らない | U6（dashboard-ui） | 統合テスト |

## 縮退の可視化

サーバの `live-status degraded`（reader の watch-warning 由来）が参加者・ドライバー双方の LiveStatus に反映されること（ライブ性喪失を黙らせない — NFR-6 の精神）。
