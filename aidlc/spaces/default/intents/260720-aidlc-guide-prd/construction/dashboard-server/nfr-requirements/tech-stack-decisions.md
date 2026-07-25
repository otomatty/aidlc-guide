# Tech Stack Decisions — Unit: dashboard-server

> nfr-requirements (3.2) / Unit: dashboard-server / 2026-07-24
> 入力: functional-design 3文書 + decisions.md ADR-03/04 + team-practices.md

## スタック

| 領域 | 選定 | 理由 |
|------|------|------|
| HTTP/WS | **Bun.serve（ビルトイン）** — routes + websocket ハンドラ | NFR-5 依存最小（Express/Hono 等の framework 不採用 — エンドポイント7本に framework は過剰） |
| 静的配信 | Bun.file + SPA fallback | ビルトインで足りる |
| 書込 | node:fs/promises（AnswerWriter のみ import 許可 — Biome 設定で answer-writer.ts だけ write 系許可の override） | BR-DS-1 の構造的隔離 |
| 依存 | reader-core / docs-bridge / shared-types（workspace 内）のみ。外部ランタイム依存ゼロ | NFR-5 |
| dev-time | Vitest（ハンドラは fetch レベルでテスト — Bun.serve をポート0で起動）+ Biome | team.md |

## 決定メモ

- CORS: 同一オリジン配信（SPA を自分で配る）ため不要 — ヘッダを足さない。
- ポート既定 4700（衝突時は起動エラーで別ポート案内 — 自動採番しない: URL 共有の予測可能性優先）。
