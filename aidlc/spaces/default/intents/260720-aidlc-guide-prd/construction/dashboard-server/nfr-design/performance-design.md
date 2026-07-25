# Performance Design — Unit: dashboard-server

> nfr-design (3.3) / Unit: dashboard-server / 2026-07-24
> 入力: nfr-requirements/performance-requirements.md（P-DS-1〜5）+ functional-design/business-logic-model.md

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| P-DS-1（起動≤1s / workflow≤300ms） | 起動は dist stat + インスタンス生成のみ（先読みしない）。/api/workflow ハンドラは 1回の readState 結果から workflow と nextStep を両方導出（再パースしない — 予算の「最悪 ≤100ms」を構造的に回避） |
| P-DS-2（第2段≤3s） | listen 直後に queueMicrotask で getMatrix 開始 → 完了時 matrixCache 更新 + matrix-ready broadcast |
| P-DS-3（変更→送出≤1.5s） | watch cb 内で scope 別の最小再取得（functional-design の伝搬表）→ JSON.stringify 1回 → 全クライアント send（直列化を接続数分繰り返さない） |
| P-DS-4（10接続ファンアウト） | 同期 send ループ（backpressure は Bun の WS バッファに委譲。10接続で問題にならない） |
| P-DS-5（静的配信） | ビルドハッシュ名アセットに `Cache-Control: public, max-age=31536000, immutable`、index.html は no-cache |

## 非採用

HTTP/2・圧縮（ローカル配信で不要）、matrix の永続キャッシュ（プロセス寿命内メモリのみ）。
