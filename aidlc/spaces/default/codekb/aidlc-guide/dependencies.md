# Dependencies — AIDLC Guide

> Reverse-engineering 合成（intent `260923-docs-ask-chat`）  
> Repo: `aidlc-guide` · Full rescan 2026-09-24 · Commit: `1702755bcfa54e25ffa99afcce25d834efad23d9`

## 外部依存

ルートおよびスキャンした `package.json` から観測した主要外部依存（バージョンは technology-stack / スキャン記載に従う）。

| 依存 | 用途 | 備考 |
|------|------|------|
| bun | ランタイム・ワークスペース | `packageManager: bun@1.3.6` |
| typescript | コンパイル | `^7.0.2` |
| react / react-dom | UI | dashboard `^19.3.0` |
| vite | SPA バンドル | `^8.2.2` |
| vitest / `@vitest/coverage-v8` | テスト | `^5.0.1` |
| oxlint / oxfmt | lint / format | `^1.83.0` / `0.68.0` |
| tailwindcss | スタイル | dashboard `^4.3.3` |
| lucide-react | アイコン | 質問 UI |
| 外部 AI CLI（ai-cli 経由） | docs-qa 回答生成 | プロセス起動; クラウド SaaS SDK ではない |

**明示的に無いもの（制約）**: AWS / クラウド SDK、本番 DB、ランタイムでの公式 docs ネットワーク取得、i18n メッセージカタログライブラリ。

ロックファイル `bun.lock` が供給鎖の真実。ローカルゲートで `bun audit` を含む方針（project.md）。

## 内部依存（パッケージ DAG）

スキャンの Build Dependencies をそのまま構造化したもの。

```text
@aidlc-guide/shared-types
        ↑
   ┌────┼────────────────────────────┐
   │    │                            │
core-utils   （他ライブラリも shared-types へ）
   ↑
reader-core    docs-bridge    official-docs
   └──────────────┬──────────────┘
                  ↓
              api-core
          ┌───────┼────────┐
          ↓       ↓        ↓
 dashboard-server  vscode-extension  mcp-server

dashboard ──→ shared-types のみ
              （reader-core を import しない）
```

### docs-qa 実行時の内部結合

| From | To | 結合 |
|------|-----|------|
| dashboard `docsQaApi` | api-core handlers | HTTP / 拡張ワイヤ |
| api-core `docs-qa` | `official-docs` `question-context` | ライブラリ |
| api-core `docs-qa` | `ai-cli` | プロセス／再エクスポート |
| api-core | `shared-types` docs-qa 型 | コンパイル時契約 |
| official-docs | retrieval / roots（skim） | 内部モジュール |

### 意図変更時の影響範囲

チャット画面化は **dashboard のルーティング／レイアウト** が主戦場。`shared-types/docs-qa.ts`・ask/job/cancel/evidence・`question-context` は `history` を既に持つため、契約破壊なしで UI を分離できる見込み（開発者ハンドオフ結論）。
