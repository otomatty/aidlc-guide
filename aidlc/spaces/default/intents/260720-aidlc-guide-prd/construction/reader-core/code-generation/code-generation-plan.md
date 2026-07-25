# Code Generation Plan — Unit: reader-core

> code-generation (3.5) / Unit: reader-core (kind: library, L) / 2026-07-25
> 入力: functional-design（business-logic-model L1〜L7 / business-rules G-1〜G-6・BR-RC-1〜7 / domain-entities）
> + nfr-requirements（P-RC-1〜7 / S-RC-1〜4 / R-RC-1〜5 / SC-RC-1〜3 / tech-stack）
> + nfr-design（logical-components のモジュール表・データフロー）+ team.md（Vitest ブランチ重視・Biome・クロスプラットフォーム）
> 出力先: `packages/shared-types/`（型のみ）+ `packages/reader-core/`（実装 + テスト）

## ストーリー traceability

| ストーリー | AC | 実装 | 検証 |
|-----------|----|------|------|
| **US-09a** FR-1.1 state パース | phase/stage/scope/depth/完了数を型付きで返す | `parse/state.ts`（L1） | `tests/parse-state.test.ts` — golden スナップショット + ライブ記録 |
| **US-09a** FR-1.2 成果物ツリー | ユニット×ステージ×成果物マトリクス | `tree/matrix.ts`（L2） | `tests/matrix.test.ts` |
| **US-09a** FR-1.3 監査抽出 | 直近監査イベント | `audit/events.ts`（L3） | `tests/audit.test.ts` |
| **US-09a** FR-1.4 インテント解決 | アクティブ/全インテント | `intents/resolve.ts`（L4） | `tests/intents.test.ts` — cursor 4態 |
| **US-09a** FR-1.5 watch | 変更→通知（種別＋対象） | `watch/watcher.ts`（L5） | `tests/watch.test.ts` + `tests/watch-resubscribe.test.ts` |
| **US-09a** 依存方向 | React/MCP SDK/HTTP を import しない | 構造（Biome override + 依存宣言） | `tests/dependency-direction.test.ts` |
| **US-15** ① 未解決 | `{ok, active:null, all}` | L4 | `tests/reader.test.ts` mode 1 |
| **US-15** ② 複数列挙 | `all[]` 常時提供 | L4 | `tests/reader.test.ts` mode 2 |
| **US-15** ③ パース不能 | `{unsupported}` / `{error}` / unparseable | L1（G-2） | `tests/reader.test.ts` mode 3 + `parse-state.test.ts` |
| **US-15** ④ 部分欠落 | `cell.error` のみ | L2 | `tests/reader.test.ts` mode 4 + `matrix.test.ts` |
| **US-15** ⑤ 監査読取不能 | シャード skip + `warnings` | L3 | `tests/reader.test.ts` mode 5 + `audit.test.ts` |
| **US-09b 前提** FR-2.4 読取境界 | `../` / 記録外絶対 / symlink の3ベクタ拒否 | `util/guard-path.ts`（L6） | `tests/guard-path.test.ts` |

## 実装チェックリスト

### A. `packages/shared-types/`（型のみ・ランタイムコードゼロ）
- [x] `src/index.ts` — `ReadResult<T>`（`warnings?` つき）/ `StandardReason` / `StageStatus` / `Phase` / `Verdict` / `StageInfo` / `WorkflowModel` / `NextStep` / `MatrixCell` / `Matrix` / `AuditEvent` / `IntentList` / `ChangeEvent` / `WatchWarning` / `WatchEvent`
- [x] `package.json`（private・types エントリのみ）/ `tsconfig.json`

### B. `packages/reader-core/src/`（logical-components.md のモジュール表どおり）
- [x] `util/with-result.ts` — R-RC-1 の最終防衛線（throw→`{error, reason:"internal: …"}`）
- [x] `util/read-bounded.ts` — S-RC-4 の 10MB bound（`stat` を読取**前**に）+ BOM strip（R-RC-3）+ verdict 用 tail 読み
- [x] `util/guard-path.ts` — S-RC-2 containment（`resolve`→`relative`→`realpath` 再検査、`startsWith` 不使用）。**公開 named export**
- [x] `parse/state.ts` — G-1〜G-6。Version 検知は最初、以降は行指向の単方向走査。`parseState`（純関数）と `readState`（FS 入口）に分離
- [x] `tree/matrix.ts` — `buildMatrix(recordDir, constructionStageSlugs)` / `buildMatrixForUnit(...)`。除外集合は**引数**（BR-RC-4）。verdict は tail 4KB
- [x] `audit/events.ts` — `---` ブロック抽出、Timestamp 降順 + シャード名タイブレーク、シャード単位 skip + warnings
- [x] `intents/resolve.ts` — `resolveIntents` / `resolveRecordDir`（`no-active-intent`）
- [x] `watch/watcher.ts` — chokidar、300ms trailing debounce（scope ごとに1件へ合流）、scope 分類、再購読3回→`watch-warning`、dispose フラグ
- [x] `index.ts` — `createReader(rootPath)` ファサード7メソッド。recordDir は毎回再解決（キャッシュ禁止）

### C. テスト（Vitest / team.md: パーサはブランチ重視）
- [x] `tests/fixtures/golden/` — 実 State Version 7 ファイルのピン留めコピー（正確値のゴールデン）
- [x] `tests/fixtures/{unsupported-version,no-version,truncated,degraded,total-mismatch,state-not-a-file}/` — 縮退フィクスチャ
- [x] `tests/fixtures/record/` — 合成ミニ記録（ユニット4・除外ディレクトリ・壊れセル・監査2シャード + 読取不能シャード）
- [x] `tests/parse-state.test.ts` — G-1〜G-6 全分岐 + 6 mark 全網羅 + ライブ記録の構造スモーク
- [x] `tests/guard-path.test.ts` — 3ベクタ + `/rec/foobar` プレフィックス誤許可 + symlink（OS 非対応時は graceful skip）
- [x] `tests/read-bounded.test.ts` / `tests/with-result.test.ts`
- [x] `tests/matrix.test.ts` / `tests/audit.test.ts` / `tests/intents.test.ts`
- [x] `tests/watch.test.ts`（fake timers + 実FS）/ `tests/watch-resubscribe.test.ts`（chokidar スタブで R-RC-4 のはしご）
- [x] `tests/reader.test.ts` — ファサード + US-15 5モード各1 + R-RC-1 の「例外が漏れない」総当り
- [x] `tests/dependency-direction.test.ts` — BR-RC-3 / S-RC-1 の構造検査

### D. ゲート統合
- [x] `biome.json` に reader-core/shared-types 用 `noRestrictedImports` override（fs write 系を構造禁止 — S-RC-1）
- [x] `vitest.config.ts` に `packages/reader-core/src/parse/**` のブランチ床 95%（team.md のブランチ重視を実行可能な形に）
- [x] `package.json` の `check` を `vitest run --coverage` に変更（カバレッジ床をローカル品質ゲートに含める）
- [x] `bun run check` green

## 実装順（依存順）
1. shared-types → 2. util（guard-path / read-bounded / with-result）→ 3. parse → 4. tree・audit・intents → 5. watch → 6. facade → 7. テスト・ゲート
