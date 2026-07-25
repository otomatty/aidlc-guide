# Scalability Design — Unit: mob-mode

> nfr-design (3.3) / Unit: mob-mode / 2026-07-25
> 入力: nfr-requirements/scalability-requirements.md（SC-MM-1/2）

## 設計

| 要件 | 実装所有 | 機構 |
|------|---------|------|
| SC-MM-1（〜10接続） | U5 | U5 の同期 broadcast をそのまま使用（本 Unit に追加機構なし） |
| SC-MM-2（上限を強制しない・接続数を出さない） | 本 Unit | 接続数のチェックも表示も実装しない（LiveStatus の表示モデル `LiveStatusView` に接続数フィールドを持たせない＝型で担保） |

## 再訪トリガー

参加者が数十人規模で NFR-3 を破ったら、U5 側で per-client キューを検討（本 Unit の設計は変わらない）。
