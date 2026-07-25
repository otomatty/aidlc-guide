# Reliability Requirements — Unit: docs-bridge

> nfr-requirements (3.2) / Unit: docs-bridge / 2026-07-24
> 入力: functional-design/business-logic-model.md + business-rules.md（BR-DB-3）+ requirements.md（NFR-6）

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| R-DB-1 | throw ゼロ（全メソッド ReadResult）。**内蔵 bridge-map.json は静的 import のためビルド時に破損が検出される**（tech-stack-decisions.md と整合 — 実行時に壊れた同梱 map という状態は構造的に存在しない。ビルド時の data-lint + TS 型検査が防衛線）。実行時の {error}/{warnings} 経路は docs 読取（D2/D3 の excerpt 添付）と config（D1）のみ | ReadResult 網羅テスト（docs/config 経路）+ ビルド時 data-lint |
| R-DB-2 | docs 不在/節欠落は excerpt=null + warnings の縮退（静的エントリは常に返る — BR-DB-3） | docs 無し環境テスト |
| R-DB-3 | 決定性: 同一入力に同一出力（map はイミュータブル・ロード後不変） | 反復呼出テスト |
| R-DB-4 | data-lint（docPath/docAnchor の実在検証）を**ローカル品質ゲート（`bun run check` 相当 — team.md。CI 基盤は無し）**に接続（US-03 AC ⑤ の受け皿 — functional-design 参照）。docs clone 不在環境では skip + 警告表示 | ゲート実行 |

## 依存の可用性

docs リポジトリは external-dependency E2 — 不在でも本 Unit は degrade して動く（excerpt 無し）。
