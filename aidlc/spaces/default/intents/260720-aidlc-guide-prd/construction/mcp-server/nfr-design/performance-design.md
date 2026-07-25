# Performance Design — Unit: mcp-server

> nfr-design (3.3) / Unit: mcp-server / 2026-07-24
> 入力: nfr-requirements/performance-requirements.md（P-MS-1〜4）+ functional-design/business-logic-model.md

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| P-MS-1（status/next ≤300ms） | ハンドラは reader 1 呼出 + テンプレート整形のみ（追加 I/O なし） |
| P-MS-2（explain/glossary ≤200ms） | bridge のメモリ map 参照 + 必要時のみ docs 1枚読取。reader を経由しない（recordDir 解決コストを負わない） |
| P-MS-3（read_artifact ≤500ms） | guardPath（純関数）→ reader.readArtifact（stat + read）。整形は本文をそのまま埋めるのみ（再エンコードしない） |
| P-MS-4（起動 ≤500ms） | createReader/createBridge は起動時に**生成する**が、その生成自体が FS を触らない（reader は recordDir を呼出毎に解決 [P-RC-7]、bridge は静的 import）ため起動コストが乗らない。ツール登録は静的配列 |

## 非採用

応答キャッシュ（都度最新が価値 — BR-MS の設計意図）、事前ウォームアップ（起動予算を圧迫する）。
