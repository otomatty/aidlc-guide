# Scalability Requirements — Unit: docs-bridge

> nfr-requirements (3.2) / Unit: docs-bridge / 2026-07-24
> 入力: performance-requirements.md + requirements.md

## 適用なし（明示）

静的 map（33ステージ + 用語数十件）のメモリ参照。データ成長は aidlc-workflows のステージ数に比例（低頻度・手動同期 — BR-DB-4）。スケーラビリティ軸は構造的非該当。map が数千件級になったら P-DB-1 の 50ms が最初に破れる — その時に再訪（YAGNI）。

## 再訪トリガー

map が数千件級（現状の100倍）になり P-DB-1 の 50ms を実測で超えたら、遅延ロード・分割を検討する。それまでは現構造を維持（YAGNI）。
