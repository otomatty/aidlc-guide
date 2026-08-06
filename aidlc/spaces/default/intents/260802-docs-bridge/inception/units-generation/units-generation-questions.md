# Units Generation — 質問ファイル

> ステージ: units-generation (Inception) / 深度: Standard  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4** / Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)）  
> 注: 実装順・Bolt 経済的順序は Delivery Planning（2.8）の管轄。ここでは依存トポロジのみ。  
> **Mode:** Guide Me（推奨適用）

---

## Q1. Unit 境界戦略

- A. 機能境界 — `docs-navigation`（Bridge degrade + Open in Docs CTA）を 1 Unit にまとめる
- B. パッケージ境界 — `dashboard` と `vscode-extension` を別 Unit
- C. ストーリーごと — US-B4-01 / 02 / 03 を別 Unit
- X. その他（具体的に記入）

[Answer]: A

## Q2. 粒度

- A. 粗粒度 — Must ストーリーを 1 Unit に収める（薄い差分に適切）
- B. 細粒度 — UI と host 回帰を必ず分離
- X. その他（具体的に記入）

[Answer]: A

## Q3. 依存トポロジ（実装順ではない）

- A. 単一 Unit（外部依存は完了済み Bolt 3 契約のみ。並列 Unit なし）
- B. dashboard Unit → extension Unit の有向依存を明示
- X. その他（具体的に記入）

[Answer]: A

## Q4. Unit kind

- A. `code`（既存パッケージ差分）
- B. `docs` / `infra` を混在
- X. その他（具体的に記入）

[Answer]: A

## Q5. デプロイモデル

- A. モノリシック（同一 repo / 同一 VSIX 出荷）
- B. 独立デプロイ可能な複数成果物
- X. その他（具体的に記入）

[Answer]: A

---

## Consolidated Summary

| Q | Answer | Decision |
|---|--------|----------|
| Q1 | A | 単一 Unit `docs-navigation` |
| Q2 | A | 粗粒度 |
| Q3 | A | 単一ノード DAG（Bolt 3 契約は外部前提） |
| Q4 | A | kind = code |
| Q5 | A | モノリシック VSIX |

Looks correct / Request changes?

- Looks correct
- Request changes

[Answer]: Looks correct
