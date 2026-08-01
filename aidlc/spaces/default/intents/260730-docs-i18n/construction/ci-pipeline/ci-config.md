# CI Configuration — Docs i18n

> ci-pipeline / 2026-08-01  
> 入力: 6 Unit `code-summary.md` + `build-and-test-summary.md` + `build-test-results.md` + Q1=A  
> 決定: **既存パイプラインを再利用**。docs-i18n 専用 workflow / job は追加しない。

## 適用しない標準要素

| 標準要素 | 扱い |
|---------|------|
| CodePipeline / CodeBuild / ECR / S3 | 該当なし（クラウド Forbidden） |
| docs-i18n 専用 GitHub Actions job | **作らない**（Q1=A） |
| CD / 環境プロモーション | Operation SKIP · local extension only |
| 自動翻訳 publish | Forbidden（human PR のみ） |

## パイプライン（既存・変更なし）

単一ゲート `bun run check` を2系統から呼ぶ（project.md: 呼び出し側は列挙しない）:

```
                    ┌─ scripts/hooks/pre-push ──┐
bun run check ◀─────┤                            │
                    └─ .github/workflows/check.yml ┘
```

`package.json` の `check`（真実）:

```
biome check .
&& tsc --noEmit
&& tsc --noEmit -p packages/dashboard
&& tsc --noEmit -p packages/vscode-extension
&& vitest run --coverage
&& bun scripts/check-audit-shards.ts
&& bun audit
```

Workflow: `.github/workflows/check.yml` — `main` push/PR · matrix ubuntu/windows/macos · `bun install --frozen-lockfile` · `bun run check`.

## docs-i18n との関係

| Unit | CI への載せ方 |
|------|----------------|
| content-snapshot | Vitest `content-snapshot.test.ts`（workspace `docs/`） |
| official-docs | `packages/official-docs/tests/*` |
| docs-api | `packages/api-core/tests/official-docs-routes.test.ts` |
| docs-shell | `packages/dashboard/tests/docs-shell.test.tsx` + dependency-direction |
| docs-navigation | B3/B4 まで CI 追加なし（stub） |
| diff-report | stub script only · B5 |

Bolt 1 焦点スイート（48 tests）はフル `vitest run --coverage` に含まれる。専用 path filter job は不要。

## 変更差分

**本 intent による CI ファイル変更: なし。**  
設定の「成果物」は本ドキュメントと `quality-gates.md` による方針固定のみ。
