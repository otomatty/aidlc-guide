# Security Design — Unit: mcp-server

> nfr-design (3.3) / Unit: mcp-server / 2026-07-24
> 入力: nfr-requirements/security-requirements.md（S-MS-1〜5）+ functional-design/business-rules.md

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| S-MS-1（書込ゼロ） | fs の write 系 import を Biome restricted-imports で全面禁止（本パッケージに例外なし） |
| S-MS-2（境界検査） | ハンドラ冒頭で reader-core の公開 `guardPath` を呼び、拒否なら即応答（reader へ渡さない）。reader 内部の一次検査が最終防衛線 |
| S-MS-3（stdio のみ） | SDK の StdioServerTransport 固定。HTTP/SSE トランスポートをコードに持たない |
| S-MS-4（パス露出最小） | エラー整形ヘルパーが workspaceRoot を相対化してから応答に載せる（絶対パスを出さない） |
| S-MS-5（資格情報非関与） | 環境変数の読取・転送なし |

## 信頼境界

AI（半信頼 — path 引数を任意に構成し得る）→ MCP stdio → 本サーバ → reader/bridge。境界検査は S-MS-2 の1点に集約。
