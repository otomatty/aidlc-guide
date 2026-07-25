# Scalability Design — Unit: mcp-server

> nfr-design (3.3) / Unit: mcp-server / 2026-07-24
> 入力: nfr-requirements/scalability-requirements.md（SC-MS-1/2）

## 設計

| 要件 | 機構 |
|------|------|
| SC-MS-1（1セッション1プロセス） | 状態を持たない設計（インスタンス参照のみ）。複数プロセスが同じ FS を読んでも競合しない（全読取） |
| SC-MS-2（データ量委譲） | reader/bridge の透過。サーバ自前のデータ構造なし |

## 非該当

接続プール・キュー・水平分散（stdio 逐次・単一プロセス）。
