# Scalability Requirements — Unit: mcp-server

> nfr-requirements (3.2) / Unit: mcp-server / 2026-07-24
> 入力: performance-requirements.md + services.md S1

## 適用範囲

| ID | 要件 |
|----|------|
| SC-MS-1 | 同時性は 1 セッション 1 プロセス（Claude Code が spawn）。複数セッション（本線 + btw サイド）は各自別プロセスで、共有状態なし — 競合しない |
| SC-MS-2 | データ量スケールは reader-core / docs-bridge に委譲（サーバは透過） |

## 非該当

水平分散・接続プール・キューなし（stdio 逐次）。
