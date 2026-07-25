# Tech Stack Decisions — Unit: mcp-server

> nfr-requirements (3.2) / Unit: mcp-server / 2026-07-24
> 入力: functional-design 3文書 + requirements.md（PRD §7）+ team-practices.md

## スタック

| 領域 | 選定 | 理由 |
|------|------|------|
| MCP 実装 | **MCP TypeScript SDK（@modelcontextprotocol/sdk）stdio トランスポート** | PRD §7 指定 / Claude Code 標準の統合方法 |
| 入力スキーマ | SDK 同梱の zod（SDK の依存として入る — 追加依存ではない） | スキーマ違反のみ isError にする境界（BR-MS-3）を型で担保 |
| 依存 | 上記 SDK + workspace 内（reader-core/docs-bridge/shared-types）のみ | NFR-5 |
| dev-time | Vitest（ハンドラ単体 + reader/bridge スタブ）+ Biome | team.md |

## 決定メモ

- `.mcp.json` への登録手順は README に記載（M1 完了条件 — bolt-plan B3 の DoD）。
- ツール description は AI の選択精度に効くため、BR-MS-6 の「いつ使うか」1行規約をコードコメントでなく description 文字列に書く。
