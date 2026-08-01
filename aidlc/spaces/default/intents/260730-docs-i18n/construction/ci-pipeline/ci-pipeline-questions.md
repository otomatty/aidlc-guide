# CI Pipeline 質問 — Docs i18n

> ci-pipeline / lead: pipeline-deploy / 2026-08-01  
> 入力: 6 Unit `code-summary.md` + `build-and-test-summary.md` + `build-test-results.md`  
> 前提: 親ワークスペースに既に `.github/workflows/check.yml`（=`bun run check`）がある。project.md: ゲート定義は `package.json` の `check` が単一の真実。AWS / 成果物レジストリは Forbidden。

## Q1: docs-i18n のために CI をどう扱うか

Bolt 1 の自動検証（official-docs / docs-api / Docs Shell）は既存 Vitest スイートに含まれ、`bun run check` 経由で走る。

- A. **既存のまま再利用**（推奨）— 新規 workflow / job を追加しない。ドキュメントで公式 docs 経路が `check` に載ることを明記するだけ
- B. `official-docs` 焦点スイート専用の GitHub Actions job を追加する
- C. 文書のみ（現状 workflow も変更しないし、本 intent の ci-config も「変更なし」に留める）

[Answer]: A（既存のまま再利用 — stop-hook / recommended default）

## Q2: ブランチ戦略・マージ前ゲート（再確認 — 開かない）

org.md / team.md / project.md で確定済み:

- trunk-based · 短命ブランチ · `main` へ squash-merge
- マージ前ゲート: `bun run check`（Biome + tsc ×2 + vitest --coverage + audit-shards + bun audit）
- コンテンツ（en/ja スナップショット）も同じ trunk 上の短命ブランチ（locale 専用長寿命ブランチ禁止）

[Answer]: 確定済み。再質問しない。

## Q3: 成果物リポジトリ / CD

- 該当なし（ローカル拡張。Operation stages SKIP。クラウドデプロイなし）

[Answer]: N/A
