# Logical Components — Unit: reader-core

> nfr-design (3.3) / Unit: reader-core / 2026-07-24
> 入力: functional-design 3文書（L1〜L7）+ 本ステージ4設計文書

## モジュール構成（packages/reader-core/src/ + packages/shared-types/）

| モジュール | 責務 | 依存 |
|-----------|------|------|
| `shared-types/index.ts` | 全公開型（ReadResult, WorkflowModel, Matrix, AuditEvent, IntentList, ChangeEvent, NextStep, 標準 reason 列挙） | — |
| `parse/state.ts` | L1: G-1〜G-6 行指向パース（Version 依存の唯一の場所） | util |
| `tree/matrix.ts` | L2: buildMatrix / buildMatrixForUnit（tail 読み verdict） | util |
| `audit/events.ts` | L3: シャード抽出・マージ | util |
| `intents/resolve.ts` | L4: cursor 解決・列挙 | util |
| `watch/watcher.ts` | L5: chokidar + debounce + scope 分類 + 再購読 | chokidar |
| `util/guard-path.ts` | L6 の containment 純関数 `guardPath`（S-RC-2）。**パッケージの named export に含める**（dashboard-server の AnswerWriter パスゲートが再利用 — 消費側契約） | node:path |
| `util/read-bounded.ts` | 10MB bound 読取ヘルパー（S-RC-4） | node:fs |
| `util/with-result.ts` | throw→ReadResult 正規化（R-RC-1） | — |
| `index.ts` | L7 ファサード `createReader`（recordDir 毎回解決・no-active-intent 分岐） | 全上記 |

## データフロー

```
createReader(rootPath)
  └ 各メソッド呼出 → intents/resolve（recordDir 導出）
       ├ getWorkflow  → read-bounded → parse/state
       ├ getMatrix    → parse/state(slugs) → tree/matrix（全走査・起動時）
       ├ (change時)   → tree/matrix.buildMatrixForUnit（部分）
       ├ getAuditEvents → read-bounded → audit/events   ← シャードも 10MB bound（S-RC-4 の3経路目）
       ├ getNextStep  → parse/state 由来モデルから導出
       ├ readArtifact → guard-path → read-bounded   ← containment を先に実行（設計上書き: L6 の step 0/1 番号と逆順だが、境界拒否を bound より先に行う方が安全側。stat すら記録外パスに発行しない）
       └ watch        → watch/watcher →（cb）消費者が該当メソッドを再呼出
```

単方向・状態なし（watcher の購読状態のみ）。全モジュール純関数中心で Vitest 対象、watch のみタイマーモック + 実FS スモーク。UI/トランスポート import ゼロ（依存方向テストは package.json + import 走査で検証 — BR-RC-3）。

## Review

**Verdict:** READY (iteration 2 / final)

- **Finding 1 (WatchEvent union) — resolved.** `functional-design/domain-entities.md:70-79` now defines `ChangeEvent` / `WatchWarning` / `type WatchEvent = ChangeEvent | WatchWarning`. `functional-design/business-logic-model.md:73` (L5) updates the cb contract to `cb({type:"watch-warning", reason})` and explicitly cites "WatchEvent 判別可能ユニオン". `nfr-design/reliability-design.md:13,19` (R-RC-4) references the same union and the same source file for both the resubscribe-failure and watcher-lost paths. All three artifacts agree on the type shape and its origin.
- **Finding 2 (audit path missing read-bounded) — resolved.** `logical-components.md:29` dataflow now reads `getAuditEvents → read-bounded → audit/events ← シャードも 10MB bound（S-RC-4 の3経路目）`, closing the gap where shard reads bypassed the bound helper.
- **Note (containment-before-bound order vs L6 numbering) — resolved.** `logical-components.md:31` now reads `readArtifact → guard-path → read-bounded ← containment を先に実行（設計上書き: L6 の step 0/1 番号と逆順だが、境界拒否を bound より先に行う方が安全側。stat すら記録外パスに発行しない）` — the deviation from `business-logic-model.md` L6's step 0 (size bound) / step 1-3 (path containment) ordering is now called out as a deliberate, justified override rather than left as a silent mismatch.
- **Regression check:** No new contradictions found across the four re-read documents. Minor non-blocking observation: the public-type list in the module table (`logical-components.md:10`) enumerates `ChangeEvent` but not `WatchWarning`/`WatchEvent` explicitly among `shared-types/index.ts` exports — harmless since `ChangeEvent` is listed and the union is fully specified in domain-entities.md, but worth a one-line addition next time this file is touched.
