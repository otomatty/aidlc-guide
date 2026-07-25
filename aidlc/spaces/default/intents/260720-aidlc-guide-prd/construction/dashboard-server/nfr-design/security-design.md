# Security Design — Unit: dashboard-server

> nfr-design (3.3) / Unit: dashboard-server / 2026-07-24
> 入力: nfr-requirements/security-requirements.md（S-DS-1〜6）+ functional-design/business-rules.md

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| S-DS-1（bind 既定/警告） | ServeOptions.host のみが bind を決める単一分岐（serve() 冒頭）。警告文言は定数（US-19 の文言テストが定数を検証） |
| S-DS-2（--host 403） | ミドルウェア相当の前段ゲート: host モードフラグを AnswerWriter ハンドラの最初で検査（ルーティング層でなくハンドラ内 — 迂回ルート無し） |
| S-DS-3（4ゲート書込） | answer-writer.ts に 7ステップを直列実装（early return）。write 系 fs import は本ファイルのみ Biome override で許可 |
| S-DS-4（パス検査点） | /api/artifact: サーバ側 guardPath → reader（内部一次）で二重。/api/answer: AnswerWriter 内 guardPath（唯一の検査点） |
| S-DS-5（認証なし） | 実装しない（明示）。--host 警告とガイドで統制 |
| S-DS-6（WS push 専用） | ws.message ハンドラは無視 + 計数のみ（ログ肥大防止のため内容を記録しない） |

## 信頼境界

ブラウザ（半信頼 — LAN 公開時は不特定）→ HTTP/WS → 本サーバ → reader/bridge（ライブラリ）。全パス系入力は境界で guardPath。書込は 1 ハンドラ 1 ファイル種別 1 行種別に限定。
