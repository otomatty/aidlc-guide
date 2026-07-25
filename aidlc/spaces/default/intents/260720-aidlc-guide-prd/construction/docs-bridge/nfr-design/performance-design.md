# Performance Design — Unit: docs-bridge

> nfr-design (3.3) / Unit: docs-bridge / 2026-07-24
> 入力: nfr-requirements/performance-requirements.md（P-DB-1〜3）

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| P-DB-1（ロード ≤50ms） | 静的 import（バンドル同梱・パース済み JS オブジェクトとしてロード — 実質ゼロコスト） |
| P-DB-2（解決 ≤100ms） | map はオブジェクトキー参照 O(1)。excerpt 添付時のみ該当 docs ファイル1枚を読む（節スライスは行走査1回） |
| P-DB-3（first paint 外） | 消費者契約: Dashboard は StageCard 展開時に遅延取得、MCP は呼出時のみ。docs-bridge 自身は事前ロードを提供しない（API を同期呼出型にしない誘惑を断つ — 全 API は async） |

## 非採用

excerpt のキャッシュ（同一 slug 再取得はファイル再読取） — ローカル FS 読取 1 枚は十分速く、キャッシュ無効化の複雑さが勝る。
