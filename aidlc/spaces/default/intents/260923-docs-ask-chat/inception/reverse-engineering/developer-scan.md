## Developer Code Scan Results

Brownfield monorepo `aidlc-guide`（workspace root `.`）の Full rescan（本試行で開いたファイルのみを根拠、2026-09-24）。意図は「ドキュメントの AI 質問について、現状のような回答表示ではなく、質問したらチャット形式の画面に遷移し、そこで繰り返し質問できるようにする」。九つの CodeKB 成果物は本ハンドオフでは書かない。

### Scan Coverage
- **Analyzed deeply**:
  - `package.json`
  - `vitest.config.ts`
  - `README.md`
  - `packages/README.md`
  - `.oxlintrc.json`
  - `.oxfmtrc.json`
  - `.github/workflows/check.yml`
  - `packages/shared-types/package.json`
  - `packages/shared-types/src/index.ts`（冒頭定数 + docs-qa re-export）
  - `packages/shared-types/src/docs-qa.ts`
  - `packages/core-utils/package.json`
  - `packages/reader-core/package.json`
  - `packages/docs-bridge/package.json`
  - `packages/official-docs/package.json`
  - `packages/official-docs/src/question-context.ts`
  - `packages/official-docs/tests/question-context.test.ts`（冒頭〜シード）
  - `packages/api-core/package.json`
  - `packages/api-core/src/service.ts`（docsQa 生成〜GuideService）
  - `packages/api-core/src/docs-qa/index.ts`
  - `packages/api-core/src/docs-qa/prompt.ts`
  - `packages/api-core/src/docs-qa/validation.ts`
  - `packages/api-core/src/docs-qa/process.ts`（ai-cli 再エクスポート）
  - `packages/api-core/src/docs-qa/scratch.ts`（ai-cli/scratch 再エクスポート）
  - `packages/api-core/src/ai-cli/process.ts`（cliArguments / probeTool）
  - `packages/api-core/src/handlers/docs-qa.ts`
  - `packages/api-core/src/handlers/post.ts`
  - `packages/api-core/src/handlers/read.ts`（`/api/docs-qa/tools`・`/job`）
  - `packages/api-core/tests/docs-qa.test.ts`（冒頭〜ジョブ fixture）
  - `packages/api-core/tests/docs-qa-routes.test.ts`（冒頭〜fixture）
  - `packages/dashboard/package.json`
  - `packages/dashboard/src/app/routes.ts`
  - `packages/dashboard/src/shared/store/reducer.ts`（`docs-shell` 分岐）
  - `packages/dashboard/src/features/docs/DocsPage.tsx`
  - `packages/dashboard/src/features/docs/components/DocsHome.tsx`
  - `packages/dashboard/src/features/docs/components/qa/DocsQuestionPanel.tsx`
  - `packages/dashboard/src/features/docs/hooks/useDocsQa.ts`
  - `packages/dashboard/src/features/docs/hooks/useDocsQa.test.tsx`（冒頭〜transport mock）
  - `packages/dashboard/src/shared/services/docs-qa.ts`
  - `packages/dashboard/src/shell/Header.tsx`（ドキュメントメニュー）
  - `packages/dashboard-server/package.json`
  - `packages/vscode-extension/package.json`（冒頭〜contributes）
  - `packages/btw/package.json`
  - `packages/mcp-server/package.json`
- **Skimmed only**:
  - `packages/dashboard/src/features/docs/components/qa/EvidenceApplier.tsx` / `AnchorApplier.tsx`（パス確認のみ）
  - `packages/dashboard/src/features/docs/DocsPage.test.tsx`（docs-shell 排他テスト名のみ）
  - `packages/api-core/src/ai-cli/scratch.ts` / `copilot.ts`（docs-qa から間接参照、未全文）
  - `packages/official-docs/src/retrieval*.ts` / `roots.ts`（question-context からの import 先）
  - `packages/reader-core/` / `docs-bridge/` / `core-utils/` ソース本体
  - `packages/vscode-extension/src/`（拡張ホスト配線）
  - `packages/dashboard-server/src/`
  - `docs/` コンテンツツリー、`.claude/` / `.cursor/` ハーネスツリー、`aidlc/` ランタイム状態

### Packages Found
- `aidlc-guide`（root） — private workspace — TypeScript / bun — monorepo オーケストレーション（`workspaces: packages/*`）
- `@aidlc-guide/shared-types` — library — TypeScript — wire 契約（docs-qa 型を含む）
- `@aidlc-guide/core-utils` — library — TypeScript — `guardPath` 等の読み取り境界
- `@aidlc-guide/reader-core` — library — TypeScript — aidlc レコード読取（UI 非依存）
- `@aidlc-guide/docs-bridge` — library — TypeScript — slug/用語 → docs 対応
- `@aidlc-guide/official-docs` — library — TypeScript — 同梱公式 docs の locale 解決・検索・質問コンテキスト
- `@aidlc-guide/api-core` — library — TypeScript — トランスポート非依存 API（docs-qa ジョブ含む）
- `@aidlc-guide/dashboard` — SPA — TypeScript / React 19 — Dashboard UI（DocsShell / DocsQuestionPanel）
- `@aidlc-guide/dashboard-server` — CLI server — TypeScript / Bun — ローカル HTTP ホスト
- `aidlc-guide`（`packages/vscode-extension`） — VS Code 拡張 — TypeScript — 第一サーフェス（Webview + in-process api-core）
- `@aidlc-guide/mcp-server` — CLI — TypeScript — 読み取り MCP
- `@aidlc-guide/btw` — CLI — TypeScript — plan-mode サイドセッション

### Build System
- **Type**: bun workspaces + Vite（dashboard）+ Vitest; 拡張は `packages/vscode-extension` の build/package
- **Config Files**: `package.json`, `bun.lock`, `tsconfig.json`, `vitest.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json`, `packages/dashboard` Vite build（root scripts `build:dashboard` / `build:dashboard:webview`）
- **Build Dependencies**: `shared-types` ← `core-utils` / `official-docs` / `reader-core` / `docs-bridge` ← `api-core` ← `dashboard-server` / `vscode-extension` / `mcp-server`; `dashboard` は `shared-types` のみ依存（`reader-core` を import しない）

### APIs Discovered
- REST（GET） — `packages/api-core/src/handlers/read.ts` — `/api/docs-qa/tools`（`?recheck=true` 可）、`/api/docs-qa/job?id=`
- REST（POST） — `packages/api-core/src/handlers/post.ts` + `handlers/docs-qa.ts` — `/api/docs-qa/ask`、`/api/docs-qa/cancel`、`/api/docs-qa/evidence`
- Wire 型 — `packages/shared-types/src/docs-qa.ts` — `DocsQaRequest` / `DocsQaJob` / `DocsQaCitation` / `DocsQaEvidence` / `DocsQaResult<T>`
- Client — `packages/dashboard/src/shared/services/docs-qa.ts` — `docsQaApi.tools|ask|job|cancel|evidence`
- 公式 docs 読取 API（隣接） — `/api/official-docs/:locale/*`（team.md 契約; 本スキャンでは DocsPage の fetch 呼び出し経由で確認）
- 制約（ファイル根拠）: `hostMode` で ask/job/cancel/evidence が拒否; HTTP は loopback origin チェック・JSON・128KB body 上限; 同時実行ジョブは 1（`busy`）; ジョブ保持最大 20・完了後 30 分

### Frameworks & Libraries
- bun — `1.3.6`（`packageManager`）— ランタイム / パッケージマネージャ
- TypeScript — `^7.0.2` — 言語
- React / react-dom — `^19.3.0` — dashboard UI
- Vitest / `@vitest/coverage-v8` — `^5.0.1` — テスト・カバレッジ
- Vite — `^8.2.2` — dashboard ビルド
- oxlint — `^1.83.0` — lint
- oxfmt — `0.68.0` — format
- Tailwind CSS — `^4.3.3`（dashboard）— スタイル
- lucide-react — アイコン（質問 UI）
- `@aidlc-guide/official-docs` — 質問コンテキスト検索（api-core 依存）

### Test Coverage
- **Test Directories**: `packages/*/tests/**/*.test.ts`（node project）、`packages/dashboard/src/**/*.test.{ts,tsx}` および `packages/dashboard/tests/**`（jsdom project）、`scripts/**/*.test.ts`
- **Test Frameworks**: Vitest（root `bun run test` / `test:coverage`）
- **Coverage Config**: present — `vitest.config.ts` v8; branch 95% floors for `reader-core/src/parse/**` and selected `official-docs` resolve/roots/markdown; docs-qa 専用 floor は未設定。関連テスト: `packages/api-core/tests/docs-qa.test.ts`、`docs-qa-routes.test.ts`、`packages/official-docs/tests/question-context.test.ts`、`packages/dashboard/src/features/docs/hooks/useDocsQa.test.tsx`

### Code Quality Indicators
- **Linting**: oxlint（`.oxlintrc.json`）、format oxfmt（`.oxfmtrc.json`）; root `bun run check` が単一ゲート
- **CI/CD**: `.github/workflows/check.yml` — `bun run check` を鏡像; workflows-compatibility job あり; クラウド CD なし（local-only）
- **Documentation**: root `README.md`、`packages/README.md`（依存方向）、製品ガイド `docs/guides/`; docs-qa モジュールはコメントで CLI 隔離・引用バインド方針を明示

### Technical Debt Signals
- Q&A 結果は in-memory `Map`（プロセス再起動で消失; `MAX_JOBS=20` / `RETAIN_MS=30m`）— `packages/api-core/src/docs-qa/index.ts`
- `AppRoute` にチャット専用バリアントは無く、Q&A は `name: "docs"` 内のホーム埋め込み — `packages/dashboard/src/app/routes.ts`
- ホーム上で質問カード・回答カード・カテゴリカードが同一スクロール面に共存 — `DocsHome.tsx` + `DocsQuestionPanel.tsx`
- クライアント履歴は完了ターン最大 3・回答 6000 文字、サーバ `history` は最大 8 — `useDocsQa.ts` / `validation.ts`（UI とバリデーション上限の差）
- Citation クリックで記事ビューへ遷移し、ホーム Q&A 面から離れる — `DocsPage.tsx` `onCitation` / `returnToAnswer`

## Handoff Summary
- **Intent-relevant finding**: 現状の「ドキュメントについて質問」は専用チャット画面へ遷移しない。`DocsShell`（`route.name === "docs"`）のトップ `DocsHome` に `DocsQuestionPanel` を埋め込み、回答は同一ページ上の `Card` 列（`data-testid="docs-answer"`）として積み上がる（`DocsPage.tsx` 486–497 行付近、`DocsQuestionPanel.tsx` 208–279 行）。繰り返し質問はフォームラベル「続けて質問する」と、完了ターン最大 3 件を `history` として `POST /api/docs-qa/ask` に送る仕組みで既に可能（`useDocsQa.ts` 115–137 行）だが、UX はホーム埋め込みのカード列であり、意図が求める「チャット形式画面への遷移」ルートは `AppRoute` に存在しない（`routes.ts` 9–18 行）。
- **Risks / follow-up**: チャット画面化は主に dashboard のルーティング／レイアウト変更になる一方、ワイヤ契約（`shared-types/docs-qa.ts`）とジョブ API（ask/job/cancel/evidence）・retrieval（`official-docs/question-context.ts`）は会話継続用 `history` を既に持つ。Citation→根拠文書表示と「回答に戻る」は同一シェル内の `selection`/`reference` 状態に結合しているため、画面分離時はスクロール復帰・下書き保持・`hostMode` 無効化の契約を崩さないことが必要。Architect は本ハンドオフのみを読み、九 CodeKB は本試行では未更新。
