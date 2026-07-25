# Code Summary — Unit: dashboard-server

> code-generation (3.5) / Unit: dashboard-server / 2026-07-25
> 実装場所: `packages/dashboard-server/`

## 生成ファイル

| ファイル | 役割 | 行数目安 |
|---------|------|---------|
| `src/cli.ts` | bin。`--port` / `--host` / `--help` パース、起動出力、bind 失敗は非ゼロ終了 | ~75 |
| `src/server.ts` | Bun.serve 設定・起動シーケンス・bind 分岐・背景 Matrix 構築・watch 購読 | ~175 |
| `src/handlers/read.ts` | GET 系6ハンドラ + `mapResult()`（唯一の ReadResult→HTTP 写像） | ~110 |
| `src/handlers/answer-writer.ts` | POST `/api/answer` の7ステップ。**write 系 import を持つ唯一のファイル** | ~215 |
| `src/push.ts` | WS クライアント Set・1回直列化の broadcast・scope 別再取得 | ~120 |
| `src/static.ts` | dist 配信 + SPA fallback + Cache-Control + traversal 遮断 | ~90 |
| `src/index.ts` | パッケージ公開面 | ~13 |
| `tests/*.test.ts` (5) + `tests/support.ts` | 下記テスト構成 | ~700 |

`packages/shared-types/src/index.ts` に `ServeOptions` / `ServerMode` / `WsMessage` /
`AnswerRequest` / `AnswerError` を追加（型のみ。zero runtime code を維持）。
`biome.json` に dashboard-server の write-import 制限 override を追加。
`vitest.config.ts` の coverage exclude に `server.ts` / `cli.ts` / `index.ts` を追加。

## 品質ゲート実測（`bun run check`）

```
biome check .            Checked 80 files. No fixes applied.
tsc --noEmit             (エラーなし)
vitest run --coverage    Test Files 29 passed (29) / Tests 413 passed | 2 skipped (415)
bun audit                No vulnerabilities found
```

dashboard-server の carverage（v8）:

| ファイル | Stmts | Branch | Funcs | Lines |
|---------|-------|--------|-------|-------|
| `handlers/read.ts` | 100 | 97.14 | 100 | 100 |
| `handlers/answer-writer.ts` | 91.39 | 85.96 | 100 | 96 |
| `push.ts` | 98.07 | 95.45 | 100 | 100 |
| `static.ts` | 95.65 | 91.66 | 100 | 95 |

リポジトリ全体: Statements 97.38% / Branches 94.07% / Lines 98.98%
（team.md の UI 層 ~80% ライン基準を上回る）。

## テスト構成

- `read-handlers.test.ts`（28件）— 6ハンドラ + `mapResult` 全分岐。`unsupported`・
  `state-missing`・`state-unreadable`・`no-active-intent`・`internal:*` のすべてで
  **200** を返すこと（500 にならないこと）を個別に assert。`/api/workflow` が
  `serverMode.hostMode` を返し `matrix` キーを持たないことを assert。
- `answer-writer.test.ts`（32件）— 5種のエラー識別子すべて、不正ボディ8種、
  byte-invariance golden（LF / CRLF / BOM / 末尾改行なし / 多バイト値）、
  tmp 残骸なし（成功・拒否の両方）、rename の EPERM 1回再試行・非再試行エラー。
- `push.test.ts`（12件）— 2クライアントへの**バイト同一**ペイロード、scope 別写像、
  watch-warning→live-status、再取得縮退時の live-status、send 例外クライアントの隔離。
- `static.test.ts`（7件）— SPA fallback、hashed→immutable / index.html→no-cache、
  traversal 遮断、dist 不在時の挙動。
- `server-smoke.test.ts`（7件）— **実 Bun プロセスをポート0で起動**し実 fetch /
  実 WebSocket で検証: 既定 loopback、`--host` の警告文言と 0.0.0.0 bind、
  `--host` 中の直接 POST が 403 かつファイル無傷、書込のエンドツーエンド、
  2クライアントが同一ペイロードを受信、受信フレーム（不正 JSON 含む）を無視しても
  サーバが生存、背景 Matrix 構築の完了。

## 設計判断・逸脱

**D-1（逸脱）dist/ 不在時は fail fast ではなく API-only モード。**
設計（起動シーケンス step1 / R-DS-4）は dist 不在を起動エラー exit 1 と規定するが、
`packages/dashboard` はまだ存在せず、そのままでは本 Unit が単体で起動もテストもできない。
そこで dist パスを `ServeConfig.distDir` で設定可能にし、不在時は明示ログ
（`DIST_MISSING_HINT`「先に build を実行してください。今回は API のみのモードで起動します」）
を出して API のみを配信する。**dashboard-ui の出荷時に fail-fast へ戻すこと** — その時点で
「黙って空白ページを出さない」という R-DS-4 の意図はログではなく起動失敗で満たすべき。

**D-2（逸脱）静的配信は `Bun.file` ストリームではなく `readFile`。**
P-DS-5 は Bun.file のストリーム応答を指定するが、(1) ローカル配信のビルド済み資産で
ストリーミングの利得がない、(2) 本リポジトリの Vitest は Node 上で動くため `Bun.*` を
使うと `static.ts` が単体テスト不能になる、の2点から `node:fs/promises` の `readFile` を採用。
外形（Content-Type / Cache-Control / SPA fallback）は設計どおり。

**D-3（決定）`AnswerRequest.line` は 1 始まり。**
domain-entities.md は `line: number` とだけ規定し基数を定めていない。旧名 `lineIndex` からの
改名意図と、回答する人間が見る行番号表示との一致を根拠に **1-based** とした。
`line: 0` は 400 で拒否する。**dashboard-ui 実装時に必ず突き合わせること。**

**D-4（決定）`server.ts` / `cli.ts` は coverage 対象外。**
本リポジトリの Vitest は Node で動作し `Bun.serve` が存在しない（実測: `typeof Bun ===
"undefined"`）。そのため両ファイルは子 Bun プロセスとして起動し実 HTTP/WS で検証する
（`server-smoke.test.ts`）。同一プロセスの v8 coverage からは見えないため、`btw` の
`spawn.ts` / `cli.ts` と同じ前例に倣って exclude し、理由を `vitest.config.ts` に明記した。

**D-5（決定）5種のエラー識別子に該当しない入力は 400 `bad-request`。**
不正 JSON・型不一致・改行を含む値は書込ゲートの拒否ではなく境界での入力検証であり、
`AnswerError` を拡張せず 400 + `{error:"bad-request", reason}` で返す。とくに改行を含む値は
成果物への行注入になるため、byte-invariance 検証より前に拒否する。

**D-6（決定）`guardPath` は reader-core の公開 export をそのまま使用（第3の複製を作らない）。**
`packages/reader-core/src/index.ts` は既に
`/** Re-exported for the dashboard-server AnswerWriter path gate (S-RC-2 consumer contract). */`
付きで `guardPath` を named export している。docs-bridge の複製は意図的な設計（DAG 上
docs-bridge は reader-core に依存しない）であり、dashboard-server は両者に依存するため
reader-core 版を再利用するのが正しい。

**D-7（決定）再取得が縮退したときも無言にしない。**
watch 発火後の `getWorkflow` / `getAuditEvents` などが `unsupported`/`error` を返した場合、
change を送らないのではなく `{type:"live-status", degraded:true, reason}` を送る。
NFR-6 の「解析不可を表現する」を push 経路にも適用したもの（設計に明示規定なし）。

## 既知のギャップ / 次段への申し送り

1. **起動直後の watch 空白窓。** `reader.watch()` は `resolveRecordDir` を非同期に解決して
   から chokidar を購読するため、listen 直後の数十〜数百 ms に発生した変更は取りこぼし得る。
   実測として smoke テストでは変更書込のリトライが必要だった。実用上は初回 REST 取得が
   その後に来るため実害は小さいが、reader-core 側で「購読完了 Promise」を公開できれば解消する。
2. **`--host` 起動時の 0.0.0.0 bind は smoke テストで実際に bind する。** OS のファイア
   ウォール確認ダイアログが出る環境がある（機能には影響しない）。
3. **P-DS-1〜P-DS-3 の数値計測は未実施。** 本ステージでは構造（第1段に全走査を含めない、
   直列化1回、差分更新）を実装・検証した。3秒/2秒の実測は tb-lxp フィクスチャに対する
   performance-validation ステージの担当。
4. **`GET /api/workflow` は `getWorkflow` と `getNextStep` を並行に2回呼ぶ。**
   P-DS-1 が理想とする「1回のパース結果を両者に使う」形ではない（reader-core の公開 API が
   それぞれ独立に state を読むため）。予算内（最悪 ≤300ms）には収まる想定だが、実測が
   予算を割る場合は reader-core に複合メソッドを足すのが最短の改善。
5. **dashboard-ui との契約合わせが必要な2点**: `AnswerRequest.line` の基数（D-3）と、
   `mapResult` が `ReadResult` をそのまま body に載せる方式（`{ok,value,warnings}` /
   `{unsupported,version}` / `{error,reason}`）。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25

Re-ran the write boundary, isolation, and gate mechanics against real code and re-executed the
quality gate myself (piece-by-piece — see "Gate re-run" below; the combined `bun run check` could
not be invoked as one command under this review's directory-scoped sandbox, so each of its four
steps was run independently, scoped to `packages/dashboard-server`).

### 1. AnswerWriter (write boundary) — CONFIRMED sound

`handlers/answer-writer.ts` runs the 7 steps as early returns in the designed order: host-mode
(153) → filename (167) → path/`guardPath` (171–175) → line (184–193) → build+verify **before any
write** (195–204) → commit (206–218) → `{ok:true}` (221). Step 5's `verifyInvariance` (87–115)
re-derives line structure from the *candidate* buffer via `lineSpans()`, which splits on raw LF
bytes and never decodes to string (66–77) — this is what makes the CRLF/BOM preservation real
rather than a claim: `verifyInvariance` compares `before.subarray(0, bomLen)` to
`after.subarray(0, bomLen)` for the BOM (94) and compares each line's terminator slice
byte-for-byte (104) independently of content. A mismatch anywhere returns `false` before line 202,
which is strictly before the `writeFile`/`renameWithRetry` call at 210–211 — no write occurs on a
verification failure. The tmp file is `path.join(path.dirname(target), \`.answer-tmp-${process.pid}\`)`
(208) — same directory as the target (avoids EXDEV, per R-DS-5) — and is unlinked in a `finally`
(217) regardless of outcome. `renameWithRetry` (136–149) retries once after `RENAME_RETRY_MS` on
`EPERM`/`EACCES`/`EBUSY`, matching R-DS-5's Windows-lock mitigation (it retries a superset of just
EPERM, which is a reasonable, disclosed widening, not a narrowing). Exercised end-to-end by
`answer-writer.test.ts` (LF/CRLF/BOM/no-trailing-newline goldens, tmp-debris-free on both success
and rejection, EPERM retry and give-up) and by `server-smoke.test.ts`'s real POST against a spawned
Bun process.

### 2. BR-DS-1 write isolation — CONFIRMED

Read every file in `packages/dashboard-server/src/`: only `handlers/answer-writer.ts` imports
`writeFile`/`rename`/`unlink` from `node:fs/promises` (line 1). `static.ts` imports `readFile`
only. `biome.json`'s override for `packages/dashboard-server/src/**` (174–242) forbids the same
write-API import names Biome already uses for `reader-core`/`docs-bridge`, and a second, narrower
override (244–252) turns `noRestrictedImports` back `"off"` scoped to exactly
`packages/dashboard-server/src/handlers/answer-writer.ts` — not the whole `handlers/` directory.
Ran `biome check` scoped to `packages/dashboard-server`: clean, 14 files, no fixes applied — the
negative control (every other file staying inside the restriction) is real, not just claimed.

### 3. mapResult (BR-DS-4) — CONFIRMED, no read path can 500 on a degraded result

`mapResult()` (read.ts 36–39) only escalates `outside-record`→403 and `artifact-not-found`→404;
everything else (`unsupported`, all other `error` reasons, `internal:*`) is 200. Traced every
route in `handleRead`: `/api/workflow` routes both `getWorkflow`/`getNextStep` failures through
`mapResult` (61–62); `/api/matrix` uses the cache directly, `mapResult`, or `{building:true}` —
never a raw throw (92–95); `/api/artifact` routes `recordDir`, `guardPath`, and
`reader.readArtifact` all through `mapResult` (80–84); `/api/links`, `/api/stage/:slug`,
`/api/glossary/:term` all route through `mapResult` (96, 100–107). The only non-`mapResult` JSON
response in the read path is the deliberate `unknown-route` 404 for an unrecognized `/api/*` path
(111) — a client-bug response, not a degraded-read response. `read-handlers.test.ts` asserts 200
for `unsupported`, `state-missing`, `state-unreadable`, `no-active-intent`, and an arbitrary
`internal:` reason individually.

### 4. `serverMode.hostMode` / matrix-absent (BR-DS-5 staged first paint) — CONFIRMED

`workflow()` (read.ts 59–70) returns `workflow`, `nextStep`, `serverMode: {hostMode}`, and
optional `warnings` — no `matrix` key. Verified both in the unit test
(`expect(body).not.toHaveProperty("matrix")`) and in `server-smoke.test.ts`'s real HTTP fetch
against a spawned process.

### 5. push.ts — CONFIRMED

`broadcast()` (push.ts 42–53) calls `JSON.stringify` once and loops `send` per client — serialize-
once-then-fan-out is real, not just documented, and `push.test.ts` asserts byte-identical payloads
across two recorded clients. `onMatrix` (81–93) calls `buildMatrixForUnit(record.value, unit,
stages)` — a scoped rebuild, not `reader.getMatrix()` (the full-scan method) — confirmed by import
(`buildMatrixForUnit` from `@aidlc-guide/reader-core`, line 1) and by the test asserting every
returned cell belongs to the single triggering unit. `watch-warning` maps to
`{type:"live-status",degraded:true,reason}` (106–108). The WS `message` handler in `server.ts`
(130–133) is a no-op — inbound frames are dropped, confirmed by the smoke test sending malformed
JSON and a spoofed write frame and asserting the server survives and answers subsequent requests.

### 6. Bind safety (S-DS-1/BR-MM-1) — CONFIRMED

`server.ts` binds `LOOPBACK` unless `config.host` is true, in which case it binds
`ALL_INTERFACES` (108–110) — a single boolean-driven branch, no other path to `0.0.0.0`.
`HOST_EXPOSURE_WARNING` names what becomes visible (rendered artifacts/audit content, possible
pasted secrets) and states that answer-writing becomes disabled for every client while `--host` is
running. No fallback-to-loopback exists anywhere: `Bun.serve()` is called unguarded (108) and any
throw propagates out of `serve()`, uncaught by `main()`, to the top-level `try/catch` in `cli.ts`
(64–76), which logs and `process.exit(1)`s — there is no retry, no alternate port, no alternate
hostname.

### 7. Tests — substantive, and I independently reproduced the coverage numbers

Read all 5 test files; none are tautological — `answer-writer.test.ts`'s byte-invariance checks
re-split the actual file bytes in latin1 space rather than trusting the handler's own JSON
response, `push.test.ts` checks payload identity via `JSON.stringify` equality across two
independent client recorders, `server-smoke.test.ts` drives a real spawned Bun process over real
HTTP/WS. I ran `vitest run --coverage` scoped to `packages/dashboard-server/tests` (5 files, 83
tests, all passed) and the per-file coverage numbers matched code-summary.md's claimed table
exactly: `read.ts` 100/97.14/100/100, `answer-writer.ts` 91.39/85.96/100/96, `push.ts`
98.07/95.45/100/100, `static.ts` 95.65/91.66/100/95. I also ran `tsc --noEmit` (clean — this also
confirms D-6's `guardPath` import from `@aidlc-guide/reader-core` actually resolves and
typechecks) and `bun audit` (no vulnerabilities) independently. `biome check` was reported above.
I could not invoke the single `bun run check` command as written because this review's directory
sandbox rejects any command whose path doesn't resolve under `dashboard-server`; running the four
steps individually, scoped to this package, is the closest equivalent available to a reviewer
under that constraint, and all four came back clean/matching.

### 8. Deviations D-1..D-7 — sound, with one traceability gap (non-blocking)

D-2 through D-7 are reasonable and hold up against the code: D-4's coverage exclusion is justified
(`Bun.serve` does not exist under Node-hosted Vitest, confirmed — `server.ts`/`cli.ts` are only
reachable via the real-process smoke test) and the smoke test genuinely exercises the excluded
files. D-3 (1-based line) is now consistently reflected in `domain-entities.md` and
`shared-types/src/index.ts`. D-6's `guardPath` reuse typechecks (see #7).

**D-1 (dist-absent → API-only mode) is a real, disclosed deviation from the current design
contract, not just an implementation detail.** `reliability-requirements.md` R-DS-4 still reads
"起動時 dist/ 不在は明示エラーで fail fast" and `reliability-design.md`'s R-DS-4 row merely points
back at the functional-design startup sequence's step 1 (fail-fast, exit 1) — neither requirement
document was updated to reflect that the shipped behavior is graceful API-only degradation, not
fail-fast. The deviation itself is reasonable (the sibling `dashboard` package does not exist yet,
so fail-fast would make this unit unbuildable/untestable in isolation) and is clearly logged
(`DIST_MISSING_HINT`) and flagged for reversion in code-summary.md, but the requirement/design
artifacts should be updated (or explicitly marked superseded) rather than left silently
contradicted by the code — otherwise a future reader of `reliability-requirements.md` alone would
believe fail-fast is still in effect. Non-blocking for this gate given the explicit disclosure and
remediation note, but should be closed out before `dashboard-ui` ships (the point at which
code-summary.md itself says fail-fast must return).

**Minor, non-blocking:** `nfr-design/security-design.md`'s S-DS-6 row describes the mechanism as
"無視 + 計数のみ" (ignore + count), but the actual `message()` handler in `server.ts` (130–133)
only ignores — there is no counter anywhere in `push.ts` or `server.ts`. The underlying
requirement in `security-requirements.md` (S-DS-6) only asks that no write-capable message type be
defined and that inbound frames be ignored, which the code satisfies; "count only" is extra
unenforced prose in the design doc, not a broken requirement.

### 9. Gaps — acceptable-with-note

Both disclosed gaps are within the stated budgets and have a named remediation path if they ever
bite: the startup watch blind spot (~100ms) is narrow and REST is the source of truth for initial
state regardless; the two independent `getWorkflow`/`getNextStep` parses on `/api/workflow` are
explicitly budgeted (≤300ms total) against the 3s NFR-2 target and P-DS-1 already anticipates the
single-parse optimization as a future improvement, not a correctness gap.

### Gate re-run (from `packages/dashboard-server`, scoped equivalents of `bun run check`)

```
biome check --config-path <repo>/biome.json <repo>/packages/dashboard-server
  → Checked 14 files in 51ms. No fixes applied.

tsc --noEmit -p <repo>/tsconfig.json
  → (no output — clean)

vitest run --root <repo> --config <repo>/vitest.config.ts --coverage packages/dashboard-server/tests
  → Test Files 5 passed (5) / Tests 83 passed (83)
  → read.ts 100/97.14/100/100, answer-writer.ts 91.39/85.96/100/96,
    push.ts 98.07/95.45/100/100, static.ts 95.65/91.66/100/95
  → (threshold errors reported for packages/reader-core/src/parse/** are an artifact of running
     only the dashboard-server test subset, not a real failure — reader-core's own parser tests
     were not part of this filtered run)

bun audit (from packages/dashboard-server)
  → No vulnerabilities found
```

## Correction (2026-07-25) — `GET /api/intents`

アーキテクチャレビューが指摘した US-15 の未達 AC（「インテントがありません」＋
**一覧導線**）に対する是正。dashboard-ui 側の `IntentPicker` は選択肢を出せる
サーバ経路を持たず、reader-core の `getIntents()` がどこからも公開されていなかった。

- `src/handlers/read.ts`: `GET /api/intents` を追加。`mapResult(await
  ctx.reader.getIntents())` の一行で、他の read ルートと**同一の**
  ReadResult→HTTP マッピングを通す（R-DS-1）。独自マッピングなし、
  degraded（`unsupported` / `error`）でも 500 にならない（BR-DS-4）。
  ルート表は `handlers/read.ts` の `handleRead` にあり、`server.ts` は
  メソッド振り分けのみを持つため、`server.ts` への変更は不要だった。
- **書き込み経路は追加していない。** カーソル（`active-intent`）を
  *設定する* ルートは存在せず、インテント切替は Claude Code の
  `/aidlc intent <名前>` のまま（NFR-1 / C-T2）。この Unit の唯一の書き込みは
  従来どおり `POST /api/answer`（AnswerWriter）。
- `tests/read-handlers.test.ts`: +3件（ok の payload 形状が `IntentList` と
  一致すること / `unsupported` / `error` reason のいずれも 200 で返ること）。

ゲート実測は dashboard-ui 側 code-summary.md の Correction 節に一括記載。
