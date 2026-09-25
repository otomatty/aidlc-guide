# API Documentation — AIDLC Guide

> Reverse-engineering 合成（intent `260923-docs-ask-chat`）  
> Repo: `aidlc-guide` · Full rescan 2026-09-24 · Commit: `1702755bcfa54e25ffa99afcce25d834efad23d9`

## 外部 API（HTTP / ワイヤ）

トランスポートは HTTP（`dashboard-server`）または拡張ホストの postMessage 相当。ハンドラ実装は `packages/api-core`。docs-qa に関する観測エンドポイントのみをここに列挙する（本スキャンの深掘り範囲）。

### Docs Q&A

| Method | Path | 実装 | 概要 |
|--------|------|------|------|
| GET | `/api/docs-qa/tools` | `handlers/read.ts` | 利用可能ツール一覧（`?recheck=true` 可） |
| GET | `/api/docs-qa/job?id=` | `handlers/read.ts` | ジョブ状態・結果照会 |
| POST | `/api/docs-qa/ask` | `handlers/post.ts` + `handlers/docs-qa.ts` | 質問開始（`DocsQaRequest`） |
| POST | `/api/docs-qa/cancel` | 同上 | 実行中ジョブ取消 |
| POST | `/api/docs-qa/evidence` | 同上 | 証拠（evidence）関連 |

### ワイヤ型（`packages/shared-types/src/docs-qa.ts`）

| 型 | 役割 |
|----|------|
| `DocsQaRequest` | 質問本文・任意 `history` 等 |
| `DocsQaJob` | ジョブ ID・状態・結果 |
| `DocsQaCitation` | 回答内引用 |
| `DocsQaEvidence` | 証拠ペイロード |
| `DocsQaResult<T>` | 成功／失敗の共通包み |

### クライアント（dashboard）

`packages/dashboard/src/shared/services/docs-qa.ts` の `docsQaApi`:

- `tools` / `ask` / `job` / `cancel` / `evidence`

### 隣接: 公式 docs 読取

| Method | Path | 備考 |
|--------|------|------|
| GET 系 | `/api/official-docs/:locale/*` | team.md 契約。本スキャンでは DocsPage の fetch 経由で確認（詳細ハンドラは深掘り外） |

## 内部 API と制約

### api-core 内部モジュール境界

| 境界 | 呼び出し元 → 先 | 内容 |
|------|-----------------|------|
| GuideService → docs-qa | `service.ts` → `docs-qa/index.ts` | ジョブ生成・管理 |
| docs-qa → validation / prompt | ジョブ実行時 | 入力検証・プロンプト |
| docs-qa → official-docs | `question-context` | 根拠コンテキスト検索 |
| docs-qa → ai-cli | `process.ts` / `scratch.ts` 経由 | CLI 起動・probe |

### 実行時制約（ファイル根拠）

| 制約 | 効果 |
|------|------|
| `hostMode` | ask / job / cancel / evidence を拒否 |
| HTTP loopback origin チェック | 非 loopback からの到達を拒否 |
| JSON + body 上限 128KB | 過大ペイロード拒否 |
| 同時実行ジョブ 1 | 追加 ask は `busy` |
| `MAX_JOBS=20` / `RETAIN_MS=30m` | 完了ジョブの保持上限と寿命 |
| サーバ `history` 最大 8 | `validation.ts` |
| クライアント完了ターン最大 3・回答 6000 文字 | `useDocsQa.ts`（サーバ上限との差あり） |

### 非 docs-qa（スキャンで言及のみ）

製品ガイド `/api/guides*`、ワークフロー読取、回答書き戻し `[Answer]:` 例外などは本フルリスキャンの深掘り対象外だが、同一 `api-core` ホスト上に共存する。
