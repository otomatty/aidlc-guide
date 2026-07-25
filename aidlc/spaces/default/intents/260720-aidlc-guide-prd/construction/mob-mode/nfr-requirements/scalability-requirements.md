# Scalability Requirements — Unit: mob-mode

> nfr-requirements (3.2) / Unit: mob-mode / 2026-07-25
> 入力: performance-requirements.md（P-MM-3）+ dashboard-server SC-DS-1 + services.md

## 要件

| ID | 要件 | 実装所有 | 検証 |
|----|------|---------|------|
| SC-MM-1 | 同時参加者は**モブ規模（〜10接続）**を設計上限とする（dashboard-server SC-DS-1 と同一。本 Unit は参加者接続を増やす要因だが、上限は共有） | U5（broadcast） | 10接続での反映時間が NFR-3 内（performance-validation 4.6） |
| SC-MM-2 | 上限を強制しない（超えても壊れず遅くなるだけ）。接続数のカウントは LiveStatus に出さない（ドライバーの認知負荷を増やさない） | 本 Unit | 接続数上限のチェックコードが存在しないこと + LiveStatus の表示要素に接続数が含まれないこと |

## 再訪トリガー

参加者が数十人規模になり broadcast 遅延が NFR-3 を破ったら、dashboard-server 側で per-client キューを検討（本 Unit ではなくサーバ側の課題）。
