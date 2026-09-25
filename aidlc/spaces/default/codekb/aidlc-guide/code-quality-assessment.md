# Code Quality Assessment — AIDLC Guide

> Reverse-engineering 合成（intent `260923-docs-ask-chat`）  
> Repo: `aidlc-guide` · Full rescan 2026-09-24 · Commit: `1702755bcfa54e25ffa99afcce25d834efad23d9`

## テスト・Lint・CI・ドキュメント

### テスト

| 項目 | 観測 |
|------|------|
| ランナー | Vitest（root `bun run test` / `test:coverage`） |
| 配置 | `packages/*/tests/**/*.test.ts`（node）; `packages/dashboard/src/**/*.test.{ts,tsx}` と `packages/dashboard/tests/**`（jsdom）; `scripts/**/*.test.ts` |
| カバレッジ設定 | `vitest.config.ts` v8。`reader-core/src/parse/**` と選定 `official-docs` resolve/roots/markdown に branch 95% 床 |
| docs-qa 専用床 | **未設定** |
| 関連テスト | `api-core/tests/docs-qa.test.ts`, `docs-qa-routes.test.ts`, `official-docs/tests/question-context.test.ts`, `dashboard/.../useDocsQa.test.tsx` |
| DocsPage | `DocsPage.test.tsx` で docs-shell 排他（skim; テスト名のみ確認） |

### Lint / Format / 単一ゲート

- oxlint（`.oxlintrc.json`）、oxfmt（`.oxfmtrc.json`）
- **単一品質ゲート** `bun run check`（呼び出し側はこれを呼ぶだけ）
- CI: `.github/workflows/check.yml` が `bun run check` を鏡像; workflows-compatibility job あり
- クラウド CD なし（local-only; リリース = squash-merge / タグ）

### ドキュメント

- root `README.md`, `packages/README.md`（依存方向）
- 製品ガイド `docs/guides/`
- docs-qa モジュールはコメントで CLI 隔離・引用バインド方針を明示

## 技術的負債とリスク（本 intent）

| 信号 | 場所 | 影響 |
|------|------|------|
| Q&A 結果が in-memory Map | `api-core/src/docs-qa/index.ts` | 再起動で消失; MAX_JOBS=20 / RETAIN_MS=30m |
| チャット専用 `AppRoute` なし | `dashboard/src/app/routes.ts` | 意図する「チャット画面遷移」が未実装 |
| ホームに質問・回答・カテゴリが同居 | `DocsHome.tsx` + `DocsQuestionPanel.tsx` | UX がカード列; チャット面ではない |
| 履歴上限の UI/サーバ差 | `useDocsQa.ts`（完了3・6000字）vs `validation.ts`（history 8） | 会話継続の体感と契約のずれ |
| Citation で記事ビューへ離脱 | `DocsPage.tsx` `onCitation` / `returnToAnswer` | 画面分離時に復帰・下書き・hostMode 契約維持が必要 |
| docs-qa 専用 coverage floor なし | `vitest.config.ts` | 回帰床は関連テストの存在に依存 |

### 総合評価

品質ゲートと docs-qa の自動テスト基盤は存在する。本 intent 向けの主なギャップは **テスト不足というより UX アーキテクチャ（ルート／レイアウト）** である。バックエンドの会話継続契約は既にあり、チャット画面化の変更は dashboard 中心・契約温存が妥当。
