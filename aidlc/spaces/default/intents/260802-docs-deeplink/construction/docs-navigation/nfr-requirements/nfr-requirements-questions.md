# NFR Requirements — Unit: docs-navigation

> ステージ: nfr-requirements (Construction) / unit: **docs-navigation** (ui)  
> Intent: `260802-docs-deeplink`（docs-i18n **Bolt 3**）  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · codekb technology-stack  
> produces (ui): performance / security / tech-stack（scalability・reliability は service 向け → stub or N/A）  
> **Recommended** は各問に記す。

---

## Q1. Performance

- A. 深リンク着地はローカルのみ。数値レイテンシ床は設けない。回帰は `bun run check` + 手動デモ（Recommended — wiring Bolt）
- B. Shell open ≤ 200ms を Must 計測にする
- X. その他（具体的に記入）

[Answer]: A

## Q2. Security / trust

- A. Webview は非信頼。payload validate（locale ∈ en|ja；mapped path 非空）。remote official-docs fetch 禁止。legacy open-doc と path 空間を分離（Recommended — NFR-B3-1 / ADR-B3-001）
- B. path 検証なしでホストに渡してよい
- X. その他（具体的に記入）

[Answer]: A

## Q3. Tech stack

- A. 既存 TS / bun / React / VS Code Extension API のみ。新ランタイムなし（Recommended）
- B. 新ホストアダプタを追加
- X. その他（具体的に記入）

[Answer]: A

## Q4. Coverage / verify

- A. 新規 95% branch 床は設けない（NFR-B3-3）。C1–C7 + demo-record を Must（Recommended）
- B. dashboard 全体に 95% 床を新設
- X. その他（具体的に記入）

[Answer]: A

## Q5. Scalability / Reliability

- A. ui unit のため scalability / reliability は N/A stub（ローカル単一ユーザー）（Recommended）
- B. 多ユーザー同時深リンクを Must にする
- X. その他（具体的に記入）

[Answer]: A

## Consolidated Summary Confirmation

- A. Looks correct — proceed（Recommended）
- B. Needs revision — (specify)

[Answer]: A
