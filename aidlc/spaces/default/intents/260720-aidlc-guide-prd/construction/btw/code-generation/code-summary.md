# Code Summary — Unit: btw

> code-generation (3.4) / Unit: btw (kind: service, S) / 2026-07-25
> 対応計画: `code-generation-plan.md`

## 生成ファイル

アプリケーションコードはすべてワークスペースルート配下（`aidlc/` には一切書き込んでいない — BR-5 / NFR-1）。

### ワークスペース骨格（初回のため btw と同時に確立 — ADR-01）

| ファイル | 役割 |
|---------|------|
| `package.json` | bun workspaces (`packages/*`)。`check` = biome + `tsc --noEmit` + vitest + `bun audit`（team.md のローカル単一ゲート） |
| `biome.json` | formatter + linter 単一ツール。`packages/btw/src/**` 限定で write 系 fs API を `noRestrictedImports` で禁止 |
| `tsconfig.json` | strict / `moduleResolution: bundler` / `noUncheckedIndexedAccess` / `verbatimModuleSyntax` |
| `vitest.config.ts` | v8 coverage。`spawn.ts` / `cli.ts` はプロセス境界のため coverage 対象外（手動スモークで担保） |
| `bun.lock` | コミット対象（project.md Mandated） |
| `packages/btw/package.json` | bin `btw`。**runtime dependencies ゼロ** |
| `packages/btw/tsconfig.json` | ルートを extends |
| `packages/btw/README.md` | 使い方 + fork 制約 + **検証済み Claude Code バージョン表**（E3 緩和策） |

### 実装（`packages/btw/src/`、8 ファイル・runtime 依存ゼロ）

`errors.ts` / `parse.ts` / `slug.ts` / `resolve.ts` / `plan.ts` / `spawn.ts` / `help.ts` / `cli.ts`

### テスト（`packages/btw/tests/`、5 ファイル・50 ケース）

`parse.test.ts`（15) / `slug.test.ts`（5) / `resolve.test.ts`（6) / `plan.test.ts`（19) / `help.test.ts`（5)

## 主要な決定

1. **`basePlanArgs` は `plan.ts` の単一定数**。3モードすべてが `plan()` を通り、`claudeArgv()` が必ず連結する。plan フラグを外した起動関数はコード上存在しない（S-BTW-1）。テストは 3モード × 2プラットフォーム = 6 ケースで包含を検証。

2. **`projectSlug` は `node:path` を使わない純粋な文字列置換**。設計のモジュール表は `slug.ts` の依存に `node:path` を挙げていたが、`path.resolve()` を挟むと Windows 上で `/Users/dev/...` が `C:\Users\dev\...` に書き換わり、**設計が必須と定めた macOS 例のテストが Windows で落ちる**。cwd は呼出側（`cli.ts`）が `process.cwd()` で絶対パスとして渡すため正規化は不要と判断し、依存を落とした。これにより両OS例が**どちらのホストでも**通る。

3. **macOS の新ターミナル起動は `osascript` + 二重クォート**。`open -a Terminal` は起動するコマンドを渡せず、Terminal.app は常にホームディレクトリで新シェルを開くため、スクリプト内で `cd` が必要。内側に POSIX シングルクォート、外側に AppleScript 文字列エスケープを適用し、空白・`&`・シングルクォート・バックスラッシュ入りの cwd を保持する（R-BTW-4 のメタ文字ケースをテスト済み）。Windows は `cmd /c start btw cmd /k claude ...` で、cwd は `Bun.spawn` の `cwd` オプションから継承されるためクォート不要。

4. **`--help` は前提チェックより前**。設計の記述順は「前提チェック → parse → 実行」だが、Claude Code 未導入のマシンで `btw --help`（＝導入方法を知るための唯一の手段）が失敗するのは不合理。`Bun.which("claude")` は help 以外の全モードで**1回だけ**実行され、P-BTW-1 のホットパス要件は維持している。意図的な逸脱として記録する。

5. **`errors.ts` はモジュール表にない追加ファイル**。S-BTW-5 が要求する「エラー組み立てヘルパー1関数・引数型を `{path?, reason}` に制限」を実体化したもので、`BtwError` 型と `fail()` を保持する。`cli.ts` に置くと `parse`/`resolve`/`plan` からの循環参照になるため分離した。型設計上、セッション本文を渡せる引数が存在しない。

6. **`resolve.ts` はファイル本文を開かない**。`readdir` 1回 + 候補ごとの `stat` で走査中の最大 mtime のみ保持（ソートなし・O(n) — P-BTW-2）。`node:fs/promises` からの import は `readdir` / `stat` のみで、write 系と `readFile` / `open` は Biome の `noRestrictedImports` が構造的に禁止する（S-BTW-3）。**このガードは実際に機能することを確認済み**（テストのフィクスチャ生成が引っかかったため、override を `src/**` 限定にスコープした）。

7. **`vitest` / `@vitest/coverage-v8` を 4.x に更新**。3.x の依存ツリーに `brace-expansion` の high 脆弱性（GHSA-mh99-v99m-4gvg）があり `bun audit` がゲートを落としたため。transitive 依存の override 固定ではなく上流更新で解消した（dev-time 依存のみ、C-T1 非抵触 — project.md Decided）。

## 実行方法

```bash
bun install
bun run check        # biome check + tsc --noEmit + vitest run + bun audit（ローカル単一ゲート）
bun run test         # テストのみ
bun run packages/btw/src/cli.ts --help
```

### 実測結果（2026-07-25, Windows 11 / Git Bash / bun 1.3.6）

```
$ bun run check
$ biome check . && tsc --noEmit && vitest run && bun audit
Checked 20 files in 32ms. No fixes applied.

 RUN  v4.1.10 C:/work/aidlc-guide

 Test Files  5 passed (5)
      Tests  50 passed (50)
   Duration  720ms

bun audit v1.3.6 (d530ed99)
No vulnerabilities found
```

カバレッジ（`vitest run --coverage`、`spawn.ts`/`cli.ts` 除く）:
Statements 98.7% (76/77) · Branches **100%** (47/47) · Functions 100% (10/10) · Lines 98.63%

未カバー1行は `resolve.ts` の readdir↔stat 競合時の `continue`（実機で再現困難なレース分岐）。

### 実データでの検証

`resolve.ts` を本ワークスペースの実 `~/.claude/projects` に対して実行し、
`C:\work\aidlc-guide` → `C--work-aidlc-guide` の slug 規則と最新セッション選択が
実環境で成立することを確認した（Claude Code 2.1.215）。

## 既知のギャップ

1. **OS別手動スモーク未実施（R-BTW-4 / plan D3）**。実際の `Bun.spawn` 起動は設計どおりテスト対象外で、{通常 cwd, 空白入り cwd, `&` 入り cwd} × {`btw`, `--fork`, `-p`} を macOS と Windows の両方で人手確認する必要がある。特に macOS の `osascript` 経路は**未実行**（本ステージは Windows ホストで実施）。P-BTW-1（2秒以内）の実測もここで行う。
2. **macOS の起動先は Terminal.app 固定**。iTerm2 等の利用者は Terminal.app が開く。要望が出るまで対応しない（YAGNI）。
3. **`--fork` の slug 規則は Claude Code 内部実装への依存**（E3）。バージョン差で壊れ得るが、失敗時に計算パスを verbatim 表示し README にバージョン表を持つ緩和策は実装済み。
4. **`Bun.which("claude")` はシェルの alias / function を検出できない**。その旨をエラーの hint に明記して回避策を示している。
5. Construction 中に type-check センサーが `packages/btw/aidlc/.../.tsbuildinfo` を生成したため削除した。再発するようならセンサー側の cwd 指定を確認する（btw のコードとは無関係）。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25

Re-ran the gate independently (`bun run check` on Windows 11 / bun 1.3.6): 20 files checked by Biome, `tsc --noEmit` clean, **5 test files / 50 tests passed**, `bun audit` — no vulnerabilities. Coverage re-measured with `vitest run --coverage`: Statements 98.7% (76/77), Branches **100%** (47/47), Functions 100%, Lines 98.63% — matches the numbers claimed in this file exactly.

**S-BTW-1 (plan mode always) — confirmed, no bypass found.** `packages/btw/src/plan.ts:20` defines `basePlanArgs` as the single constant; grepping the whole `src/` tree for `Bun.spawn`/`"claude"`/`--permission-mode` shows exactly one call site that ever invokes `Bun.spawn` (`spawn.ts:18,21`, both inside `runPlan`), and `runPlan` only ever consumes a `SpawnPlan` produced by `plan()` (`plan.ts:44-59,65-108`). All three modes (`side`/`fork`/`headless`) route through `claudeArgv()`, which concatenates `basePlanArgs` in every branch. `plan.test.ts:20-37` asserts the flag pair is present for all 3 modes × 2 platforms (6 cases) via a regex that also matches the darwin-quoted form.

**S-BTW-2 (injection) — verified for the actual threat, one doc claim doesn't match it.** All argv construction happens as arrays; `-p`'s prompt is only ever placed as its own array element (`plan.ts:55`, `parse.test.ts:25-28`, `plan.test.ts:119-125` prove a payload containing `$(rm -rf /) && echo "pwned"` passes through untouched as one argv element and is never routed through the darwin/shell path, since `headless` returns before the OS switch at `plan.ts:71-73`). However, `packages/btw/README.md:54` states "Never builds a shell command string. Everything goes to `Bun.spawn` as an argv array" — this is not accurate: `plan.ts:90` builds `shellLine = \`cd ${shellQuote(ctx.cwd)} && exec ${argv.map(shellQuote).join(" ")}\`` and hands that string to `osascript -e 'tell application "Terminal" to do script <shellLine>'` for the darwin `side`/`fork` paths (necessary because Terminal.app's `do script` only accepts a shell command line, not argv — there is no argv-passing API). The values interpolated into that string are cwd and a filesystem-derived session id, both individually POSIX/AppleScript-quoted and covered by `plan.test.ts:132-161` (spaces, `&`, embedded single quote, backslash/double-quote), so the actual command-injection surface (`-p` user input) is closed as designed — but the README's blanket claim is a checkable, false statement about the implementation and should be corrected (e.g. "except the macOS Terminal launch, where cwd/session-id are quoted into a shell line — see plan.ts").

**S-BTW-3 (zero writes / no content reads) — confirmed structurally and by an independent live test.** `resolve.ts` imports only `readdir`/`stat` from `node:fs/promises`; no other `src/*.ts` file imports `node:fs` or `node:fs/promises` at all. I independently appended `import { readFile } from "node:fs/promises"; void readFile;` to `resolve.ts` and re-ran Biome: `lint/style/noRestrictedImports` fired exactly as `biome.json:46-101`'s override promises, confirming the guard is real and not just a config that looks right on paper (reverted afterward; `bun run check` green again).

**projectSlug — both mandated examples correct, deviation is sound.** `slug.ts:18`'s `cwd.replace(/[\\/:.]/g, "-")` hand-traces to `C--work-aidlc-guide` and `-Users-dev-aidlc-guide` for the two example inputs and both are asserted in `slug.test.ts:7-13`, reconfirmed by the full test run above. The no-`node:path` deviation from `logical-components.md:12`'s module table (which lists `slug.ts`'s dependency as `node:path`) and `tech-stack-decisions.md:13` is well-reasoned in this file's decision #2: the transform is a pure character substitution over an opaque string, and routing it through `path.resolve()` would silently re-platform a path typed for the other OS, which is exactly what BR-4 ("`path.sep` 決め打ち禁止") is trying to prevent, not what it mandates. Accepted as a sound, disclosed deviation.

**Error handling (R-BTW-1/5) — confirmed.** Every failure path constructs a `BtwFailure` via the single `fail()` helper (`errors.ts:32-41`, `code` defaults to 1) and `cli.ts:54-66` is the only `catch`, writing one reason line plus an optional hint line to stderr and never printing `error.stack`. Fork-resolution failure includes the computed path (`resolve.ts:46-50,71-75`) and the `/branch` hint (`BRANCH_HINT`, `resolve.ts:19-20`), matching R-BTW-5; `resolve.test.ts:65-86` exercises both the missing-directory and zero-`.jsonl` cases and asserts both the path and the hint.

**FR-3.4 — confirmed.** `help.ts`'s `HELP_TEXT` and `FORK_CAVEAT` both contain the JSONL-flush caveat and the `/branch` recommendation; `help.test.ts` asserts this and passed in the independent run.

**Tests — substantive, not tautological.** Every test file asserts concrete input→output pairs or thrown-error content (e.g. `resolve.test.ts:88-96` writes a fake secret into a file in the target directory and asserts the error message does not contain it — a real S-BTW-5 regression test, not a placeholder). No `expect(true).toBe(true)`-style assertions found.

**Other deviations (documented in "主要な決定" above) — reasonable.** `--help` before the `which("claude")` check (decision 4) keeps `--help` usable on a machine without Claude Code installed while still running the prerequisite check exactly once on every other path (P-BTW-1 unaffected). `errors.ts` as an added module (decision 5) avoids a `cli.ts`↔`parse.ts`/`resolve.ts`/`plan.ts` import cycle and its `fail()` signature structurally cannot accept session content, consistent with `security-design.md`'s S-BTW-5 mechanism. The vitest 3→4 bump for an audit finding (decision 7) is a dev-time-only dependency change, consistent with the project.md precedent this file cites.

**Minor housekeeping (non-blocking):** `packages/btw/aidlc/spaces/` is a leftover empty directory tree from the type-check sensor run mentioned in "既知のギャップ" item 5 — it's already disclosed there, but since it now sits inside the shipped `packages/btw/` tree it is worth deleting before commit so it isn't mistaken for an application artifact.

**Not yet done (already disclosed, not a hidden gap):** R-BTW-4's OS-pair manual smoke test (plan D3) has not run on macOS; the darwin `osascript` path is therefore unexercised end-to-end outside unit tests. This is called out accurately in "既知のギャップ" item 1 and does not block this stage's gate, which scopes spawn execution out of automated tests by design (`vitest.config.ts:12`).
