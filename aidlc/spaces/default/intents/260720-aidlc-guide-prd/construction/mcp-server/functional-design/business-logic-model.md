# Business Logic Model — Unit: mcp-server

> functional-design (3.1) / Unit: mcp-server (kind: service, M) / 2026-07-24
> 入力: unit-of-work.md U4 + unit-of-work-story-map.md（US-09b/US-04）+ requirements.md（FR-2）+ components.md C4 + component-methods.md（MCP tools 表）+ services.md S1

## 起動シーケンス

```
main():
  1. workspaceRoot 解決（cwd 起点。MCP は Claude Code が spawn するため cwd = プロジェクトルート）
  2. reader = createReader(workspaceRoot) / bridge = createBridge()
  3. MCP TypeScript SDK の Server を stdio トランスポートで起動、5ツールを登録
  4. 常駐（Claude Code セッションと同寿命 — services.md S1）
```

## ツール実装（component-methods.md の表を実装）

### M1: `aidlc_status`（FR-2.1 / US-09b）
```
入力: {} → reader.getWorkflow()（component-methods.md の契約どおり — next step は M3 の担当）
出力: phase / currentStage / gate / done / total を構造化テキスト + JSON
     （unit は WorkflowModel に無い — Construction 中の現在ユニットは Matrix 側の情報であり、
      FR-2.1 の「ユニット」は当該ステージが per-unit の場合に currentStage 名と併記される
      state の Current Stage 情報で代替。専用フィールドは持たない）
```

### M2: `aidlc_explain_stage`（FR-2.2 / US-03 の MCP 面）
```
入力: {slug} → bridge.resolveStage(slug)
出力: 目的・入出力・担当エージェント・ゲート要求 + docs deep-link（+ excerpt があれば本文）
未知 slug: 「該当なし」を返す（エラーでなく通常応答 — AI が次の行動を選べる）
```

### M3: `aidlc_next_steps`（FR-2.3）
```
入力: {} → reader.getNextStep()
出力: 次ステージ名 + そこで人間に求められること（null なら「ワークフロー完了」）
```

### M4: `aidlc_read_artifact`（FR-2.4）
```
入力: {path}
  1. サーバ側で reader-core の公開 named export `guardPath(recordDir, path)` を呼んで事前拒否
     （同関数を reader.readArtifact も内部で使う = 同一実装の二重呼出。独立実装の重複ではなく、
      「境界に触れる前に弾く」ための前段チェック — reader-core/functional-design/domain-entities.md
      の公開ユーティリティ export 契約）
  2. reader.readArtifact(path)（内部で同 guardPath + 10MB bound）
  3. {ok}→本文 / outside-record→「記録外パスは読めません」/ artifact-not-found→「見つかりません」
     / file-too-large→「大きすぎます」（いずれも通常応答テキスト。MCP エラーにしない —
     AI が理由を読んで別の行動を取れる）
```

### M5: `aidlc_glossary`（FR-2.5 / US-04）
```
入力: {term} → bridge.resolveTerm(term) → 定義 + deep-link（未知は「未定義」）
```

## ReadResult → MCP 応答の写像

| ReadResult | MCP 応答 |
|-----------|---------|
| {ok, value, warnings?} | 内容テキスト（warnings があれば末尾に「注意: …」を付す） |
| {unsupported, version} | 「この state は State Version <n> で、本ツールは 7 のみ対応です（解析不可）」 |
| {error, reason} | reason に応じた日本語1行 + 可能なら代替案内（no-active-intent → 「インテントが未作成です」） |

**MCP プロトコルエラー（isError）にするのは入力スキーマ違反のみ**。データ側の失敗は通常応答で理由を伝える（AI が回復行動を選べるようにする — fail-soft の AI 面）。

## エラーハンドリング

全ツールハンドラを try/catch で包み、想定外例外は「内部エラー: <msg>」の通常応答に正規化（プロセスを落とさない — stdio 常駐が切れると Claude Code 側のツールが全滅するため）。

## Review

**Verdict: READY**

Iteration-2 re-verification, scoped to the two prior blocking findings plus a regression pass over `business-logic-model.md` and `business-rules.md`.

- **Finding 1 (M1 unused `getNextStep` call) — RESOLVED.** Line 20 now reads `入力: {} → reader.getWorkflow()（component-methods.md の契約どおり — next step は M3 の担当）` — a single call, no `getNextStep()`. Matches the contract row exactly: `inception/application-design/component-methods.md:44` — `` `aidlc_status` | `{} → WorkflowModel要約` | `reader.getWorkflow()`（FR-2.1） ``. M3 (line 31-35) is the sole `getNextStep()` caller, per contract row `component-methods.md:46` (`aidlc_next_steps` → `reader.getNextStep()`). No deviation remains.

- **Finding 2 (M4 `guardPath` nonexistent export / duplicate ambiguity) — RESOLVED.** `reader-core/functional-design/domain-entities.md:90` now declares it explicitly as a public export: "`guardPath(recordDir, relPath): ReadResult<string>` — L6 の containment 純関数をパッケージの named export として公開する（dashboard-server の AnswerWriter・mcp-server の read_artifact が境界検査に再利用）". mcp-server's M4 (lines 39-44) and BR-MS-2 (`business-rules.md:11`) both now describe the server-side pre-check and `reader.readArtifact`'s internal check as **the same implementation called twice** ("同関数を reader.readArtifact も内部で使う = 同一実装の二重呼出。独立実装の重複ではなく…"), not an independent reimplementation. This is also consistent with the contract's own framing at `component-methods.md:28` ("3ベクタ拒否は呼出側 mcp/dashboard-server でも二重に検査") and row 47 ("3ベクタ検査 → `reader.readArtifact()`"). No ambiguity remains — single implementation, dual call sites, contract-consistent.

- **Regression scan.** Re-read both files end to end (M1-M5, ReadResult→MCP mapping table, error handling, BR-MS-1..6). No new contradictions introduced by the revision: BR-MS-1 (read-only), BR-MS-3 (fail-soft, no MCP isError for data failures), BR-MS-4 (no AI summarization), BR-MS-5 (process survives), BR-MS-6 (Japanese + JSON) are all unchanged and still consistent with `business-logic-model.md`'s tool descriptions. M2/M5's `bridge.resolveStage`/`bridge.resolveTerm` calls match `component-methods.md:45,48`.
  - Minor, non-blocking, pre-existing (unrelated to this revision): M1's output line ("`出力: phase / currentStage / unit / gate / done / total`") names a `unit` field that `WorkflowModel` (`reader-core/functional-design/domain-entities.md:28-41`) does not define. This line was not touched by the fix and is outside this iteration's re-verification scope — flagging for the unit's own follow-up, not blocking here.

Both blocking findings from iteration 1 are confirmed fixed against the contract and the sibling reader-core export declaration. No regressions found.
