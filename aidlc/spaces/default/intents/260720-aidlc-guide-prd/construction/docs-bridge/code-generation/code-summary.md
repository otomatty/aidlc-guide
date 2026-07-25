# Code Summary — Unit: docs-bridge

> code-generation (3.5) / Unit: docs-bridge (kind: library, S) / 2026-07-25
> 計画: `code-generation-plan.md`（全項目 [x]）

## 生成ファイル

| ファイル | 役割 | 由来 |
|---------|------|------|
| `packages/docs-bridge/package.json` | ワークスペースパッケージ定義。第三者ランタイム依存ゼロ | tech-stack-decisions.md |
| `packages/docs-bridge/tsconfig.json` | ルート tsconfig を継承 | 既存規約 |
| `packages/docs-bridge/data/bridge-map.json` | **対応表の単一ソース**。sourceVersion + 32 ステージ + 9 用語 | BR-DB-1 / BR-DB-4 |
| `packages/docs-bridge/src/config.ts` | D1 `loadConfig(configPath?)` | business-logic-model D1 |
| `packages/docs-bridge/src/excerpt.ts` | GitHub 形式 anchor 正規化・見出しスライス・封じ込め検査 | BR-DB-2 / S-DB-2 |
| `packages/docs-bridge/src/resolve.ts` | D2/D3 `resolveStage(config, slug)` / `resolveTerm(config, term)` + 凍結 map | D2 / D3 / R-DB-3 |
| `packages/docs-bridge/src/links.ts` | D4 `projectLinks(config)` | D4 |
| `packages/docs-bridge/src/index.ts` | `createBridge(configPath?)` と公開4メソッド | logical-components.md |
| `packages/docs-bridge/tests/paths.ts` | テスト共通ヘルパ（`expectOk` / `expectError` / 各ルート） | reader-core の tests/paths.ts に倣う |
| `packages/docs-bridge/tests/{config,excerpt,resolve,bridge,data-lint}.test.ts` | 5 テストファイル | domain-entities.md テスト境界 |
| `packages/docs-bridge/tests/fixtures/docs/guide.md` | 見出し境界・フェンス・`&` を含む検証用 docs | — |
| `packages/docs-bridge/tests/fixtures/outside/secret.md` | docs ルート外の到達不能ファイル（S-DB-2 検証用） | — |

## 変更した既存ファイル

| ファイル | 変更 | 理由 |
|---------|------|------|
| `packages/shared-types/src/index.ts` | `ProjectLink` / `BridgeConfig` / `DeepLink` / `StageDoc` / `TermDoc` を追加 | domain-entities.md「型定義（shared-types に追加）」 |
| `packages/reader-core/package.json` | `"./util/*": "./src/util/*.ts"` サブパス export を追加 | `guardPath` / `withResult` を chokidar を引き込まずに共有するため（下記 D-1） |
| `biome.json` | read-only restricted-imports の override に `packages/docs-bridge/src/**` を追加 | S-DB-1 |
| `tsconfig.json` | `resolveJsonModule: true` | bridge-map.json の静的 import（R-DB-1 のビルド時型検査） |
| `bun.lock` | ワークスペース追加に伴う更新 | — |

## 主要な実装判断

1. **bridge-map.json は静的 import + `Object.freeze`**。TS の `BridgeMap` 注釈が
   ビルド時のスキーマ検査になり（R-DB-1「実行時に壊れた同梱 map という状態は
   構造的に存在しない」）、freeze が消費者間の相互汚染を防ぐ（R-DB-3）。
   実行時の `{error}` 経路は docs 読取と config だけに閉じている。
2. **節スライスは「同レベル**以浅**の見出しで打ち切り」**に拡張した。設計文は
   「次の同レベル見出しまで」だが、親見出しは常に子の節を閉じるので、同じ規則を
   反対側から見たもの。これがないと `## X` の節が親の `# Y` を越えて流れ出す。
3. **コードフェンス内の `#` は見出しとして扱わない**。aidlc のステージファイルは
   完了メッセージ雛形を ```` ``` ```` で囲って持っており（例
   `build-and-test.md` の `# :hammer: Build and Test Complete`）、フェンスを無視
   すると節が実在しない見出しで途中打ち切りになる。
4. **anchor 正規化は GitHub 準拠**（小文字化 → 記号除去 → 空白をハイフン）。
   記号を消しても前後の空白は残るため `A & B` → `a--b` になる。レンダリング済み
   ページからコピーした anchor がそのまま解決するのを優先した。非 ASCII
   （日本語見出し）も残す。
5. **`createBridge` は「遅延 1 回ロード」**。構築時にファイルを触らない
   （P-DB-3: first paint のクリティカルパスに乗らない）。最初のメソッド呼出で
   loadConfig を実行し、結果を memoize する。失敗も memoize する（壊れた config を
   カード展開のたびに読み直しても同じエラーになるだけ）。
6. **config の warning は各メソッドの結果に合流させる**。`docsRepoPath` が存在
   しない場合、`resolveStage` の結果に「docs が無いので excerpt 無し」の理由が
   付いてこないと、消費者はリンク切れの原因を表示できない（BR-DB-3 の縮退表示）。
7. **相対 `docsRepoPath` は config ファイル自身のディレクトリ基準**で解決する。
   cwd 基準だと、サーバをどこから起動したかで挙動が変わる（BR-DB-6 / NFR-4）。
8. **config の扱いは「不在は正常・不正は即エラー」**。ファイル不在は既定値で
   `{ok}`、JSON 不正／型不正は `config-invalid`。`projectLinks` の個別要素だけは
   落として warning に留める（1件の typo で全リンクを失わせない）。

## テスト結果（実測 — `bun run check`）

```
$ biome check . && tsc --noEmit && vitest run --coverage && bun audit
Checked 60 files in 65ms. No fixes applied.

 RUN  v4.1.10 C:/work/aidlc-guide
      Coverage enabled with v8

 Test Files  21 passed (21)
      Tests  309 passed (309)
   Duration  3.15s

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   98.42 |    95.38 |   97.27 |    99.4 |
 docs-bridge/src   |     100 |    94.25 |     100 |     100 |
  excerpt.ts       |     100 |     87.5 |     100 |     100 | 56,59,112
  resolve.ts       |     100 |    93.75 |     100 |     100 | 49
-------------------|---------|----------|---------|---------|-------------------
Statements   : 98.42% ( 562/571 )
Branches     : 95.38% ( 351/368 )

bun audit v1.3.6
No vulnerabilities found
```

docs-bridge 単体: 132 tests / 5 files。行・文カバレッジ 100%、分岐 94.25%。
未到達分岐は防御コード（フェンス記号の fallback、`docPath === ""` の
deepLink=null 経路）で、現データでは到達しない。

**data-lint は skip されず実際に実行され pass している**（`.claude/aidlc-common/stages`
が本リポジトリに存在するため）。32 ステージ + 9 用語の全 docPath/docAnchor が実在
ファイルの実在見出しに解決し、かつ各 docPath が当該 slug の frontmatter を持つ
ファイルであることを検証済み。

## 設計からの逸脱（D-n）

- **D-1: BR-DB-5「reader-core 非依存」を破り、`guardPath` / `withResult` を
  reader-core から共有した。** security-design.md は「shared util として共有」と
  「アルゴリズム複製」の2案を挙げ後者を既定としていたが、本ステージのリード指示
  で前者（複製せず再利用）が明示された。複製しないため「テストベクタを両 Unit で
  共通化して等価性を担保」という条項は不要になった（実装が1つしかない）。
  ビルド依存の増加を避けるため、reader-core に `"./util/*"` サブパス export を
  足して該当モジュールだけを import している — root export 経由ではないので
  chokidar は docs-bridge に入らず、第三者ランタイム依存ゼロは維持されている。
  **ユニット DAG 上は docs-bridge → reader-core の依存が1本増える**（並行ビルドの
  前提が変わる）ので、architect の確認を要する。
- **D-2: `docPath` の指す先が `docs/` ではなく `.claude/aidlc-common/` 等になった。**
  ブリーフは「`docs/` 配下の実在ファイルを指す」としていたが、本リポジトリの
  `docs/` には `docs/prd/PRD.md` 1件しか無く、CLAUDE.md が参照する
  `docs/guide/` `docs/reference/` は aidlc-workflows 側のリポジトリ（外部依存 E2）
  にあって本リポジトリには存在しない。存在しないパスを書けば data-lint が必ず
  落ちるため、**本リポジトリに実在し、かつ任意の aidlc ワークスペースに必ず存在
  する** ステージ定義ファイル自身（`.claude/aidlc-common/stages/<phase>/<slug>.md`）
  と protocols / knowledge を deep-link 先にした。副次的な利点として、
  `docsRepoPath` にフレームワークの docs リポジトリを別途 clone しなくても、
  ユーザ自身のワークスペースルートを指すだけで excerpt が付く。
  `docs/guide/` を正とするなら、bridge-map.json の docPath 差し替えのみで対応可能
  （コード変更不要）。
- **D-3: 公開4メソッドの4本目を `getConfig()` とした。** D1〜D4 のうち D1
  `loadConfig` は `createBridge` が内部で1回実行する設計のため、facade 側では
  「保持している config を返す」形にした（消費者が warning と docsRepoPath の
  有無を表示できる必要があるため — FR-5.2）。素の `loadConfig` も名前付き
  export として公開している。

## 積み残し / 既知の制約

- **`sourceVersion` は手動同期**（BR-DB-4 の設計どおり）。aidlc-workflows が
  ステージを増減・改名したとき、data-lint は「リンク切れ」は検出するが
  「新ステージの追加漏れ」は 32 件の件数アサーションでしか検出できない。
- **excerpt が長い。** ステージファイルの `#` 見出しを anchor にしたため、節が
  ファイル末尾まで（100行超）になるものがある。切り詰めは消費者側の責務とした
  （BR-DB-2 が verbatim を要求しており、ライブラリ側での要約は禁止）。UI で
  問題になれば anchor を `## Steps` 等の下位見出しに差し替えるだけで済む。
- **キャッシュなし**（performance-design.md の非採用どおり）。同一 slug の再取得は
  docs ファイルを毎回読み直す。P-DB-2（≤100ms）はローカル FS 1枚読みで満たす想定
  だが、ベンチは未実施 — 実測は build-and-test / performance-validation に委ねる。
- **map は起動時 1 回ロードのみで watch しない**（domain-entities.md のライフ
  サイクルどおり）。config も同様で、変更はプロセス再起動で反映される。
- 統合レベルの cross-consumer 整合（MCP と Dashboard が実際に同じ値を出すこと）は
  build-and-test の結合テストに残る。本 Unit では「同一関数・同一データを2つの
  config から呼んで同値」までを単体で担保した。

## Review

**Verdict:** NOT-READY

**Reviewer:** aidlc-architecture-reviewer-agent

**Date:** 2026-07-25

### Re-run of the quality gate

`bun run check` re-executed independently from the repo root, real output:

```
$ biome check . && tsc --noEmit && vitest run --coverage && bun audit
Checked 60 files in 62ms. No fixes applied.
 Test Files  21 passed (21)
      Tests  309 passed (309)
docs-bridge/src   |     100 |    94.25 |     100 |     100 |
  excerpt.ts       |     100 |     87.5 |     100 |     100 | 56,59,112
  resolve.ts       |     100 |    93.75 |     100 |     100 | 49
bun audit v1.3.6 — No vulnerabilities found
```

Matches the self-reported numbers in this file exactly (biome, tsc, vitest+coverage, bun audit all green).

### 1 blocking finding

**D-1 (deviation 2 / item 7) breaks the approved unit-DAG contract, not just BR-DB-5.**

`aidlc/spaces/default/intents/260720-aidlc-guide-prd/inception/units-generation/unit-of-work-dependency.md:42,79` scopes the `docs-bridge → reader-core` edge explicitly and narrowly: *"依存の実体は型契約（ReadResult 等）のみの狭いインターフェース — reader-core Unit の完成を待たずとも、型定義の凍結時点で docs-bridge の実装は着手可能"* and lists this as a named parallel-development opportunity ("型定義の凍結後は reader-core 本体と並行可能"). `nfr-design/security-design.md:11` independently defaults to the same narrow posture for S-DB-2: *"ビルド依存を増やさないため**アルゴリズム複製を既定**とし、テストベクタを両 Unit で共通化して等価性を担保"*.

The shipped code does not honor either:
- `packages/docs-bridge/package.json:12` — `"@aidlc-guide/reader-core": "workspace:*"` is a real workspace **code** dependency, not a type-only reference.
- `packages/docs-bridge/src/index.ts:1` — `import { withResult } from "@aidlc-guide/reader-core/util/with-result";`
- `packages/docs-bridge/src/excerpt.ts:2` — `import { guardPath } from "@aidlc-guide/reader-core/util/guard-path";`
- `packages/reader-core/package.json:8-11` — the new `"./util/*": "./src/util/*.ts"` subpath export that makes this possible.

Assessment of the three sub-questions:
- **(a) chokidar pull-through** — verified clean at the *code* level: `packages/reader-core/src/util/guard-path.ts` and `.../with-result.ts` import only `node:fs/promises`, `node:path`, and `@aidlc-guide/shared-types`; neither touches `chokidar`, and the subpath export bypasses `reader-core/src/index.ts` so no barrel re-export drags it in. But at the **package-management** level this is not clean: `reader-core/package.json:14` lists `chokidar: ^4.0.3` as a direct dependency, and because `docs-bridge/package.json` now depends on the whole `@aidlc-guide/reader-core` package (not a narrower util-only package), `chokidar` becomes part of docs-bridge's transitive install closure (`bun.lock`, `bun audit` surface) even though no docs-bridge code path imports it. That sits in tension with `tech-stack-decisions.md:11` ("ランタイム依存 **ゼロ**") and the package's own description ("zero third-party runtime dependencies").
- **(b) reuse vs. duplication** — reuse of a security-critical containment check is good practice in the abstract, but `security-design.md` already weighed this trade-off for this exact function and chose duplication *specifically* to avoid the build-dependency cost now being paid. Overriding that via an unrecorded "conductor build instruction" (code-summary.md's own words) mid-code-generation, without amending `security-design.md`, `business-rules.md` (BR-DB-5), or the DAG, is a process gap: an approved cross-unit boundary was changed without going back through the artifacts that recorded it.
- **(c) DAG / ordering** — no cycle (reader-core has no dependency back on docs-bridge). But the edge's *nature* changed from documentation/type coupling to a real build+runtime dependency, which invalidates the specific economic-sequencing claim the DAG recorded ("並行可能") for `delivery-planning` (2.8) to consume. That claim is now false as shipped: docs-bridge's build requires reader-core's `util/` implementation to exist and be correct, not just its types.

**Recommendation:** revert D-1 — duplicate `guardPath` and `withResult` inside `packages/docs-bridge/src/` (small surface: ~50 and ~10 lines respectively) with shared test vectors, exactly as `security-design.md`'s default already specifies. This restores the approved type-contract-only edge, removes the transitive `chokidar` dependency, and requires no document amendments. If the team prefers to keep reuse instead, that requires an explicit, recorded amendment to `business-rules.md` (BR-DB-5), `nfr-design/security-design.md` (S-DB-2), and `unit-of-work-dependency.md` (the edge annotation + the 2.8 parallel-development note) before this merges — not a silent code-generation-time override. Self-disclosed by the implementer as needing architect sign-off (code-summary.md "D-1"); that sign-off has not happened, so the code currently contradicts an approved contract it was reviewed against at units-generation.

### Non-blocking flags

- **Deviation 1 (item 8, docPath → `.claude/aidlc-common/stages/`)** — the root-cause diagnosis is verified accurate: `docs/guide/` and `docs/reference/` do not exist in this repository (`ls docs/` shows only `docs/prd/PRD.md`), confirming the E2 external-dependency gap is real, not assumed. FR-5.2's configurability mechanism (`docsRepoPath`) is unaffected — it still works. But the excerpt *content* users will see today is agent/orchestration protocol text, not the user-facing guide prose FR-2.2/US-03 imply: e.g. `.claude/aidlc-common/stages/initialization/workspace-scaffold.md`'s `## Steps` section reads "Update `<record>/aidlc-state.md`: set `Current Stage` to `scaffolding workspace`" — internal agent instructions, not an explanation aimed at project.md's S-1 beginner-facing north star. This is honestly disclosed and doesn't break any of BR-DB-1/2/3 or data-lint (all pass), but the "積み残し" note that switching to real `docs/guide/` later is "docPath 差し替えのみ（コード変更不要）" understates the cost — the anchors would also need to match a different file's heading structure across all 41 entries. Recommend a product/architect confirmation on whether this excerpt content is acceptable to ship, independent of this code review.
- **Deviation 3 (item 9, `getConfig()`)** — sound given the reviewed contracts (`business-logic-model.md`, `domain-entities.md`, `logical-components.md`): D1's `loadConfig` is internalized by `createBridge`, so a facade accessor is the only way FR-5.2 consumers can see `docsRepoPath`/warnings. Could not independently verify against `component-methods.md`'s exact method-name list — that file was not in this review's pass-list — but nothing in the contracts available here contradicts it.
- **Extended excerpt behaviors (item 9)** — same-or-shallower heading boundary (`excerpt.ts:39-40,75`) and fenced-code-block awareness (`excerpt.ts:57-63`) are sound corrections, not scope creep: both stay inside BR-DB-2's verbatim constraint (pure line-slicing, no rewriting) and are proven necessary by the real data — the data-lint suite passes against actual stage files that embed fenced completion-message templates (e.g. `build-and-test.md`'s ```` ```# :hammer: Build and Test Complete``` ````), which would otherwise truncate sections early. Covered by `tests/excerpt.test.ts:28-70`.

### Items verified clean (1-6)

- **BR-DB-1 (single ownership)** — confirmed: only 4 packages exist (`btw`, `docs-bridge`, `reader-core`, `shared-types`); `bridge-map` appears nowhere outside `packages/docs-bridge/{src/resolve.ts,tests/data-lint.test.ts}`. No duplication possible yet since mcp-server/dashboard-server aren't built.
- **BR-DB-2 (no summarization)** — `excerpt.ts:sliceSection` (lines 46-79) does pure line-array slicing (`lines.slice(start, i)`); no text transformation beyond the heading-boundary cut. Verified by test fixture content-equality assertions (`tests/excerpt.test.ts:29-42`).
- **BR-DB-3 (fail-soft)** — every docs/anchor-missing path returns `{excerpt: null, warning}` from `readExcerpt` (`excerpt.ts:105,113,118`), which `resolve.ts:attachExcerpt` folds into `{ok, value, warnings}` — never `{error}`. Static fields (`purpose`/`inputs`/`outputs`/`agent`/`gateRequirement`) are unconditionally set before the excerpt attach step (`resolve.ts:83-93`). Tested in `resolve.test.ts:38-44,72-77` and `excerpt.test.ts:92-102`.
- **D1-D4 + createBridge** — confirmed: `resolve.ts`/`links.ts` take `config` as an argument and don't import `config.ts` (grep-verified); `index.ts:createBridge` is the sole `loadConfig` call site, memoized once (lazy); 4 public methods (`getConfig`/`resolveStage`/`resolveTerm`/`projectLinks`) on the `Bridge` interface; every method routed through `withResult` (`index.ts:44,52`), matching R-DB-1.
- **S-DB-2 (containment)** — enforced via the (contested, see D-1 above) reused `guardPath`; behavior itself is correct and tested for both relative (`../outside/secret.md`) and absolute escape vectors (`tests/excerpt.test.ts:79-90`), using a real fixture outside the docs root (`tests/fixtures/outside/secret.md`).
- **Data-lint (US-03 AC ⑤)** — genuinely runs, not skipped: `.claude/aidlc-common/stages` exists in this repo (verified directly), so `data-lint.test.ts`'s `describe.skipIf(!docsAvailable)` block executes for real. It asserts exactly 32 stage entries, resolves every `docPath`/`docAnchor` for all 32 stages + 9 terms against the real tree, and cross-checks each `docPath`'s `slug:` frontmatter against the map key. Confirmed passing in the independent `bun run check` re-run above.

---

## Correction (2026-07-25)

D-1 は architecture-reviewer の NOT-READY 指摘どおり **revert** した。
`security-design.md` S-DB-2 の既定（アルゴリズム複製 + 共通テストベクタ）に戻し、
`unit-of-work-dependency.md` が定める「型契約のみ」の狭いエッジを復元した。

### 変更内容

| 変更 | ファイル |
|------|---------|
| `guardPath` をローカル複製 | 追加 `packages/docs-bridge/src/util/guard-path.ts` |
| `withResult` をローカル複製 | 追加 `packages/docs-bridge/src/util/with-result.ts` |
| import 先を差し替え | `src/excerpt.ts:2`, `src/index.ts` |
| `@aidlc-guide/reader-core` 依存を削除 | `packages/docs-bridge/package.json` |
| `"./util/*"` subpath export を撤去 | `packages/reader-core/package.json`（この消費者専用だったため） |

`docs-bridge` の `dependencies` は `@aidlc-guide/shared-types`（型のみ）1件になり、
サードパーティのランタイム依存はゼロに戻った（`tech-stack-decisions.md` /
package description）。**chokidar 除去の検証**: (1) `packages/docs-bridge/package.json`
の dependencies に `reader-core` が無い、(2) `bun.lock` の `packages/docs-bridge`
ブロックの dependencies が `@aidlc-guide/shared-types` のみ、(3)
`packages/docs-bridge/node_modules/` を削除して `bun install` を再実行した結果、
再生成されたのは `@aidlc-guide/shared-types` のみ（`reader-core` シンボリックリンクは
復活しない）。

### 等価性の機構（drift 検出）

複製は「放置すると片方だけ弱くなる」のが唯一のリスクなので、テストで縛った:

- `packages/docs-bridge/tests/vectors/guard-path-vectors.ts` — 単一のベクタ表。
  ケース: 正常系（ネスト相対パス / 冗長 `..` / ルート自身 / 未作成パス）、
  `../` traversal、bare `..`、ルート外の絶対パス、`/rec/foobar` prefix-confusion
  （絶対・相対の両方）、symlink escape（`it.skipIf` — symlink 不可ホストでは skip）。
- 同ファイルの `runGuardPathVectors(label, guardPath)` を
  `packages/docs-bridge/tests/guard-path-vectors.test.ts` と
  `packages/reader-core/tests/guard-path-vectors.test.ts` の**両方**から呼び、
  同一の表・同一のアサーションを2つの実装に適用する。片方だけが挙動を変えれば
  テストが落ちる。
- reader-core 既存の `tests/guard-path.test.ts` は一切弱めていない（本スイートは加算）。
- `packages/docs-bridge/tests/with-result.test.ts` を追加し、複製した `withResult`
  の catch 経路（Error / 非 Error）も reader-core 側と同等にカバーした。

挙動は不変: 判定は同一（`path.resolve` → `path.relative` → 先頭 `..`／絶対パス拒否
→ `realpath` 再検査、`startsWith` は不使用）、reason 文字列も `"outside-record"` の
まま。`readExcerpt` の warning 文言も変更なし。

### 品質ゲート実測（`bun run check`）

```
$ biome check . && tsc --noEmit && vitest run --coverage && bun audit
Checked 66 files in 71ms. No fixes applied.
 Test Files  24 passed (24)
      Tests  330 passed | 2 skipped (332)
Statements   : 98.13% ( 580/591 )
Branches     : 95% ( 361/380 )
Functions    : 97.34% ( 110/113 )
Lines        : 99.42% ( 515/518 )
bun audit v1.3.6 — No vulnerabilities found
```

skip 2件は symlink ベクタ×2パッケージ（この Windows ホストは Developer Mode 無効で
symlink を作成できないため `skipIf`。reader-core 既存テストの同ケースと同じ扱い）。

## Review (iteration 2 — final)

**Verdict:** READY

**Reviewer:** aidlc-architecture-reviewer-agent

**Date:** 2026-07-25

### Re-run of the quality gate

`bun run check` re-executed independently from the repo root, real output (whole
repo, not just docs-bridge):

```
$ biome check . && tsc --noEmit && vitest run --coverage && bun audit
Checked 66 files in 115ms. No fixes applied.
 Test Files  24 passed (24)
      Tests  330 passed | 2 skipped (332)
 docs-bridge/src   |     100 |    94.25 |     100 |     100 |
  excerpt.ts       |     100 |     87.5 |     100 |     100 | 56,59,112
  resolve.ts       |     100 |    93.75 |     100 |     100 | 49
 ...ridge/src/util |      90 |    83.33 |     100 |     100 |
  guard-path.ts    |    87.5 |       80 |     100 |     100 | 37,59
Statements   : 98.13% ( 580/591 )
Branches     : 95% ( 361/380 )
Functions    : 97.34% ( 110/113 )
Lines        : 99.42% ( 515/518 )
bun audit v1.3.6 — No vulnerabilities found
```

Matches the self-reported "Correction" numbers exactly (330 passed / 2 skipped,
same per-file coverage). The 2 skips are the symlink vectors on this Windows host
(Developer Mode off) — consistent, same skip reason as reader-core's pre-existing
`guard-path.test.ts`.

### Verification against the iteration-1 blocking finding

**(1) No `@aidlc-guide/reader-core` dependency anywhere, and the `./util/*` export
is gone with no other consumer — confirmed.**
- `packages/docs-bridge/package.json:9-11` — `dependencies` is `@aidlc-guide/shared-types`
  only. No `reader-core` entry.
- `packages/docs-bridge/src/excerpt.ts:2` — `import { guardPath } from "./util/guard-path.ts"`
  (local, relative). `packages/docs-bridge/src/index.ts:11` —
  `import { withResult } from "./util/with-result.ts"` (local, relative). Neither
  file imports `@aidlc-guide/reader-core` in any form.
- `packages/reader-core/package.json:7-9` — `exports` is `{"." : "./src/index.ts"}`
  only; the `"./util/*"` subpath export added in iteration 1 is gone.
- `bun.lock:22-28` — the `packages/docs-bridge` workspace block lists exactly one
  dependency, `@aidlc-guide/shared-types: workspace:*`. No `reader-core`, no
  `chokidar`.
- `packages/docs-bridge/node_modules/@aidlc-guide/` contains only a `shared-types`
  symlink (checked directly) — no `reader-core` link survives from the reverted
  install.
- Repo-wide grep for `reader-core` / `chokidar` inside `packages/docs-bridge/{src,tests}`
  turns up only comment prose explaining *why* the duplication exists (`guard-path.ts:6-19`,
  `with-result.ts:8`, `tests/vectors/guard-path-vectors.ts:11-18`) — no live import.
- Grep for `@aidlc-guide/reader-core` across `packages/` returns only reader-core's
  own `"name"` field in its own `package.json` — no remaining consumer of the old
  subpath export anywhere in the workspace.

**(2) Duplicated `guardPath` is algorithmically identical — confirmed line by line.**
Compared `packages/docs-bridge/src/util/guard-path.ts` against
`packages/reader-core/src/util/guard-path.ts`: the `contains()` helper is
byte-identical logic (`path.relative` + `path.resolve`, `rel === ""` / `path.isAbsolute(rel)`
/ `rel !== ".." && !rel.startsWith(path.sep + "..")` — no `startsWith` on the raw
absolute paths in either copy). `guardPath()` itself is identical control flow:
resolve root → resolve target → lexical `contains` check → `realpath` probe on both
sides wrapped in try/catch → second `contains` check → same three rejection points,
all returning `{ error: true, reason: "outside-record" }`, same success shape
`{ ok: true, value: target }`. Only variable names differ (`root`/`base` vs.
`recordDir`/`root`) and comments — cosmetic, not behavioral. `with-result.ts` is
likewise identical in both packages (try/catch → `{error, reason: "internal: " + message}`,
same `Error`-vs-non-`Error` message extraction).

**(3) Shared vector suite genuinely runs in BOTH packages against their own
implementation — confirmed.**
- `packages/docs-bridge/tests/guard-path-vectors.test.ts:1-4` imports its own local
  `guardPath` and calls `runGuardPathVectors("docs-bridge", guardPath)`.
- `packages/reader-core/tests/guard-path-vectors.test.ts:1-7` imports its own local
  `guardPath` and calls `runGuardPathVectors("reader-core", guardPath)`, pulling the
  vector table via a test-only relative import
  (`../../docs-bridge/tests/vectors/guard-path-vectors.ts`) — not a package
  dependency, doesn't touch `package.json` or `bun.lock`, so it doesn't reopen the
  chokidar-closure problem; it only creates a test-time file coupling, which is the
  intended "one table, two implementations" equivalence guarantee.
- Table coverage in `packages/docs-bridge/tests/vectors/guard-path-vectors.ts:71-123`
  is comprehensive: nested-relative accept, redundant-`..`-that-lands-inside accept,
  root-itself accept, not-yet-existing-path accept, `../../` traversal reject, bare
  `..` reject, absolute-path-outside reject (vector 2), prefix-confusion reject both
  as an absolute sibling path and as a relative `../foobar/leak.md` (the
  `startsWith`-defeating case), and a symlink-escape reject gated by
  `it.skipIf(needsSymlink && !symlinkOk)` (vector 3) — matches all four categories
  named in the review brief (traversal, absolute-outside, prefix-confusion,
  symlink-skipIf).
- Ran `bun run check` above and confirmed both suites are in the 24 passing test
  files (`guardPath shared vectors — docs-bridge` and `guardPath shared vectors —
  reader-core` both execute, per-package `guard-path.ts` coverage lines
  87.5%/80%/100%/100% appear for both `docs-bridge/src/util` and
  `reader-core/src/util` in the coverage table, confirming both implementations
  were actually exercised, not just one).

**(4) reader-core's original guardPath tests were not weakened — confirmed.**
`packages/reader-core/tests/guard-path.test.ts` is unchanged from its pre-iteration-1
shape: same four accept cases, same three numbered vectors plus the two
prefix-confusion cases, same assertions on `{error: true, reason: "outside-record"}`.
The new shared-vector suite is additive (separate file), exactly as the code-summary
states.

**(5) Regression — confirmed clean.** Whole-repo `bun run check` (biome, `tsc
--noEmit`, `vitest run --coverage`, `bun audit`) is green: 330 passed / 2 skipped
(0 failed), no biome findings, no type errors, no audit vulnerabilities. Nothing
outside docs-bridge/reader-core changed shape in this correction (`package.json`
diffs are confined to the two packages' `dependencies`/`exports` fields per the
code-summary's own change table), and the full suite including `btw` and the rest
of `reader-core`'s existing tests (`watch.test.ts`, `matrix.test.ts`,
`parse-state.test.ts`, etc.) still passes.

### Conclusion

The iteration-1 blocking finding (D-1: a real `@aidlc-guide/reader-core` workspace
dependency plus a `./util/*` subpath export, contradicting BR-DB-5 and the
unit-DAG's type-contracts-only edge, pulling `chokidar` into docs-bridge's install
closure) is fully reverted. The duplication-plus-shared-vectors approach specified
by `nfr-design/security-design.md` S-DB-2 as the default is now what's actually
shipped, verified equivalent by a real cross-package test suite, with zero
third-party runtime dependencies restored and the whole-repo quality gate green.
No new issues found in this pass. A developer could build/maintain this unit from
the current artifacts without further architectural guidance.
