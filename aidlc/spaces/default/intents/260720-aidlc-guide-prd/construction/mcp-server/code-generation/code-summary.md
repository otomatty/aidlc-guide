# Code Summary — Unit: mcp-server

> code-generation (3.5) / Unit: mcp-server (kind: service, M) / 2026-07-25
> 実装場所: `packages/mcp-server/`
> 計画: `code-generation-plan.md`（全項目 [x]）
> 本ユニット完了で **M1 マイルストーン完了**

## 生成ファイル

| ファイル | 役割 | 行数 |
|---------|------|------|
| `src/index.ts` | bin。workspaceRoot 解決 → reader/bridge 生成 → 5ツール登録 → StdioServerTransport。process レベル例外リスナ（R-MS-1 第2層） | 112 |
| `src/render.ts` | `renderResult()` / `renderDegraded()` / `reasonText()` / `relativize()` / `toContent()`。**ReadResult→応答の唯一の写像** | 140 |
| `src/safe.ts` | `safeHandler()` — 例外→通常応答（R-MS-1 第1層） | 30 |
| `src/tools/status.ts` | M1（`reader.getWorkflow` のみ） | 43 |
| `src/tools/next-steps.ts` | M3（`reader.getNextStep` の唯一の呼出元） | 19 |
| `src/tools/explain-stage.ts` | M2（`bridge.resolveStage`） | 42 |
| `src/tools/read-artifact.ts` | M4（前段 `guardPath` → `reader.readArtifact`） | 36 |
| `src/tools/glossary.ts` | M5（`bridge.resolveTerm`） | 29 |
| `tests/*.test.ts`（5）+ `tests/support.ts` | 下記テスト構成 | 684 |
| `README.md` | `.mcp.json` 登録手順（bolt-plan B3 の DoD）+ ツール表 + 制約 | — |

リポジトリ側の変更:
- `biome.json` — read-only restricted-imports override の対象に
  `packages/mcp-server/src/**` を追加（S-MS-1 / BR-MS-1）
- `vitest.config.ts` — coverage exclude に `packages/mcp-server/src/index.ts` を追加
- `package.json`（ルート）— `overrides: { "@hono/node-server": "^2.0.5" }`（D-3 参照）

`shared-types` への追加はなし（既存の `ReadResult` / `WorkflowModel` / `NextStep` /
`StageDoc` / `TermDoc` で足りる。`ToolReply` は server 固有のためパッケージ内に置いた）。

## 品質ゲート実測（`bun run check`）

```
biome check .            Checked 95 files in 142ms. No fixes applied.
tsc --noEmit             (エラーなし)
vitest run --coverage    Test Files  34 passed (34)
                         Tests  489 passed | 2 skipped (491)
bun audit                No vulnerabilities found
```

（本ユニット着手前は 413 passed。mcp-server が 5 ファイル / **76 テスト**を追加。）

mcp-server の coverage（v8）:

| ファイル | Stmts | Branch | Funcs | Lines |
|---------|-------|--------|-------|-------|
| `render.ts` | 100 | 95.65 | 100 | 100 |
| `safe.ts` | 100 | 100 | 100 | 100 |
| `tools/*.ts`（5本） | 100 | 100 | 100 | 100 |
| `index.ts` | coverage 対象外（D-2） | | | |

`render.ts` の唯一の未到達分岐は `process.platform === "win32"` の三項
（1プロセスでは片側しか実行され得ない）。

リポジトリ全体: Statements 97.58% / Branches 94.39% / Functions 98.15% / Lines 99.06%。

## テスト構成

- `tools.test.ts`（46件）— **BR-MS-3 の表**。5ツール × {`unsupported`, 各
  `{error, reason}`} を `describe.each` で総当たりし、いずれも `isError` を持たない
  通常応答になることを assert（`expectNormalReply`）。加えて各ツールの成功形:
  status の phase/stage/gate/進捗 + `unparseable` 明示 + warnings、
  **`getNextStep` が呼ばれないこと**（`vi.fn().not.toHaveBeenCalled()` — M1 の委譲契約）、
  next_steps の完了分岐、explain_stage の excerpt 原文一致と slug 素通し、
  glossary の未定義、read_artifact の本文 verbatim・JSON 非併記・
  `no-active-intent` で reader に到達しないこと。
- `read-artifact-gate.test.ts`（4件）— 実 tmp ディレクトリに `<tmp>/rec/foo`（記録）と
  `<tmp>/rec/foobar`（prefix-confusion の兄弟）を作り、3ベクタ（`../` traversal /
  記録外の絶対パス / `/rec/foobar`）が**サーバ前段で拒否され `reader.readArtifact` に
  到達しない**ことを assert。「拒否されること」だけの assert では前段を消しても
  reader 内部の一次検査が通してしまうため、到達しないことを直接見る。
- `render.test.ts`（19件）— reason 表9件の網羅（日本語で、reason 文字列を素で
  露出しないこと）、`internal:` 正規化、未知 reason のフォールバック、
  絶対パスの相対化3ケース（native セパレータ / 逆セパレータ / 対象外パス）、
  warnings の「注意:」付与、unsupported 文面、verbatim モードの非改変・非複製、
  `toContent` の3形（data / degraded / なし）。
- `safe.test.ts`（5件）— 正常素通し、Error throw、非 Error throw、例外メッセージ中の
  絶対パス剥がし、引数の転送。
- `server-smoke.test.ts`（7件）— **子 Bun プロセスを SDK の実 MCP クライアント
  （`StdioClientTransport`）で実 stdio 越しに駆動**。5ツールの登録と description の
  「いつ使うか」文言、実ワークスペースに対する status / next_steps / explain_stage、
  未知 term が通常応答であること、traversal が通常応答であること、そして
  **isError が返るのは入力スキーマ違反のみ**（引数欠落・空文字）であること。

## 設計判断・逸脱

**D-1（決定）SDK は `McpServer` + `registerTool` を使用。**
設計文書は「SDK の Server」とだけ書くが、実装した SDK 1.29.0 では低レベル `Server` は
`setRequestHandler` の生ハンドリングになり、`tools/list` の組立と入力スキーマ検証を
自前で書くことになる。`McpServer` はその薄いラッパで、`registerTool` の
`inputSchema` が zod 検証を担うため、「isError はスキーマ違反のみ」（BR-MS-3 /
reliability-design.md「SDK の zod が担う」）を**設計どおり SDK 側に委ねられる**。
低レベル `Server` を選ぶとこの境界を自前実装することになり、設計意図から遠ざかる。

**D-2（決定）`src/index.ts` は coverage 対象外。**
モジュール本体でトランスポートを connect する bin のため、Vitest（Node 上）に import
できない。dashboard-server の `server.ts`/`cli.ts`、btw の `spawn.ts`/`cli.ts` と同じ
前例に倣って exclude し、代わりに実 stdio スモークで登録・description・応答・
スキーマ違反の isError まで実際に検証した（`server-smoke.test.ts`）。
理由は `vitest.config.ts` にコメントで明記済み。

**D-3（逸脱）ルート `package.json` に `overrides: { "@hono/node-server": "^2.0.5" }` を追加。**
`@modelcontextprotocol/sdk@1.29.0` は `@hono/node-server ^1.19.9` を推移依存に持ち、
これに moderate の advisory（GHSA-frvp-7c67-39w9 — Windows での `%5C` による
serve-static path traversal）がある。team.md のローカル品質ゲートは `bun audit` を
含むため、放置するとゲートが赤のままになる。本サーバは stdio のみで hono の
HTTP 経路を一切ロードしないため実影響はないが、**suppress（`--ignore` / 
`--audit-level`）ではなく override による実修正**を選んだ。SDK が上流で
`@hono/node-server` を 2.x に上げたら、この override は削除してよい。

**D-4（決定）zod を `packages/mcp-server/package.json` に明示的な依存として宣言。**
tech-stack-decisions.md は「SDK 同梱の zod（追加依存ではない）」と書くが、bun の
isolated install レイアウトでは推移依存を親パッケージから `import "zod"` で解決できない。
そのため SDK が解決するのと**同一の物理パッケージ**（4.4.3）を指す範囲
`^4.4.3` を宣言した。install closure に新しいパッケージは増えていない
（宣言のみ。`bun install` は "no changes"）。

**D-5（決定）`ToolReply.data` は MCP の `structuredContent` ではなく2つ目の text ブロック。**
SDK の `structuredContent` は `outputSchema` の宣言を要求し、5ツール分の出力スキーマを
zod で二重に持つことになる。BR-MS-6 が求めるのは「日本語テキスト + 構造化 JSON の併記」
であって MCP の structured-output 機能そのものではないため、
```json フェンス付きの2ブロック目として返す。`data` が無い場合は `degraded` を
同じ枠で返し、失敗理由も機械可読にした。

**D-6（決定）read_artifact だけ `verbatim` モードで応答する。**
成果物本文に対しては (1) パス相対化をかけない（利用者のファイル本文を書き換えるのは
BR-MS-4 に反する）、(2) `data` に複製しない（最大 10MB の本文を2重に載せると P-MS-3 の
整形予算を壊す）。`renderResult(..., { verbatim: true })` の1フラグで両方を表現し、
理由をコードコメントに残した。相対化は**サーバ生成テキスト**（エラー文・
status/next_steps/explain_stage/glossary の整形結果・例外メッセージ）にのみ適用する。

**D-7（決定）status は `unparseable` を応答に含める。**
business-logic-model.md の M1 出力仕様は phase/currentStage/gate/done/total のみだが、
`WorkflowModel.unparseable` を黙って落とすと、`done` が読めなかった場合に AI が
「21/32 完了」と自信を持って誤答する。NFR-6 の fail-soft は「縮退を表現する」ことなので、
解析できなかったフィールドを本文に明記した（テストで固定）。

**D-8（記録）M1 の `unit` フィールドは実装しない。**
business-logic-model.md の Review が非ブロッキングで指摘したとおり、`WorkflowModel` に
`unit` は存在しない。設計本文の指示どおり `currentStage` のみを返し、専用フィールドは
持たせていない。

## 既知のギャップ / 次段への申し送り

1. **P-MS-1〜4 の数値計測は未実施。** 本ステージでは構造（status は reader 1呼出、
   explain/glossary は reader を経由しない、起動時に FS を触らない）を実装・検証した。
   ≤300ms / ≤200ms / ≤500ms / 起動 ≤500ms の実測は tb-lxp フィクスチャに対する
   **performance-validation** ステージの担当。nfr-requirements の Review が指摘した
   「加算が ceiling にジャストフィットで余裕ゼロ」も、その実測時に再検討すること。
2. **R-MS-5（両 OS スモーク）は Windows のみ実施。** `server-smoke.test.ts` は
   `process.platform` を見て `bun.exe`/`bun` を切り替えるが、実行したのは Windows のみ。
   macOS での確認は build-and-test / performance-validation で行う。
3. **R-MS-3（未初期化ワークスペース）はユニットテスト側で担保。** 「起動成功 +
   各ツールが no-active-intent を返す」のうち、応答側は `tools.test.ts` の
   `no-active-intent` 行で、起動側は「起動時に FS を触らない」構造で満たしている。
   **空ディレクトリを cwd にした実起動スモークは未実施** — build-and-test の統合
   スモークに含めることを推奨。
4. **`aidlc_read_artifact` の `path` は記録ディレクトリ基準で、workspaceRoot 基準ではない。**
   AI が `aidlc/spaces/default/intents/<slug>/inception/...` と書くと拒否される
   （記録ディレクトリの外に見えるため）。description と README に明記したが、
   実運用で AI が誤りやすければ、拒否メッセージに記録ディレクトリの相対表記を
   添える改善余地がある。
5. **`bun audit` の override（D-3）は上流追随が必要。** SDK の更新時に
   `@hono/node-server` の要求が 2.x になったら、ルート `package.json` の `overrides`
   を削除する。放置しても害はないが、無用な固定は残さないほうがよい。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25

Adversarial re-verification against real code (not the summary's narrative), plus a
re-run of the quality gate scoped to this unit. Findings below are ordered by the
checklist in the review brief.

### 1. BR-MS-3 (isError reserved for schema violations only) — CONFIRMED

- `packages/mcp-server/src/render.ts:133-140` (`toContent`) never sets `isError`; the
  return type has no such field. Every `ReadResult` branch (`renderResult`/`renderDegraded`,
  `render.ts:93-129`) — `ok`+warnings, `unsupported`, `error` with any of the 9 known
  `reason` values plus the `internal:` and unknown-reason fallbacks — is mapped to an
  ordinary `{ text, data?, degraded? }`. No handler file (`tools/*.ts`) constructs or
  returns anything else.
- `packages/mcp-server/tests/server-smoke.test.ts:94-102` proves the boundary from the
  *outside*: a real spawned-Bun MCP client gets `isError: true` only for a missing
  required argument (`aidlc_explain_stage` called with no `slug`) and an empty string
  failing `z.string().min(1)` (`aidlc_read_artifact` with `path: ""`) — i.e., produced by
  the SDK's own zod `inputSchema` validation, never by handler code. I re-ran this suite
  (see "Gate re-run" below) and it passes.

### 2. BR-MS-5 / R-MS-1 (never die) — CONFIRMED

- `safeHandler` (`packages/mcp-server/src/safe.ts:15-30`) wraps every one of the five
  `server.registerTool` callbacks in `index.ts:43-88` (`safe(status)`, `safe(nextSteps)`,
  etc. — no tool is registered without going through `safe`).
- `index.ts:98-103` registers `unhandledRejection`/`uncaughtException` listeners that
  `log()` to stderr and do not call `process.exit`, matching `reliability-design.md:10`.
  `safe.test.ts` exercises the handler-level layer (Error throw, non-Error throw, argument
  forwarding); the process-level listeners are structural (registered, no exit call) and
  can't be unit-tested without killing the test runner, which is a reasonable limit.

### 3. M1 delegation — CONFIRMED

- `tools/status.ts:41-43` calls `reader.getWorkflow()` only; `next-steps.ts:17-19` is the
  sole caller of `reader.getNextStep()`.
- Enforced by test, not just by inspection: `tools.test.ts:95-99` stubs `getWorkflow` to
  succeed and passes a `vi.fn()` for `getNextStep`, then asserts
  `expect(getNextStep).not.toHaveBeenCalled()`. This is a real regression guard — the
  stub-reader helper (`tests/support.ts:23-38`) also makes any *unstubbed* method throw
  (`NOT_CALLED`), so a status handler that reached into `getNextStep` anywhere else would
  break other tests too.

### 4. S-MS-2 (read_artifact server-side pre-gate) — CONFIRMED, single implementation

- `tools/read-artifact.ts:1,28` imports `guardPath` from `@aidlc-guide/reader-core`.
  I opened `packages/reader-core/src/index.ts:30` (the single sibling file this unit's
  own design names as the integration point) and confirmed `guardPath` is a genuine named
  export of `./util/guard-path.ts`, and that `createReader`'s internal `readArtifact`
  (same file, line 143) imports and calls the *same* function — one implementation, two
  call sites, exactly as `business-logic-model.md:43-44` and `security-design.md:11`
  claim. Not a third copy.
- `guard-path.ts:17-22` rejects prefix confusion correctly via `path.relative` (not
  `startsWith`), which is what actually defeats `/rec/foobar` next to `/rec/foo`.
- `read-artifact-gate.test.ts` builds real temp directories and asserts, for all three
  vectors (`../` traversal, absolute path outside the record, `/rec/foobar` prefix
  confusion), that `reader.readArtifact` is **never called** — the stronger assertion the
  code-summary claims, not just "the reply says no."  I re-ran this suite; it passes.

### 5. S-MS-4 (absolute paths relativized on all reply paths) — CONFIRMED

- `relativize()` (`render.ts:45-49`) is applied in `renderDegraded` (line 102, for every
  `error`/`unsupported` reply), in `renderResult`'s success branch (line 120, non-verbatim)
  and its warnings (line 122), and in `safeHandler`'s caught-exception path
  (`safe.ts:25`). I could not find a text-producing path that skips it outside of the
  deliberate `verbatim: true` exception for `read_artifact`'s body (documented D-6,
  correctly justified — rewriting a user's own file content would violate BR-MS-4, and the
  gate-rejection replies for `read_artifact` still go through `renderDegraded`, which does
  relativize).
- `render.test.ts` covers native-separator and foreign-separator absolute paths, and
  `safe.test.ts:28-35` specifically covers the exception-message path.

### 6. BR-MS-4 (no summarization) — CONFIRMED

- `explain-stage.ts:31` and `glossary.ts:18` both append `doc.excerpt` verbatim (no
  string transformation) when non-null; the five static fields above it are template
  strings, not paraphrases. `tools.test.ts:154-155` asserts the excerpt appears
  byte-for-byte (`toContain(STAGE_DOC.excerpt as string)`).

### 7. S-MS-1/S-MS-3 — CONFIRMED

- No write-`fs` imports anywhere under `packages/mcp-server/src`; `biome.json:101-107`
  scopes the `noRestrictedImports` override to include
  `"packages/mcp-server/src/**"` alongside reader-core/shared-types/docs-bridge. I re-ran
  `biome check` against the package directory and it passed clean (15 files, no fixes).
- Only `StdioServerTransport` is imported/constructed in `index.ts`; no `Hono`, no
  `node:http`, no `listen` call anywhere in the package.

### 8. FR-2.1–2.5 coverage — CONFIRMED, one traced (non-blocking) gap

- All five tools are registered in `index.ts:43-88` with Japanese descriptions that state
  when to use them; `server-smoke.test.ts:52` enforces the "いつ使うか" convention via
  regex against the live `tools/list` response.
- `requirements.md:38` (FR-2.1 AC) names a `unit` field alongside phase/stage/gate/count
  that `status.ts`'s `describe()` does not emit, because `WorkflowModel`
  (`reader-core/functional-design/domain-entities.md`, per the contract) has no `unit`
  field. This is not a fresh gap: `business-logic-model.md`'s own Review section (this
  unit's functional-design artifact, lines 78-83) already surfaced it as a pre-existing,
  non-blocking finding, and `code-summary.md`'s D-8 records the implementation
  deliberately following the upstream design text rather than inventing an ungoverned
  field. Carrying a known, already-adjudicated gap forward with a paper trail is
  reasonable; I flag it here only so it doesn't get lost, not as new grounds for
  NOT-READY.

### 9. Tests — CONFIRMED, re-run independently

Scoped re-run (root `bun run check` is refused by this review's sandboxing; ran the
package-scoped equivalent instead — commands and full output below):

```
bunx biome check C:\work\aidlc-guide\packages\mcp-server
  → Checked 15 files in 31ms. No fixes applied.

bunx tsc --noEmit -p C:\work\aidlc-guide\tsconfig.json
  → (no output — clean)

bunx vitest run --config C:\work\aidlc-guide\vitest.config.ts --root C:\work\aidlc-guide \
  --coverage packages/mcp-server
  → Test Files  5 passed (5)
  → Tests  76 passed (76)
  → mcp-server/src coverage (per-file, from the JSON summary):
      render.ts   100/95.65/100/100 (stmts/branch/funcs/lines)
      safe.ts     100/100/100/100
      tools/*.ts  100/100/100/100 (all five)
    (index.ts correctly absent — excluded per vitest.config.ts:25, covered instead by
    the spawned-Bun smoke test)
    matches code-summary.md's claimed numbers exactly.

bun audit
  → No vulnerabilities found
```

The `server-smoke.test.ts` suite genuinely exercises the SDK boundary rather than
asserting on stubs: it spawns a real `bun` child process running the actual
`src/index.ts` bin and drives it over real stdio with the SDK's own `Client` +
`StdioClientTransport` (`server-smoke.test.ts:20-32`), then calls `listTools` and
`callTool` against the live process — including the two zod-triggered `isError: true`
cases. This is the right instrument for the one claim unit tests structurally cannot
make (that the SDK's own validation layer, not application code, produces `isError`).

Coverage report caveat: I could not run the whole-repo `vitest run --coverage` (blocked
by this review's path-scoping sandbox), so the repo-wide "97.58%/94.39%/98.15%/99.06%"
figure in code-summary.md is not independently re-verified here — only the mcp-server-local
numbers are, and they match exactly.

### 10. Deviations D1–D6 — sound; D3 flagged for blast radius, not for correctness

- **D-1** (`McpServer`/`registerTool` over low-level `Server`): sound. Confirmed the SDK
  version in use (`@modelcontextprotocol/sdk@1.29.0`, verified via `bun pm ls --all`) and
  that this is exactly the choice that lets `BR-MS-3`'s isError boundary be enforced by
  the SDK's zod layer rather than hand-rolled — consistent with `reliability-design.md:11`.
- **D-3** (`@hono/node-server` root override): the fix works — `bun pm ls --all` resolves
  `@hono/node-server@2.0.11` / `hono@4.12.32` tree-wide (satisfying `^2.0.5`), and
  `bun audit` is clean. Worth naming explicitly: this override lives in the **root**
  `package.json`, so its blast radius is the whole monorepo, not just this stdio-only unit
  that never loads hono's HTTP code path — any other package that *does* serve HTTP via
  `@hono/node-server` (e.g. dashboard-server) is silently bumped too. That's a reasonable
  and common way to clear a `bun audit` gate for a transitive SDK dependency, and the
  install resolved to a single version with no conflicts, but it's a repo-wide change
  landing inside a single-unit code-generation stage rather than an infra-design/shared
  decision — worth the team's awareness, not a defect. D-3's own text already names the
  upgrade path (drop the override once the SDK bumps its own requirement), which is the
  right mitigation.
- **D-4** (explicit zod dependency): sound and verified — `bun pm ls --all` shows exactly
  one resolved `zod@4.4.3` in the tree, confirming "same physical package, no duplicate
  install" rather than a version-drift risk.
- **D-2, D-5, D-6**: consistent with the code as read (index.ts coverage-excluded and
  covered by the real smoke test instead; `data` as a second text block avoids a second
  zod `outputSchema` per tool; `read_artifact` alone runs `verbatim` and the reasoning —
  don't rewrite a user's own file content, don't duplicate a 10MB body into `data` — holds
  up against `render.ts`'s actual `RenderOptions` implementation).
- **D-8** (status omits `unit`): see item 8 above — traced to an already-adjudicated,
  non-blocking upstream finding, not a fresh deviation.

### Verdict rationale

Every claim in `code-generation-plan.md` and `code-summary.md` checked against this
review's brief holds up against the real code and a real (scoped) gate re-run: the
fail-soft/isError boundary is genuine and SDK-enforced, the M1/M3 delegation split is
test-enforced, the path guard is a true single-implementation double call (verified via
the named reader-core export), path relativization covers every server-generated reply,
and BR-MS-4 verbatim-excerpt behavior is real. No circular dependencies, no unresolved
cross-references, no gap between what the design promises and what the code does that
isn't already named and justified in code-summary.md's own deviation log. A developer
could build or extend this unit from `logical-components.md` + this code without further
architect guidance.
