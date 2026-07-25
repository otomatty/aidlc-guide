# Reliability Design — Unit: mcp-server

> nfr-design (3.3) / Unit: mcp-server / 2026-07-24
> 入力: nfr-requirements/reliability-requirements.md（R-MS-1〜5）+ functional-design（写像表）

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| R-MS-1（落ちない） | 全ハンドラを `safeHandler(fn)` で包む（内部例外→通常応答テキスト化）。加えて process レベルで unhandledRejection/uncaughtException を捕捉しログのみ（exit しない） |
| R-MS-2（データ失敗は通常応答） | ReadResult→応答の写像を `renderResult()` 1関数に集約（isError を返す経路はスキーマ検証層のみ — SDK の zod が担う） |
| R-MS-3（未初期化でも起動） | 起動時に FS を触らない（P-MS-4 と同じ機構）。no-active-intent は各ツールの応答で説明 |
| R-MS-4（インテント切替追従） | reader の呼出毎 recordDir 再解決に委譲（サーバはキャッシュを持たない — 構造的追従） |
| R-MS-5（両OS） | stdio・パスとも OS 依存コードなし（reader/bridge が吸収） |

## 障害モード

- reader/bridge が縮退（unsupported/error）→ renderResult が説明文に変換（AI が別行動を選べる）
- 想定外例外 → safeHandler が「内部エラー」応答（プロセス継続）
- stdio 切断（Claude Code 終了）→ SDK が close、プロセス終了（正常）
