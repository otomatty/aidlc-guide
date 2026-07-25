# Code Generation Plan — Unit: dashboard-server

> code-generation (3.5) / Unit: dashboard-server (kind: service, M) / 2026-07-25
> 入力: functional-design 3文書 + nfr-requirements 5文書 + nfr-design 5文書 + team.md / project.md

## スコープ

`packages/dashboard-server/` — SPA へ供給するローカル Bun サーバ。本システム唯一の
書込経路（AnswerWriter）を所有する。依存: `reader-core` / `docs-bridge` /
`shared-types`（いずれも workspace 内）。外部ランタイム依存ゼロ。

## チェックリスト

### 型契約（shared-types 追加）

- [x] `ServeOptions` / `ServerMode` / `WsMessage` / `AnswerRequest` / `AnswerError`
      を `packages/shared-types/src/index.ts` に追加（domain-entities.md どおり）
- [x] `WsMessage` は判別可能ユニオン — クライアントと共有するワイヤ契約
- [x] shared-types は zero runtime code を維持（型のみ追加）

### `src/handlers/read.ts` — GET 系6ハンドラ + mapResult

- [x] `mapResult()` に ReadResult→HTTP 写像を1箇所集約（R-DS-1）
- [x] `unsupported` / `error` を **500 にしない**（BR-DS-4 / NFR-6 fail-soft）
- [x] `outside-record`→403 / `artifact-not-found`→404 / `no-active-intent`→200
- [x] `GET /api/workflow` → workflow + nextStep + `serverMode.hostMode`、**matrix を含まない**
      （ADR-03 段階的初回描画 / P-DS-1）
- [x] `GET /api/matrix` → 構築済みキャッシュ or `{building:true}`（BR-DS-5）
- [x] `GET /api/artifact?path=` → サーバ側 `guardPath` + reader 内部の二重検査（S-DS-4）
- [x] `GET /api/stage/:slug` / `GET /api/glossary/:term` / `GET /api/links` → bridge
- [x] 未知の `/api/*` は 404 JSON（SPA シェルを返さない）

### `src/handlers/answer-writer.ts` — 唯一の書込経路

- [x] 1. モードゲート: `--host` 中は無条件 403 `read-only-mode`（BR-DS-3 / S-DS-2）
- [x] 2. ファイル名ゲート: basename が `*-questions.md` でなければ 403 `not-a-questions-file`
- [x] 3. パスゲート: reader-core の `guardPath` で記録配下のみ許可 → 403 `outside-record`
- [x] 4. 行ゲート: 対象行が `[Answer]:` で始まらなければ 403 `not-an-answer-line`
- [x] 5. **書込前**にオフセット置換で新バイト列を構築し byte-invariance を検証
      → 不一致は 500 `write-verification-failed` で**書き込まない**（BR-DS-7 / R-DS-2）
- [x] 6. 同一ディレクトリの `.answer-tmp-<pid>` へ書込 → rename で atomic 置換、
      EPERM 系は 50ms backoff で1回再試行、`finally` で tmp を unlink（R-DS-5）
- [x] 7. 成功 → `{ok:true}`
- [x] 改行コード（CRLF/LF）・BOM・末尾改行なしを保存（行分割・再結合をしない）
- [x] 値に改行を含む要求は 400 で拒否（成果物への行注入の遮断）
- [x] write 系 fs import は本ファイルのみ — Biome `noRestrictedImports` override で強制（S-DS-3）

### `src/push.ts` — WS ファンアウト

- [x] クライアント `Set` の add / remove / size
- [x] `JSON.stringify` は**1回だけ**実行し全クライアントへ送出（P-DS-3/P-DS-4）
- [x] 全クライアントに同一ペイロード（BR-DS-6）
- [x] `scope:"state"` → getWorkflow + getNextStep 再取得 → `{type:"change",scope,workflow,nextStep}`（FR-4.6）
- [x] `scope:"matrix:<unit>"` → `buildMatrixForUnit` 差分更新 → `{...,cells}`（BR-DS-5）
- [x] `scope:"audit"` → getAuditEvents 再取得 → `{...,events}`
- [x] `watch-warning` → `{type:"live-status",degraded:true,reason}`（R-DS-3）
- [x] 再取得が縮退した場合も無言にせず `live-status` で通知
- [x] send が例外を投げたクライアントは Set から除去し、他クライアントを巻き込まない

### `src/static.ts` — dist 配信

- [x] `packages/dashboard/dist/` 配信 + SPA fallback（index.html）
- [x] ハッシュ名アセット → `Cache-Control: public, max-age=31536000, immutable`
- [x] index.html・非ハッシュ資産 → `no-cache`（P-DS-5）
- [x] `guardPath` で dist 外への traversal を遮断
- [x] dist 不在時は API-only モード（D-1 の逸脱 — 下記 code-summary.md 参照）

### `src/server.ts` — Bun.serve と起動シーケンス

- [x] Bun.serve ビルトインのみ（Express/Hono 不採用 — tech-stack-decisions.md）
- [x] 起動順: dist チェック → reader/bridge 生成 → bind → listen → 背景 getMatrix
      → `matrix-ready` broadcast → `reader.watch` 購読
- [x] 既定 bind `127.0.0.1`、`--host` 時のみ `0.0.0.0`（BR-DS-2 / S-DS-1）
- [x] 背景の全走査は `queueMicrotask` で listen 後に開始（初回描画のクリティカルパス外 — P-DS-2）
- [x] WS `message` ハンドラは受信を破棄・記録しない（S-DS-6）
- [x] 状態は `{matrixCache, clients:Set, hostMode}` のみ

### `src/cli.ts` — bin

- [x] `--port` / `--host` / `--help` のパース
- [x] `--host` 時は URL より**先に**公開警告を出力（US-19）
- [x] bind 失敗は非ゼロ終了 — loopback への暗黙フォールバックをしない（BR-DS-2）
- [x] EADDRINUSE 時は別ポート指定を案内（自動採番しない）

### テスト（Vitest）

- [x] `read-handlers.test.ts` — 6ハンドラ + mapResult 全分岐（unsupported/error が 500 にならない）
- [x] `/api/workflow` が `serverMode.hostMode` を返し `matrix` キーを持たない
- [x] `answer-writer.test.ts` — 5種のエラー識別子すべて + 不正ボディ + byte-invariance golden
      （LF / CRLF / BOM / 末尾改行なし）+ tmp 残骸なし + rename 再試行
- [x] `hostMode=true` なら他条件が有効でも POST /api/answer は 403
- [x] `push.test.ts` — 2クライアントへ同一ペイロード、scope 別写像、live-status 縮退
- [x] `static.test.ts` — SPA fallback / Cache-Control / traversal 遮断
- [x] `server-smoke.test.ts` — **実 Bun プロセスをポート0で起動**し実 fetch / 実 WebSocket で検証
      （既定 loopback、`--host` の警告文言、2クライアント同一ペイロード、受信フレーム無視）
- [x] `bun run check`（biome + tsc + vitest --coverage + bun audit）green

## ストーリー・要件トレーサビリティ

| 実装 | ストーリー / 要件 | 検証 |
|------|------------------|------|
| `handlers/answer-writer.ts` 全7ステップ | **US-14**（回答の書込）/ FR-6.2 / NFR-1 / C-T2 | `answer-writer.test.ts` 全32ケース + smoke の実 POST |
| モードゲート + `serverMode.hostMode` | **US-11**（モブ参加者は read-only）/ ADR-04 / S-DS-2 | `read-handlers.test.ts` hostMode ケース + smoke の直接 POST 403 |
| bind 分岐 + `HOST_EXPOSURE_WARNING` | **US-19**（LAN 公開の警告）/ NFR-7 / S-DS-1 | `server-smoke.test.ts` bind / 警告文言 |
| `GET /api/workflow`（workflow + nextStep） | **FR-4**（Now strip / NextStepCallout）/ FR-4.6 | `read-handlers.test.ts` + smoke |
| `push.ts` state 伝搬 | **FR-4.6**（NextStepCallout ライブ更新）/ NFR-3 | `push.test.ts` + smoke の2クライアント |
| `GET /api/artifact` / `stage` / `glossary` / `links` | **FR-5**（成果物・解説・用語）/ FR-6 | `read-handlers.test.ts` |
| `push.ts` broadcast + WS | **FR-7.2**（モブ全員が同じ画面）/ SC-DS-1 | `push.test.ts` + smoke |
| `handlers/read.ts` `mapResult` | **NFR-6**（fail-soft）/ R-DS-1 / BR-DS-4 | `read-handlers.test.ts` 写像テスト |
| 段階的初回描画（matrix を第1段に含めない） | **NFR-2** / ADR-03 / P-DS-1 | `/api/workflow` に matrix なしを assert |
| `buildMatrixForUnit` 差分更新 | **NFR-3** / BR-DS-5 / P-DS-3 | `push.test.ts` matrix scope |
