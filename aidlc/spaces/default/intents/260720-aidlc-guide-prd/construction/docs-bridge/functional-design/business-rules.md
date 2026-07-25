# Business Rules — Unit: docs-bridge

> functional-design (3.1) / Unit: docs-bridge / 2026-07-24
> 入力: requirements.md（FR-5, §8 スコープ外）+ components.md C3 + unit-of-work.md U2

## ルール

| ID | ルール | 出所 |
|----|--------|------|
| BR-DB-1 | **対応表は本 Unit の静的データファイルが単一ソース**（単一ファイル bridge-map.json — stages + terms 同居）。他パッケージへの複製・直接読取を禁止し、関数 API 経由のみ | FR-5.1 / US-23 |
| BR-DB-2 | **AI 要約をしない**: 返す本文は docs ファイルの該当節の**そのままの抜粋**（加工は見出しアンカーでの切り出しのみ） | PRD §8 スコープ外 / requirements Q3 |
| BR-DB-3 | **docs 不在は縮退であってエラーでない**: 静的エントリ（purpose/agent 等）は docs なしでも常に返す。本文添付だけが落ちる | NFR-6 |
| BR-DB-4 | **対応表のメンテは本ツール側**（PRD §12 未決の確定）: 32ステージ+主要用語のエントリを data/ に持ち、aidlc-workflows のバージョン更新時に手動同期。対応表に `sourceVersion` フィールドを持たせ、解決時に返す（消費者が古さを表示可能） | PRD §12 / C-T3 精神 |
| BR-DB-5 | 読み取り専用（write API なし）・reader-core 非依存（相互独立） | NFR-1 / DAG |
| BR-DB-6 | パスはクロスプラットフォーム（node:path、sep 決め打ち禁止）。docsRepoPath は絶対/相対どちらも受け、workspaceRoot 起点で解決 | NFR-4 |

## データ形式（bridge-map.json — 単一ファイル）

```json
{
  "sourceVersion": "aidlc-workflows v2 (State Version 7)",
  "stages": { "<slug>": { "purpose": "…", "inputs": ["…"], "outputs": ["…"],
    "agent": "…", "gateRequirement": "…", "docPath": "docs/guide/….md", "docAnchor": "#…" } },
  "terms": { "<term>": { "definition": "…", "docPath": "…", "docAnchor": "#…" } }
}
```
（stages と terms は本ファイル1つに同居で**確定**。分割はデータが肥大化してからの将来判断）
