# Business Logic Model — Unit: docs-bridge

> functional-design (3.1) / Unit: docs-bridge (kind: library, S) / 2026-07-24
> 入力: unit-of-work.md U2 + unit-of-work-story-map.md（US-23）+ requirements.md（FR-5）+ components.md C3 + component-methods.md + services.md

## 処理フロー

### D1: `loadConfig(path?)` — 設定ロード（FR-5.2/5.3）

```
1. path 省略時は既定探索: <workspaceRoot>/aidlc-guide.config.json
2. 不在: {ok, value: defaultConfig}（docsRepoPath=null, projectLinks=[] — 設定なしでも起動可）
3. JSON パース不能: {error, reason:"config-invalid"}
4. 検証: docsRepoPath があれば存在確認 → 不在は {ok} のまま warnings に記録（fail-soft）
```

### D2: `resolveStage(slug)` — ステージ解説（FR-2.2 / FR-4.4 / US-03）

```
1. 対応表（内蔵 bridge-map.json の stages）から slug を引く → 未知: {error, reason:"not-found"}
2. エントリ: {purpose, inputs, outputs, agent, gateRequirement, docPath, docAnchor}
   （US-03 の4フィールド + deep-link を静的データとして所有）
3. docsRepoPath 設定済みなら docPath の実在を確認し、本文該当節（anchor 見出し配下）を抽出して添付
   docs 不在/節不在: 静的エントリのみ返し warnings（リンク切れは消費者が表示 — fail-soft）
4. {ok, value: StageDoc}
```

### D3: `resolveTerm(term)` — 用語（FR-2.5 / US-04）

```
1. 対応表（内蔵 bridge-map.json の terms）から term を正規化（小文字・トリム）して引く
2. 未知: {error, reason:"undefined-term"} / 既知: D2 と同様に docs 本文を任意添付 → {ok, value: TermDoc}
```

### D4: `projectLinks()` — プロジェクト固有リンク（FR-5.3）

```
config.projectLinks（`ProjectLink { label, target }[]` — target は相対パス or URL の統一フィールド。component-methods.md の `Link[]` はこの `ProjectLink[]` として実現）をそのまま返す（検証は D1 で済み）→ {ok, value}
```

## 単一所有の担保（FR-5.1）

対応表は**単一ファイル `bridge-map.json`**（stages + terms 同居 — S規模で分割は過剰、business-rules.md のスキーマどおり）として `packages/docs-bridge/data/` に**のみ**存在し、mcp-server と dashboard-server は本ライブラリの関数経由でのみ参照する（データファイルの直接読取・複製禁止）。cross-consumer 整合は「同一関数を呼ぶ」ことで構造的に成立（US-23 AC）。

## エラーハンドリング

全メソッド ReadResult（throw 禁止）。ReadResult は shared-types の正準定義 `{ok, value, warnings?: string[]} | {unsupported, version} | {error, reason}`（reader-core/functional-design/domain-entities.md が定義 — 同一 shared-types パッケージを共有）。docs リポジトリ不在・節欠落は error でなく `warnings` 配列付き {ok}（静的対応表だけでも価値がある — 段階的縮退）。reason 値: `"config-invalid" | "not-found" | "undefined-term"`。

## Review

**Verdict:** READY

Re-verification of the 4 iteration-1 findings, against `business-logic-model.md`, `business-rules.md`, and `domain-entities.md` (docs-bridge):

- **Blocking — warnings channel.** Resolved. BLM §エラーハンドリング now cites the canonical shared-types `ReadResult = {ok, value, warnings?: string[]} | {unsupported, version} | {error, reason}` with an explicit source cross-reference ("reader-core/functional-design/domain-entities.md が定義"), and `domain-entities.md` mirrors the same shape with an explicit "本 Unit は再定義しない" — no local redefinition. (Direct read of the sibling reader-core file was blocked by the reviewer read-scope hook for this pass; verified instead against the canonical shape `{ok,value,warnings?}` supplied in the review brief, which matches both citing artifacts verbatim.)
- **Non-blocking — one vs two data files.** Resolved and consistent both directions: BLM §単一所有の担保 states "単一ファイル `bridge-map.json`（stages + terms 同居）...業ルールのスキーマどおり", and `business-rules.md` BR-DB-1 plus the データ形式 JSON schema show one file with sibling `stages`/`terms` keys. No remaining reference to a two-file split anywhere in either doc.
- **Non-blocking — ProjectLink shape.** Resolved. `domain-entities.md` declares `interface ProjectLink { label: string; target: string; }` with an inline comment naming it the realization type of `component-methods.md` の `Link[]`; BLM D4 repeats the identical claim ("component-methods.md の `Link[]` はこの `ProjectLink[]` として実現"). Both artifacts agree on field names and the realization relationship.
- **Non-blocking — data-lint test.** Resolved. `domain-entities.md` §ライフサイクル/テスト境界 now carries a dedicated "データ検証テスト（US-03 AC ⑤）" bullet requiring docPath/docAnchor in `bridge-map.json` to resolve against the real docs tree, scoped to CI/local gates with a docs clone (skip otherwise, mandatory at build-and-test).

**Regression check:** No new contradictions surfaced. `sourceVersion` is consistently a single top-level field in the JSON schema (business-rules.md) echoed per-result into `StageDoc`/`TermDoc` (domain-entities.md) — a propagation, not a conflicting redefinition. `reason` enum (`config-invalid | not-found | undefined-term`) matches verbatim between BLM and domain-entities. BR-DB-5's "reader-core 非依存" refers to the code/package dependency graph and is not contradicted by the shared-types cross-reference, which is a documentation pointer into a separately-shared package, not an import of reader-core itself.
