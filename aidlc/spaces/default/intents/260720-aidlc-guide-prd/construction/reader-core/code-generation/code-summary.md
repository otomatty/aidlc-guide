# Code Summary — Unit: reader-core

> code-generation (3.5) / Unit: reader-core / 2026-07-25
> 実装: `packages/shared-types/` + `packages/reader-core/`（bun workspaces）

## 生成ファイル

### `packages/shared-types/`（型のみ・ランタイムコードゼロ）
| ファイル | 内容 |
|---------|------|
| `src/index.ts` | 全公開型（138行）。`ReadResult<T>`（`warnings?`）/ `StandardReason` / `StageStatus` / `Phase` / `Verdict` / `StageInfo` / `WorkflowModel` / `NextStep` / `MatrixCell` / `Matrix` / `AuditEvent` / `IntentList` / `ChangeEvent` / `WatchWarning` / `WatchEvent` |
| `package.json` / `tsconfig.json` | private・`types` エントリのみ（ビルド成果物に出ない） |

### `packages/reader-core/src/`（logical-components.md のモジュール表どおり）
| ファイル | 責務 | 主要 ID |
|---------|------|--------|
| `util/with-result.ts` | throw→`{error, reason:"internal: …"}` 正規化 | R-RC-1 |
| `util/read-bounded.ts` | `stat`→10MB 超は読取**前**拒否→read、BOM strip、verdict 用 tail 4KB 読み | S-RC-4 / R-RC-3 / P-RC-2a |
| `util/guard-path.ts` | `resolve`→`relative`→`realpath` 再検査の containment（公開 named export） | S-RC-2 |
| `parse/state.ts` | G-1〜G-6。`parseState`（純関数）/ `readState`（FS 入口）に分離 | BR-RC-4 / C-T3 |
| `tree/matrix.ts` | `buildMatrix` / `buildMatrixForUnit`。除外集合は引数 | BR-RC-4 / P-RC-2a/2b |
| `audit/events.ts` | シャード抽出・降順マージ・シャード skip + warnings | 失敗モード⑤ |
| `intents/resolve.ts` | cursor 解決（4態）+ `resolveRecordDir` | 失敗モード①② |
| `watch/watcher.ts` | chokidar + 300ms trailing debounce + scope 分類 + 再購読3回 | FR-1.5 / R-RC-4 |
| `index.ts` | `createReader` ファサード7メソッド。recordDir 毎回再解決 | L7 |

実装コード合計 1,055 行（型 138 行を含む）。

### `packages/reader-core/tests/` — 11 テストファイル + 6 フィクスチャ群
`parse-state` / `guard-path` / `read-bounded` / `with-result` / `matrix` / `audit` / `intents` / `watch` / `watch-resubscribe` / `reader` / `dependency-direction`。
フィクスチャ: `golden`（実 State Version 7 のピン留めコピー）, `unsupported-version`, `no-version`, `truncated`, `degraded`, `total-mismatch`, `state-not-a-file`, `record`（合成ミニ記録）。

### ゲート統合（既存ファイルへの変更）
- `biome.json` — reader-core/shared-types 用 `noRestrictedImports` override を追加（fs write 系を構造禁止 — S-RC-1）
- `vitest.config.ts` — `packages/reader-core/src/parse/**` にブランチ床 95% を設定（閾値が実際に fail することを確認済み）
- `package.json` — `check` を `vitest run --coverage` に変更（カバレッジ床をローカル品質ゲートに含める）

## 実装判断（設計からの逸脱・補足）

1. **`readBounded` の戻り型を `ReadResult<string>` より狭くした** — 有界読取は `unsupported` になり得ないため `BoundedRead` を定義。呼出側が起こり得ない分岐を扱わずに済む。公開 API の型は設計どおり。
2. **`readArtifact` は guardPath → readBounded の順**（nfr-design/logical-components.md のデータフロー注記に従い、business-logic-model L6 の step 番号とは逆順）。記録外パスには `stat` すら発行しない。
3. **`WorkflowModel.phase` は `Phase` のまま**（`Phase | null` に広げていない）。欠落・未知値のときは `"INITIALIZATION"` を入れ `unparseable.phase` に理由を記録する。消費者は `unparseable.phase` を先に見る必要がある — domain-entities.md の型を変えないための措置。
4. **execution 列が `EXECUTE`/`SKIP` 以外の行**は G-3 に規定がないため、`unparseable: "unknown-execution: …"` を付けたうえで `SKIP` として扱う（G-6 の EXECUTE 集計を汚さないため）。
5. **監査シャードの列挙を `isFile()` でなく拡張子のみで行う** — シャード名を占有する非ファイルが黙って消えるより、`warnings` に出るほうが fail-soft の趣旨に合う（テストの「読取不能シャード」フィクスチャもこれを使う）。
6. **`buildMatrix` はユニット単位で並列化**。逐次実装では実記録（298 md）で 1,573ms（P-RC-2a の 2秒に対して余裕なし）だったが、`Promise.all` で **26ms** に短縮。
7. **`parse/state.ts` を純関数 `parseState` と FS 入口 `readState` に分割** — G 規則の各分岐を FS なしでブランチ網羅するため。
8. **watch は `classifyScope`（純関数）/ `createChangeQueue`（デバウンス）/ `watch`（購読）の3層** — 分類とタイミングを fake timers で、購読と dispose を実FS とスタブで別々に検証できる。

## テスト結果（実出力・`bun run check`）

```
 Test Files  16 passed (16)
      Tests  177 passed (177)

File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
 reader-core/src   |   96.77 |    94.73 |     100 |   98.03 |
  index.ts         |   96.77 |    94.73 |     100 |   98.03 | 159
  intents/resolve  |   96.15 |    94.44 |     100 |     100 | 58
  parse/state.ts   |     100 |    98.82 |     100 |     100 | 86
  tree/matrix.ts   |   97.61 |    78.57 |     100 |     100 | 34,52,101
  guard-path.ts    |    87.5 |       80 |     100 |     100 | 20,47
  read-bounded.ts  |   96.29 |      100 |      75 |   95.65 | 50
  watcher.ts       |   98.55 |     92.3 |   85.71 |     100 | 97-113

Statements   : 97.95% ( 432/441 )
Branches     : 95.72% ( 269/281 )
Functions    : 96.47% ( 82/85 )
Lines        : 99.23% ( 387/390 )

bun audit: No vulnerabilities found
```

**パーサ（`parse/state.ts`）のブランチカバレッジ = 98.82%**（team.md「パーサはブランチ重視」の要求）。床 95% を `vitest.config.ts` の閾値で強制しており、床を 99.5% に上げると実際に `ERROR: Coverage for branches (98.82%) does not meet … threshold` で fail することを確認済み（ゲートが機能していることの検証）。

`biome check` / `tsc --noEmit` / 177 テスト / `bun audit` すべて green。

## 上流仕様との差異（要確認）

- **実 state ファイルに `Total Stages` 不一致は存在しない。** 指示では「実ファイルが 21 vs 実カウントの不一致を持つ」とされていたが、実測では `Total Stages: 21` と EXECUTE 行数 21 が一致する（32 checkbox 行のうち EXECUTE が 21）。したがって G-6 の warning 経路は実データでは発火せず、専用フィクスチャ `total-mismatch`（99 vs 2）で検証している。ゴールデンテストは「不一致なし・warnings なし」を明示的に assert している。

## 既知のギャップ / 次ステージへの申し送り

1. **`tree/matrix.ts` のブランチ 78.57%** — 未到達は「tail 読取が null を返す経路」（readdir と読取の間にファイルが消えるレース）と ENOENT 以外の errno 分岐。移植性のあるフィクスチャで再現できないため未カバー。行カバレッジは 100%。
2. **`guard-path.ts` のブランチ 80%** — symlink テストは Windows で Developer Mode / 管理者権限がないと `symlink()` が失敗するため graceful skip する設計（この環境では skip された）。POSIX か Developer Mode 有効な Windows では該当分岐が走る。**build-and-test で片方の OS で symlink 経路を実走させることを推奨。**
3. **性能は未計測（ベンチ未実装）** — P-RC-1〜7 の Vitest ベンチは本ステージのスコープ外。実記録に対する手計測では `buildMatrix` 全走査 26ms（P-RC-2a 予算 2,000ms）。正式計測は performance-validation（US-20）。
4. **`getNextStep().requirement` はステージ status からの定型文** — 「そこで人間に求められること」の本来のデータ源は docs-bridge（US-23 / M2）。docs-bridge 実装後にリッチ化する余地がある（reader-core 側の契約は変えずに済む）。
5. **`createReader().watch()` は recordDir 解決が非同期**のため、購読開始が 1 tick 遅れる。dispose がその前に呼ばれても購読しない（テスト済み）。消費者が「購読完了」を待ちたい場合は将来 `watchAsync` を足す余地あり — 現時点で要求はない。
6. `packages/reader-core/aidlc/…/.tsbuildinfo` はハーネスの sensor が生成したスクラッチ（`.gitignore` 対象）。本ユニットの成果物ではない。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25

`bun run check` re-run live: `biome check` 46 files no fixes, `tsc --noEmit` clean, Vitest 16 files / 177 tests passed, coverage 97.95%/95.72%/96.47%/99.23% (stmt/branch/func/line) with `packages/reader-core/src/parse/**` at 98.82% branch (≥95% floor enforced in `vitest.config.ts:16-21`), `bun audit` — No vulnerabilities found. All figures match `code-summary.md:52-70` verbatim.

Evidence for the ten check areas:

1. **G-1..G-6 fidelity** — traced `parse/state.ts:61-198` against `aidlc-state.md` (the real live file) and the golden fixture (`tests/fixtures/golden/aidlc-state.md`). G-2 version gate at `state.ts:139-141`; G-3 six-mark table at `state.ts:33-40` maps 1:1 to `shared-types/src/index.ts:40-46`; G-4 phase-heading gating at `state.ts:75-81`; G-5 done-field-first-fallback at `state.ts:163-166`; G-6 total-field-first + mismatch warning at `state.ts:171-177`. `tests/parse-state.test.ts:22-67` golden-asserts every field against the pinned real-format copy, and `tests/parse-state.test.ts:274-313` (`total-mismatch` fixture) exercises the disagreement path end to end.
2. **BR-RC-2 no-throw** — every module-level I/O call that can throw (`stat`, `readFile`, `readdir`, `realpath`, `chokidarWatch`) is already inside a local `try/catch` in its owning module (`read-bounded.ts:38-51`, `guard-path.ts:44-50`, `tree/matrix.ts:45-53`/`84-93`, `intents/resolve.ts:38-46`, `watch/watcher.ts:108-121`), so none of the individually-exported functions (`readState`, `buildMatrix`, `resolveIntents`, `readAuditEvents`, `guardPath`) throw on their own. `index.ts` additionally wraps every `Reader` method body in `withResult` (`index.ts:96-165`) as the documented last line of defence (`with-result.ts:6-9`). `tests/reader.test.ts:247-273` drives all 7 methods over 8 pathological record paths and asserts only `ok`/`error`/`unsupported` ever come back.
3. **BR-RC-1/S-RC-1 zero writes** — `biome.json:101-169` adds a `noRestrictedImports` override scoped to `packages/reader-core/src/**` and `packages/shared-types/src/**` banning every fs write import name (`writeFile`, `mkdir`, `rm`, `rename`, `symlink`, `chmod`, …). Confirmed live: the override is real config, not just a doc claim, and `tests/dependency-direction.test.ts:63-70` independently greps the compiled source text for the same write-API names as a structural backstop. `package.json:11-14` declares only `@aidlc-guide/shared-types` and `chokidar` as dependencies, matching `dependency-direction.test.ts:72-80`.
4. **guardPath** — `guard-path.ts:17-22`'s `contains()` is `path.relative`-based, not `startsWith`; rejects `../` (rel starts with `..`), an absolute out-of-root target (`path.isAbsolute(rel)`), and specifically the `/rec/foobar`-vs-`/rec/foo` prefix-confusion case via the same relative-path check. `tests/guard-path.test.ts:82-98` and `tests/watch.test.ts:33-37` (`classifyScope` uses the identical relative-path pattern at `watcher.ts:28-31`) both assert the sibling-prefix case is rejected, not just described.
5. **readBounded** — `read-bounded.ts:33-52` is the single stat-before-read helper; `parse/state.ts:202`, `index.ts:145` (`readArtifact`), and `audit/events.ts:51` (per-shard) all route through it, giving the 10MB bound on all three paths as required by S-RC-4. `tests/reader.test.ts:208-222` exercises the bound on both `readArtifact` and `getWorkflow` with a >10MB fixture.
6. **buildMatrix/buildMatrixForUnit** — `tree/matrix.ts:76-79`/`58-62` take `constructionStageSlugs` as a parameter, sourced from the parsed `WorkflowModel` in `index.ts:108-111`, not hardcoded — matches BR-RC-4's stated exception. Verdict extraction walks files newest-name-last and reads only the tail (`matrix.ts:31-40`, using `readTail`'s 4KB window). `buildMatrixForUnit` is a real, separately-invoked code path: `tree/matrix.ts:99` calls it per-unit inside `buildMatrix`'s `Promise.all`, and `tests/matrix.test.ts:92-112` covers it as the standalone change-driven entry point.
7. **Facade** — `index.ts:85-88` re-resolves `recordDir` on every call (no memoization variable holds it across calls); `tests/reader.test.ts:226-245` proves an intent-cursor switch is visible on the very next call. The 5 record-dependent methods (`getWorkflow`, `getMatrix`, `getAuditEvents`, `getNextStep`, `readArtifact`) all short-circuit to `{error, reason:"no-active-intent"}` via the shared `recordDir()` closure; `getIntents` alone bypasses it (`index.ts:96`) — `tests/reader.test.ts:130-144` (mode 1) confirms exactly this split.
8. **watch** — 300ms trailing debounce coalesced per-scope in `createChangeQueue` (`watcher.ts:50-76`), scope classification in `classifyScope` (`watcher.ts:27-38`), resubscribe ladder capped at `maxResubscribes` with a `watch-warning` on exhaustion (`watcher.ts:123-132`), and `disposed` flipped before `watcher.close()` so no post-dispose callback fires (`watcher.ts:139-144`). All four are exercised by dedicated tests, not just asserted: `tests/watch-resubscribe.test.ts:61-94` drives the ladder through a chokidar stub, `tests/watch.test.ts:161-171` proves no callback survives dispose on a real filesystem.
9. **Tests** — `US-15`'s 5 failure modes each have both a unit-level test (`parse-state.test.ts`, `matrix.test.ts`, `audit.test.ts`, `intents.test.ts`) and a facade-level test in `tests/reader.test.ts:129-182` naming the mode by number. Read through all 11 test files; none are tautological — each asserts concrete values traceable to a real or synthetic fixture (e.g. `matrix.test.ts:32-37` asserts the specific `unit-alpha`/`unit-beta` verdicts from `tests/fixtures/record/`, not just "a verdict exists"). `vitest.config.ts:16-21` sets a 95% branch/statement/function/line floor scoped to `packages/reader-core/src/parse/**`, confirmed live at 98.82% branch in this run, and `code-summary.md:73` records that the team actually raised the floor to 99.5% to verify the gate fails — a real gate, not a decorative one.
10. **Deviations** — all five documented deviations (`code-summary.md:40-47`) hold up against the code: narrower `BoundedRead` type (`read-bounded.ts:20-22`), guardPath-before-readBounded ordering in `readArtifact` (`index.ts:141-145`, matching `logical-components.md:31`'s explicit override note), `phase` defaulting to `"INITIALIZATION"` with `unparseable.phase` set (`state.ts:156-160,187`), unknown-execution rows degrading to `SKIP` with an `unparseable` note rather than inflating the EXECUTE tally (`state.ts:99,109`), and audit shard selection by `.md` extension rather than `isFile()` so a broken shard surfaces as a warning instead of vanishing (`audit/events.ts:39-42`, exercised by `tests/fixtures/record/audit/unreadable-shard.md/placeholder.md` — a directory occupying a `.md` name — via `audit.test.ts:34-37`). `buildMatrix`'s parallelization across units (`matrix.ts:98-100`) is a sound, disclosed, measured (1573ms→26ms) deviation that stays within the P-RC-2a budget with headroom.

One non-blocking observation, not a NOT-READY finding: `parse/state.ts:134` calls `scan(text)` unconditionally before the G-2 version check at `state.ts:139`, so the full line-oriented scan of the document *does* run ahead of the unsupported-version gate — contradicting the code's own comment at `state.ts:136-138` ("Version gate first... no partial parse of a format we do not know") and business-rules.md's G-2 phrasing ("以降のパースを試みない"). In practice this is harmless: `scan()`'s regexes are simple (no catastrophic-backtracking risk), and the discarded `doc` never leaks into the `{unsupported, version}` return, so no output-level contract is broken and no security boundary is crossed. Worth a one-line comment fix or reordering next time this file is touched, but it does not block readiness.

No circular dependencies, no broken cross-references, no unauthorized deviations, and no gap between the claimed and actual `bun run check` output were found. The unit is implementable-as-specified and matches its design contracts.

## Post-review resolution (lead, 2026-07-25)

レビューの非ブロッキング指摘（「G-2 の version gate より前に `scan(text)` が走るのはコード自身のコメントと矛盾する」）を検討し、**コメント側を修正**した。順序を入れ替える案は破棄: G-2 の State Version は `## Project Information` セクション内に限定される（セクション外の同名フィールドは無視するテストが存在）ため、セクション分割なしにはフィールドを特定できない。スキャンは解釈を伴わない単一線形パスであり、unsupported 時にモデルは破棄される — その事実をコメントに明記した（`parse/state.ts`）。ゲートは green を維持（177 tests、parser branch 98.82%）。
