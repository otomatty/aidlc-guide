# Code Structure — AIDLC Guide

> Reverse-engineering 合成（intent `260923-docs-ask-chat`）  
> Repo: `aidlc-guide` · Full rescan 2026-09-24 · Commit: `1702755bcfa54e25ffa99afcce25d834efad23d9`

## パッケージ構成

ルート `package.json` の `workspaces: packages/*` による bun monorepo。ビルド依存の方向は `packages/README.md` と各 `package.json` から次のとおり。

| パッケージ | 種別 | 役割 |
|------------|------|------|
| `aidlc-guide`（root） | オーケストレーション | `bun run check` / test / build スクリプト |
| `@aidlc-guide/shared-types` | library | ワイヤ契約（`docs-qa.ts` 含む） |
| `@aidlc-guide/core-utils` | library | `guardPath` 等の読取境界 |
| `@aidlc-guide/reader-core` | library | aidlc レコード読取（UI 非依存） |
| `@aidlc-guide/docs-bridge` | library | slug/用語 → docs 対応 |
| `@aidlc-guide/official-docs` | library | 同梱公式 docs の locale・検索・質問コンテキスト |
| `@aidlc-guide/api-core` | library | トランスポート非依存 API（docs-qa ジョブ含む） |
| `@aidlc-guide/dashboard` | SPA | React 19 Dashboard（DocsShell / DocsQuestionPanel） |
| `@aidlc-guide/dashboard-server` | CLI server | ローカル HTTP ホスト |
| `aidlc-guide`（`packages/vscode-extension`） | VS Code 拡張 | 第一サーフェス |
| `@aidlc-guide/mcp-server` | CLI | 読み取り MCP |
| `@aidlc-guide/btw` | CLI | plan-mode サイドセッション |

依存 DAG（要約）:

```text
shared-types
  ← core-utils / official-docs / reader-core / docs-bridge
    ← api-core
      ← dashboard-server / vscode-extension / mcp-server
dashboard → shared-types のみ（reader-core 禁止）
```

## ファイル分類とパターン（docs-qa 周辺）

### 契約層

- `packages/shared-types/src/docs-qa.ts` — `DocsQaRequest` / `DocsQaJob` / `DocsQaCitation` / `DocsQaEvidence` / `DocsQaResult<T>`
- `packages/shared-types/src/index.ts` — docs-qa の re-export

### ドメイン／検索

- `packages/official-docs/src/question-context.ts` — 質問コンテキスト組み立て（retrieval / roots を import）
- `packages/official-docs/tests/question-context.test.ts` — シード付きテスト

### アプリケーション（api-core）

| パス | 役割 |
|------|------|
| `src/docs-qa/index.ts` | ジョブ Map・同時実行1・保持ポリシー |
| `src/docs-qa/prompt.ts` | プロンプト組み立て |
| `src/docs-qa/validation.ts` | リクエスト検証（history 最大8 等） |
| `src/docs-qa/process.ts` / `scratch.ts` | ai-cli への再エクスポート |
| `src/ai-cli/process.ts` | `cliArguments` / `probeTool` |
| `src/handlers/docs-qa.ts` | ask / cancel / evidence POST |
| `src/handlers/read.ts` | `/api/docs-qa/tools`・`/job` GET |
| `src/handlers/post.ts` | POST ルータへの接続 |
| `src/service.ts` | GuideService と docsQa 生成 |

### UI（dashboard）

| パス | 役割 |
|------|------|
| `src/app/routes.ts` | `AppRoute`（docs 名のみ; チャット専用なし） |
| `src/features/docs/DocsPage.tsx` | DocsShell・citation / returnToAnswer |
| `src/features/docs/components/DocsHome.tsx` | ホーム（カテゴリ＋質問面の同居） |
| `src/features/docs/components/qa/DocsQuestionPanel.tsx` | 質問フォームと回答 Card 列 |
| `src/features/docs/hooks/useDocsQa.ts` | クライアント履歴（完了3・6000文字）とポーリング |
| `src/shared/services/docs-qa.ts` | `docsQaApi.tools\|ask\|job\|cancel\|evidence` |
| `src/shared/store/reducer.ts` | `docs-shell` 分岐 |
| `src/shell/Header.tsx` | ドキュメントメニュー |

### 繰り返し現れるパターン

1. **Result / 型付きワイヤ** — `DocsQaResult<T>` で成功・失敗を表現。
2. **ハンドラ分割** — GET（`read.ts`）と POST（`post.ts` + `docs-qa.ts`）。
3. **CLI 隔離** — docs-qa 本体は `ai-cli` を間接参照し、プロンプト／検証とプロセス起動を分離。
4. **feature フォルダ** — dashboard は `features/docs` にページ・hooks・components を集約。
5. **ホーム埋め込み Q&A** — 専用ルートではなく Docs シェル内コンポーネントとして同居。
