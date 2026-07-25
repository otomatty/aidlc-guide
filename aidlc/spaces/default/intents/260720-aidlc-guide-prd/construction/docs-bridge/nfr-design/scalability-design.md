# Scalability Design — Unit: docs-bridge

> nfr-design (3.3) / Unit: docs-bridge / 2026-07-24
> 入力: nfr-requirements/scalability-requirements.md

## 設計なし（要件側で N/A 確定）

メモリ常駐の静的 map + O(1) 参照。設計上の追加機構なし。

## 再訪トリガー（要件と同期）

P-DB-1 実測超過（map 数千件級）で遅延ロード/分割を検討。現構造は据え置き。
