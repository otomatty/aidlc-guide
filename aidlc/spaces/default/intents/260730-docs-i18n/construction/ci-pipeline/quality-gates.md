# Quality Gates — Docs i18n

> ci-pipeline / 2026-08-01  
> 入力: `build-and-test-summary.md` · `build-test-results.md` · code-summaries · team/project practices

## ゲートは1つ

マージ前条件は **`bun run check` のみ**。docs-i18n 用の第二ゲートを積まない（Q1=A · project.md 単一置き場）。

## 合否（親ゲート）

| # | ステップ | 合格 | docs-i18n との接点 |
|---|----------|------|-------------------|
| 1 | biome | 指摘0 | dashboard / api-core / official-docs ソース |
| 2–4 | tsc ×3 | エラー0 | official-docs は root tsc · Shell は dashboard |
| 5 | vitest --coverage | 全件 pass + 既存閾値 | 上記 4 ユニットのテストを含む |
| 6 | audit-shards | スクリプト成功 | intent audit 衛生 |
| 7 | bun audit | 既知脆弱性0 | 依存（追加パッケージがあればここで落ちる） |

## Bolt 1 実測（build-and-test）

| チェック | 結果 |
|----------|------|
| 焦点 Vitest 48/48 | PASS（2026-08-01） |
| tsc root + dashboard | PASS |
| フル `bun run check` | 本ステージでは再実行せず — 親ゲートが真実。焦点緑を DoD 証跡とする |

## 人ゲート（自動化外）

| 項目 | いつ |
|------|------|
| Extension Docs Shell デモ（en + sourceVersion） | Bolt 1 ladder / 人間承認 |
| ja 翻訳 PR レビュー | US-07 運用（自動 publish 禁止） |
| B3/B4 deep link / Bridge | 後続 Bolt の DoD |

## 失敗時の意味（docs-i18n）

- `path_rejected` / locale テスト失敗 → NFR-2 退行。マージ不可  
- dependency-direction 失敗 → Shell が FS ライブラリを直接 import。設計違反  
- content-snapshot 失敗 → 同梱ツリーまたは manifest 欠損  
