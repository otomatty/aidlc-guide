# Component Inventory — AIDLC Guide

> Reverse-engineering 合成（intent `260923-docs-ask-chat`）  
> Repo: `aidlc-guide` · Full rescan 2026-09-24 · Commit: `1702755bcfa54e25ffa99afcce25d834efad23d9`

## コンポーネント一覧

各見出し名は Scope of Analysis の `analyzed.components` と文字一致する。

### shared-types

- **責任**: パッケージ横断のワイヤ／共有型。docs-qa 契約（`DocsQaRequest` 等）を含む。
- **依存**: なし（最下層）。
- **被依存**: core-utils, official-docs, reader-core, docs-bridge, api-core, dashboard。
- **健全性**: healthy — 契約の単一ソース。

### core-utils

- **責任**: `guardPath` など読み取り境界・パス containment。
- **依存**: shared-types。
- **被依存**: reader-core, docs-bridge, official-docs（およびそれら経由の api-core）。
- **健全性**: healthy — 単一 enforcement point。

### reader-core

- **責任**: aidlc レコード読取（UI 非依存パーサ）。
- **依存**: shared-types, core-utils。
- **被依存**: api-core, mcp-server。
- **健全性**: healthy — dashboard からの直接 import 禁止。
- **備考**: 本スキャンではパッケージ境界と役割のみ（ソース本体は skim）。

### docs-bridge

- **責任**: slug / 用語 → 公式・方法論 docs 対応マップ。
- **依存**: shared-types, core-utils。
- **被依存**: api-core, mcp-server。
- **健全性**: healthy。
- **備考**: ソース本体は skim。

### official-docs

- **責任**: 同梱公式 docs の locale 解決・検索・**質問コンテキスト**（`question-context.ts`）。
- **依存**: shared-types, core-utils（retrieval / roots を内部利用）。
- **被依存**: api-core（docs-qa）。
- **健全性**: healthy — docs-qa の根拠供給点。
- **本 intent**: チャット UX 変更でもこの境界は再利用可能。

### api-core

- **責任**: トランスポート非依存 API。docs-qa ジョブ、handlers、GuideService、ai-cli 連携。
- **依存**: shared-types, reader-core, docs-bridge, official-docs。
- **被依存**: dashboard-server, vscode-extension,（間接的に）dashboard クライアント。
- **健全性**: at-risk（ジョブの揮発メモリ・同時実行1は意図的だが永続チャットには不足）。
- **サブモジュール**: `docs-qa/*`, `handlers/docs-qa.ts`, `handlers/read.ts`, `ai-cli/*`。

### dashboard

- **責任**: React SPA。DocsShell / DocsHome / DocsQuestionPanel / useDocsQa。
- **依存**: shared-types のみ（reader-core 禁止）。
- **被依存**: vscode-extension（webview）、dashboard-server（静的配信）。
- **健全性**: at-risk（本 intent）— チャット専用ルート欠如; ホーム埋め込み Q&A。
- **キーUI**: `DocsQuestionPanel`, `DocsHome`, `DocsPage`, `docsQaApi`。

### dashboard-server

- **責任**: ローカル HTTP で SPA + api-core をホスト。
- **依存**: api-core（およびビルド成果の dashboard）。
- **健全性**: healthy（役割明確）。
- **備考**: ソースは skim。

### vscode-extension

- **責任**: 第一サーフェス。Webview + in-process api-core。
- **依存**: api-core, dashboard 成果物。
- **健全性**: healthy。
- **備考**: `package.json` contributes まで深掘り; `src/` は skim。

### mcp-server

- **責任**: 読み取り MCP ツール。
- **依存**: reader-core, docs-bridge 等。
- **健全性**: healthy。
- **備考**: package.json レベル。docs-qa とは直接結合しない。

### btw

- **責任**: plan-mode サイドセッション CLI。
- **依存**: ルートワークスペース設定に従う。
- **健全性**: healthy（本 intent 非中心）。
- **備考**: package.json レベル。

## 依存関係サマリ（docs-qa 経路）

```text
User → dashboard(DocsQuestionPanel/useDocsQa/docsQaApi)
     → api-core(handlers + docs-qa jobs + ai-cli)
     → official-docs(question-context)
     → （プロンプト経由）外部 AI CLI
```

チャット画面化の変更中心は **dashboard**。ワイヤとジョブ API・retrieval は会話継続用 `history` を既に持つため、契約破壊なしで UI 分離が可能、というスキャン結論に整合する。
