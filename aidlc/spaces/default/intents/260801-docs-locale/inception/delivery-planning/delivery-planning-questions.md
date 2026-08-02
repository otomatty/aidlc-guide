# Delivery Planning — 質問ファイル

> ステージ: delivery-planning (Inception 2.8) / Intent: `260801-docs-locale`（製品名「docs-i18n Bolt 2」）  
> DAG: `official-docs` → `docs-shell`（[unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md)）  
> practices: Walking Skeleton = team.md（Bolt 1 ソロ・ゲート）· team-formation = SKIP · Deployment = local-only  
> 各質問の `[Answer]:` に記入してください。  
> **Mode:** guided（推奨セット一括採用）

---

## Q1. シーケンス heuristic

- A. **Hybrid**: walking-skeleton-first + risk-first — Construction **Bolt 1** = `official-docs`（resolve/missing_ja/anchor/coverage を証明）。**Bolt 2** = `docs-shell`（拡張 UI 受入）。DAG 順を維持
- B. 単一 Construction Bolt に両 Unit を束ねる（topo 内で library→ui）
- C. 純粋 value-first（UI を先に試し、library はモック）— DAG 逸脱要根拠
- X. その他（具体的に記入）

[Answer]: A

## Q2. Bolt 粒度

- A. **1 Unit = 1 Bolt**（計 2 Bolt）— Q1=A と整合
- B. 両 Unit を 1 Bolt にバンドル（計 1 Bolt）
- X. その他（具体的に記入）

[Answer]: A

## Q3. 並行

- A. Construction Bolt は**直列**（docs-shell は official-docs に依存）
- B. 両 Bolt を並行（DAG 上は不可に近い — モック前提なら要根拠）
- X. その他（具体的に記入）

[Answer]: A

## Q4. Construction 設計イテレーション

- A. **unit-major** — Unit ごとに 3.1–3.4 を揃えてから次 Unit
- B. stage-major（既定）
- X. その他（具体的に記入）

[Answer]: A

## Q5. 外部依存

- A. **実質なし** — コンテンツツリーは Bolt 1 済み。ブロックするのはローカル `bun run check` / 拡張手動シナリオのみ
- B. upstream 再スナップショットが必須（本 intent をブロック）
- X. その他（具体的に記入）

[Answer]: A

## Q6. Walking skeleton マーカー

- A. Construction **Bolt 1（official-docs）** を walking skeleton とする（ソロ・ゲート、team.md）。完了後ラダープロンプト
- B. walking skeleton なし（両 Bolt 通常ゲート）
- X. その他（具体的に記入）

[Answer]: A

---

## Consolidated Summary Confirmation

推奨セットを一括採用した結果の要約です。

1. **Q1 = A** — Bolt 1 = official-docs → Bolt 2 = docs-shell（DAG 維持）
2. **Q2 = A** — 1 Unit = 1 Bolt（計 2）
3. **Q3 = A** — 直列
4. **Q4 = A** — unit-major
5. **Q5 = A** — 外部依存なし（ローカル check / 手動シナリオのみ）
6. **Q6 = A** — Bolt 1 = walking skeleton（ソロ・ゲート）

| Construction Bolt | Unit | Walking skeleton |
|-------------------|------|------------------|
| 1 | official-docs | Yes |
| 2 | docs-shell | No |

Does this all look correct before I generate the delivery-planning artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
