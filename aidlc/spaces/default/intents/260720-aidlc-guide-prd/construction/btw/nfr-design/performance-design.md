# Performance Design — Unit: btw

> nfr-design (3.3) / Unit: btw / 2026-07-23
> 入力: nfr-requirements/performance-requirements.md（P-BTW-1〜3）+ functional-design/business-logic-model.md

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| P-BTW-1（spawn まで2秒） | 起動パスに I/O を置かない: 前提チェックは `Bun.which("claude")` 1回のみ。設定ファイル・ネットワークなし。`--fork` のみ readdir+stat を追加（内容非読取） |
| P-BTW-2（100件で劣化なし） | `resolve()` は `readdir` 1回 → `.jsonl` フィルタ → `stat` の mtime 比較で最大値のみ保持（ソート不要、O(n) 単走査）。ファイル内容は開かない |
| P-BTW-3（-p 透過） | 子プロセスの stdio を `inherit` で直結（バッファリング・変換を挟まない） |

## 非採用（過剰設計の明示）

キャッシュ・並列 stat・遅延ロードは不採用 — n≈数十の stat に最適化は不要（ponytail: 測って困ってから）。
