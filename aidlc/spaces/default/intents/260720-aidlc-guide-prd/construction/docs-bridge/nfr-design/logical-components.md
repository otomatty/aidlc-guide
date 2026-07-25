# Logical Components — Unit: docs-bridge

> nfr-design (3.3) / Unit: docs-bridge / 2026-07-24
> 入力: functional-design 3文書（D1〜D4）+ 本ステージ設計文書

## モジュール構成（packages/docs-bridge/src/）

| モジュール | 責務 | 依存 |
|-----------|------|------|
| `data/bridge-map.json` | 対応表（単一ソース — BR-DB-1）。sourceVersion + stages + terms | — |
| `config.ts` | D1: loadConfig（既定探索・検証・warnings） | node:fs read系 |
| `resolve.ts` | D2/D3: resolveStage / resolveTerm（map 参照 + excerpt 添付）。**config は引数で受ける純関数** `resolveStage(config, slug)` | data, excerpt.ts |
| `excerpt.ts` | docs ファイルの節スライス（anchor 正規化 + 見出し境界）+ guardPath 相当検査 | node:fs read系 |
| `links.ts` | D4: projectLinks。**config を引数で受ける** `projectLinks(config)` | — |
| `index.ts` | 公開 API（withResult で包んだ4メソッド）。**createBridge(configPath?) が D1 loadConfig を1回実行して config を保持し、resolve/links へ引数で渡す**（config 依存の配線はここに集約 — resolve.ts/links.ts は config.ts に依存しない） | 全上記 |

## データフロー

```
createBridge(configPath?) ─ loadConfig（D1・1回）→ config を内部保持
  ├ resolveStage(slug) → resolve.ts(config, slug): map.stages[slug] → (config.docsRepoPath あり) → excerpt.ts（guard→read→slice）→ StageDoc
  ├ resolveTerm(term)  → resolve.ts(config, term): map.terms[norm(term)] → 同上 → TermDoc
  └ projectLinks()     → links.ts(config): config.projectLinks
```

公開4メソッドのシグネチャは component-methods.md どおり（config は createBridge が閉じ込め、呼出側は渡さない）。

全 async・全 ReadResult（warnings は shared-types 正準形）。テスト: resolve 分岐網羅 + data-lint（map 実在検証、ローカルゲート）+ 等価性テストベクタ（guardPath 複製の等価担保 — security-design S-DB-2）。

## Review

**Verdict:** READY

- **Config threading (blocking, iteration 1) — resolved.** モジュール表: `resolve.ts` 依存 = `data, excerpt.ts`（config.ts なし）、`links.ts` 依存 = `—`（config.ts なし）。両者とも `config は引数で受ける純関数`。`index.ts` 行に「resolve.ts/links.ts は config.ts に依存しない」と明記、config 配線は `createBridge` に集約。データフロー図の `resolve.ts(config, slug)` / `links.ts(config)` と一致。公開4メソッドのシグネチャ（呼出側は config を渡さない）も維持と明記。
- **R-DB-4 skip nuance（non-blocking, iteration 1）— resolved.** `reliability-design.md`: 「skip は本 Unit 単体時のみ許容。build-and-test（3.6）では docs clone を前提に必須化」で運用差分が明示された。
- **Regression** — 両ファイル間で withResult ラッパー・4メソッド・依存方向の記述に新たな矛盾なし。config.ts の唯一の依存元は index.ts のままで、循環依存は見られない。
