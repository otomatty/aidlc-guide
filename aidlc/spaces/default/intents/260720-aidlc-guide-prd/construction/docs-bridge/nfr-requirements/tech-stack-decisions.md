# Tech Stack Decisions — Unit: docs-bridge

> nfr-requirements (3.2) / Unit: docs-bridge / 2026-07-24
> 入力: functional-design 3文書 + team-practices.md + decisions.md ADR-01

## スタック

| 領域 | 選定 | 理由 |
|------|------|------|
| パッケージ | `packages/docs-bridge`（data/bridge-map.json 同梱） | ADR-01 |
| ランタイム依存 | **ゼロ**（JSON は import で静的ロード、docs 読取は node:fs read 系のみ） | NFR-5 |
| 節抽出 | 手書きの見出しスライス（anchor 見出し行〜次の同レベル見出しまで）。Markdown パーサ不採用 | BR-DB-2 の verbatim 抜粋に AST 不要（reader-core と同じ判断） |
| dev-time | Vitest + Biome + data-lint テスト（map 実在検証） | team.md |

## 決定メモ

- bridge-map.json は TS から `import map from "./data/bridge-map.json"` で型付きロード（bun ネイティブ対応）。実行時 fetch しない。
- docs 節抽出の anchor 照合は GitHub 形式 slug（小文字・空白→`-`）で正規化。
