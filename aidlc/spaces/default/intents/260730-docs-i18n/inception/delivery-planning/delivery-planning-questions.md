# Delivery Planning — 計画質問

> ステージ: delivery-planning (Inception 2.8) / Intent: `260730-docs-i18n`  
> 入力: units DAG · stories · requirements · mockups · components · team-practices  
> 推奨値で自動記入（ユーザー指示パターン 2026-07-31）  
> practices: Way of Working = trunk/`main` · Walking Skeleton = on（Bolt 1 ソロ・ゲート）· Deployment = local-only

---

## Q1. シーケンス heuristic

- A. Hybrid: **walking-skeleton-first**（Bolt 1）+ 価値順 M5→M1/M2→深リンク/Bridge。Should（diff）は後尾で切下げ可
- B. 純粋 value-first（skeleton なし）
- C. 純粋 risk-first（NFR だけ先）
- X. その他

[Answer]: A

## Q2. Bolt 粒度

- A. Bolt 1 は縦スライスで複数 Unit を束ね、以降は Unit／関心ごとに分割（計 5 Bolt）
- B. 1 Unit = 1 Bolt（6 Bolt）
- C. 全 Must を 2 巨大 Bolt に
- X. その他

[Answer]: A

## Q3. 並行

- A. Construction Bolt は原則直列（solo）。diff-report（Should）のみ先行 Must 完了後に独立実行可
- B. 複数 Bolt を常時並行
- X. その他

[Answer]: A

## Q4. Construction 設計イテレーション

- A. **unit-major** — Unit ごとに 3.1–3.4 を揃えてから次 Unit（Bolt 縦スライスと整合）
- B. stage-major（既定）
- X. その他

[Answer]: A

## Q5. 外部依存

- A. upstream aidlc-workflows の `docs/guide`+`docs/reference` 取得可能性（Bolt 1 content-snapshot をブロックしうる）。緩和: fixture／部分ツリーで skeleton を先に通し、本番スナップショットを同 Bolt 内で置換
- B. 外部依存なし
- X. その他

[Answer]: A
