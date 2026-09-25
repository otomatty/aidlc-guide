# Business Overview — AIDLC Guide

> Reverse-engineering 合成（intent `260923-docs-ask-chat`）  
> Repo: `aidlc-guide` · Full rescan 2026-09-24 · Commit: `1702755bcfa54e25ffa99afcce25d834efad23d9`

## ドメインと目的

AIDLC Guide は、AI-DLC（AI-Driven Development Life Cycle）の学習・オリエンテーション向け **ローカル専用** プロダクトである。クラウド・CMS・AWS を持たず、主に次の価値を返す。

1. **VS Code / Cursor 拡張**（第一サーフェス）— Webview に Dashboard を載せ、`api-core` を拡張ホスト内で in-process 実行する。
2. **ワークフロー現在地の可視化** — `aidlc/spaces/.../intents/...` レコードの読み取り（`reader-core`）と段階的初回描画。
3. **公式ドキュメントのオフライン閲覧** — `docs/guide|<locale>` / `docs/reference|<locale>` と `/api/official-docs/:locale/*`。
4. **ドキュメントへの AI 質問（docs-qa）** — 同梱 docs を根拠に CLI 経由で回答し、引用（citation）と証拠（evidence）を返す。

本 intent の焦点は「ドキュメントの AI 質問」である。現状は回答を専用チャット画面へ遷移させず、Docs ホームに埋め込まれたパネル上のカード列として積み上げる。意図は「質問したらチャット形式の画面に遷移し、そこで繰り返し質問できる」UX への変更である。

## 主要機能（スキャン時点）

| 機能 | ビジネス価値 | 主な所有パッケージ |
|------|--------------|-------------------|
| ワークフロー Now / Stage rail | 初学者が現在地をすぐ説明できる | `reader-core`, `api-core`, `dashboard` |
| 公式 docs 閲覧（en/ja） | オフラインでガイド・リファレンスを読む | `official-docs`, `api-core`, `dashboard` DocsShell |
| Docs Bridge / 用語・ステージ深リンク | 作業点で方法論を開く | `docs-bridge`, 拡張 `open-official-doc` |
| Docs Q&A（ask / job / cancel / evidence） | 同梱 docs に対する AI 質問と引用付き回答 | `shared-types`（契約）, `official-docs`（質問コンテキスト）, `api-core`（ジョブ）, `dashboard`（UI） |
| Mob / ブラウザ副経路 | 拡張なし参加者向け HTTP ホスト | `dashboard-server` |
| MCP / BTW | エージェント向け読取・plan-mode サイドセッション | `mcp-server`, `btw` |

## ステークホルダーとサーフェス

| ペルソナ | 第一サーフェス | 備考 |
|----------|----------------|------|
| IDE 上の学習者 | VS Code / Cursor 拡張 Webview | 拡張優先（DECIDED） |
| 拡張なしのモブ参加者 | `dashboard-server` 経由ブラウザ | 同一 `api-core` |
| docs-qa 利用者 | Docs ホーム内 `DocsQuestionPanel` | 現状チャット専用ルートなし |
| メンテナ | monorepo + VSIX | `bun run check` が単一品質ゲート |

## 本 intent への関連（現状のギャップ）

- **繰り返し質問そのもの**は既に存在する（完了ターンを `history` として `POST /api/docs-qa/ask` に送る）。
- **欠けているのは画面遷移** — `AppRoute` にチャット専用バリアントがなく、Q&A は `route.name === "docs"` のホーム埋め込みである。
- Citation クリックで記事ビューへ移り「回答に戻る」は同一シェル内の `selection` / `reference` 状態に結合している。チャット画面分離時は、下書き・スクロール復帰・`hostMode` 無効化契約を崩さないことが要件になる。
