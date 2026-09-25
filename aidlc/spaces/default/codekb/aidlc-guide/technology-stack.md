# Technology Stack — AIDLC Guide

> Reverse-engineering 合成（intent `260923-docs-ask-chat`）  
> Repo: `aidlc-guide` · Full rescan 2026-09-24 · Commit: `1702755bcfa54e25ffa99afcce25d834efad23d9`

## ランタイムと言語

| 技術 | バージョン（スキャン） | 用途 |
|------|------------------------|------|
| bun | `1.3.6`（`packageManager`） | ランタイム / パッケージマネージャ / ワークスペース |
| TypeScript | `^7.0.2` | 言語（全パッケージ） |
| Node（拡張ホスト） | VS Code 同梱 | vscode-extension の IDE ランタイム例外（DECIDED） |

出荷ランタイム方針は bun のみ（Vitest 等の devDependency は C-T1 対象外）。データベースは使わない。

## フレームワークとライブラリ

| 技術 | バージョン（スキャン） | 用途 |
|------|------------------------|------|
| React / react-dom | `^19.3.0` | dashboard UI |
| Vite | `^8.2.2` | dashboard ビルド（`build:dashboard` / `build:dashboard:webview`） |
| Vitest / `@vitest/coverage-v8` | `^5.0.1` | テスト・カバレッジ |
| Tailwind CSS | `^4.3.3`（dashboard） | スタイル |
| lucide-react | （dashboard 依存） | 質問 UI アイコン |
| oxlint | `^1.83.0` | lint（`.oxlintrc.json`） |
| oxfmt | `0.68.0` | format（`.oxfmtrc.json`; Prettier 非使用） |

### ワークスペース内ライブラリ（docs-qa 関連）

| パッケージ | 役割 |
|------------|------|
| `@aidlc-guide/shared-types` | docs-qa ワイヤ型 |
| `@aidlc-guide/official-docs` | 質問コンテキスト検索 |
| `@aidlc-guide/api-core` | ジョブ・ハンドラ・ai-cli |
| `@aidlc-guide/dashboard` | DocsQuestionPanel / useDocsQa |

### ビルドシステム

- **種別**: bun workspaces + Vite（dashboard）+ Vitest; 拡張は `packages/vscode-extension` の build/package
- **設定**: `package.json`, `bun.lock`, `tsconfig.json`, `vitest.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json`
- **品質ゲート**: 単一の `bun run check`（CI はこれを鏡像）
