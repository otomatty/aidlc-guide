# Code Generation Plan — Unit: btw

> code-generation (3.4) / Unit: btw (kind: service, S) / 2026-07-25
> 入力: functional-design（business-logic-model / business-rules / domain-entities）+ nfr-requirements 5点 + nfr-design 5点 + unit-of-work.md U3 + requirements.md FR-3 + team.md / project.md

btw は最初にコードを生成する Unit のため、モノレポ骨格（ADR-01）の最小構成も本ステージで併せて確立する。

## A. ワークスペース骨格（ワークスペースルート）

- [x] A1 ルート `package.json` — bun workspaces (`packages/*`)、スクリプト `check` / `test` / `lint` / `format`
- [x] A2 `biome.json` — formatter + linter 単一ツール（team.md Code Style）。`packages/btw/src/**` に write 系 fs API の `noRestrictedImports` ガード（S-BTW-3 の構造的禁止）
- [x] A3 ルート `tsconfig.json`（strict / `moduleResolution: bundler` / `noUncheckedIndexedAccess`）
- [x] A4 `packages/btw/tsconfig.json`（ルートを extends）
- [x] A5 `vitest.config.ts` — v8 coverage provider
- [x] A6 `packages/btw/package.json` — bin `btw`、**runtime dependencies ゼロ**（C-T1 / tech-stack-decisions.md）
- [x] A7 `.gitignore` — 既存の `node_modules` / `dist` / `*.local` で充足済み（追記不要）
- [x] A8 `bun.lock` をコミット対象として生成（project.md Mandated: lockfile をピン）

## B. 実装（`packages/btw/src/` — nfr-design logical-components のモジュール表どおり）

| # | ステップ | ファイル | 由来ストーリー / 設計 ID |
|---|---------|---------|------------------------|
| B1 | 正規化エラー + 単一組み立てヘルパー | `errors.ts` | domain-entities `BtwError` / R-BTW-1 / R-BTW-5 / **S-BTW-5** |
| B2 | argv → BtwCommand（相互排他・空プロンプト検証） | `parse.ts` | **US-06/07/08** / FR-3.1-3.3 / business-rules バリデーション |
| B3 | `projectSlug(cwd)`（`\` `/` `:` `.` → `-`、純関数） | `slug.ts` | **US-07** / FR-3.2 / BR-2 / E3 |
| B4 | slug ディレクトリ → SessionRef（readdir+stat 単走査、内容非読取） | `resolve.ts` | **US-07** / FR-3.2 / P-BTW-2 / S-BTW-3 / R-BTW-5 |
| B5 | (BtwCommand, ctx) → SpawnPlan（全3モード、`basePlanArgs` 単一定数） | `plan.ts` | **US-06/07/08** / **S-BTW-1** / S-BTW-2 / BR-1 / BR-4 / R-BTW-4 |
| B6 | SpawnPlan → `Bun.spawn` 配列実行（terminal=detached / inline=stdio inherit） | `spawn.ts` | S-BTW-2 / P-BTW-1 / P-BTW-3 |
| B7 | 静的 help（fork の JSONL フラッシュ制約 + `/branch` 第一案内） | `help.ts` | **US-06** AC 補 / FR-3.4 / BR-3 / C-T5 |
| B8 | bin: 前提チェック → parse → 実行、単一 catch → stderr 1行 + 非ゼロ exit | `cli.ts` | R-BTW-1 / BR-6 / P-BTW-1 |
| B9 | README（検証済み Claude Code バージョン記録） | `README.md` | E3 緩和策 / FR-3.4 |

- [x] B1 `errors.ts`
- [x] B2 `parse.ts`
- [x] B3 `slug.ts`
- [x] B4 `resolve.ts`
- [x] B5 `plan.ts`
- [x] B6 `spawn.ts`
- [x] B7 `help.ts`
- [x] B8 `cli.ts`
- [x] B9 `README.md`

### ストーリー → コードステップ トレーサビリティ

| ストーリー | 受入の実体 | コードステップ | テスト |
|-----------|-----------|--------------|--------|
| **US-06**（`btw` でプランモード側セッション） | plan モードで別ターミナルが開く | B2, B5, B6, B8 | `parse.test.ts` / `plan.test.ts`（side・両OS）＋ OS別手動スモーク |
| **US-07**（`btw --fork` で文脈引継ぎ） | 最新セッションIDを解決して fork 起動、解決不能なら計算パス + `/branch` | B2, B3, B4, B5, B8 | `slug.test.ts`（両OS）/ `resolve.test.ts` / `plan.test.ts`（fork） |
| **US-08**（`btw -p` ヘッドレス） | stdout 透過・exit code 透過 | B2, B5, B6, B8 | `parse.test.ts` / `plan.test.ts`（headless・特殊文字） |
| FR-3.4（fork 制約の明記） | help に制約 + `/branch` | B7, B9 | `help.test.ts` |

## C. テスト（Vitest / team.md Standard 戦略）

- [x] C1 `tests/parse.test.ts` — 各モード、`--fork`＋`-p` 排他、空/空白プロンプト、`-p` 引数欠落、未知オプション、非ゼロ code
- [x] C2 `tests/slug.test.ts` — **`C:\work\aidlc-guide`→`C--work-aidlc-guide`／`/Users/dev/aidlc-guide`→`-Users-dev-aidlc-guide` の両OS例**、ドット置換、連続文字の個別置換
- [x] C3 `tests/resolve.test.ts` — fixture ディレクトリで最新選択 / `.jsonl` 以外を無視 / ディレクトリ不在 / `.jsonl` 0件（いずれも計算パス + `/branch` hint 検証）/ エラーに内容を含めない
- [x] C4 `tests/plan.test.ts` — **3モード×両プラットフォームで `basePlanArgs` 包含**、win32/darwin の起動形、fork の `--fork-session <id>`、未対応OS、`-p` 特殊文字が引数配列で無傷、空白/`&`/シングルクォート入り cwd のクォート
- [x] C5 `tests/help.test.ts` — help に `--fork-session` フラッシュ制約と `/branch` が含まれる（FR-3.4 AC）
- [x] C6 spawn 実行そのものはテストしない（R-BTW-4 のとおり手動スモーク）

## D. ゲート

- [x] D1 `bun install` 成功
- [x] D2 `bun run check`（biome check + `tsc --noEmit` + `vitest run` + `bun audit`）が green
- [ ] D3 OS別手動スモーク（R-BTW-4: {通常 cwd, 空白入り cwd, `&` 入り cwd} × {btw, --fork, -p}、macOS / Windows）— **本ステージ未実施（人手が必要）**
