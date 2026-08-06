# NFR Requirements — Unit: docs-navigation

> ステージ: nfr-requirements (Construction) / unit: **docs-navigation** (ui)  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4**）  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · codekb technology-stack  
> produces (ui): performance / security / tech-stack（scalability・reliability → N/A stub）  
> **Answered:** Yes — recommended defaults (2026-08-04)

---

## Q1. Performance

- A. Bridge degrade はローカルのみ。数値レイテンシ床は設けない。回帰は `bun run check` + Demo（Recommended — NFR-B4-1/2）
- B. CTA → Shell open ≤ 200ms を Must 計測にする
- X. その他

[Answer]: A

## Q2. Security / trust

- A. Webview 非信頼。`open-official-doc` は Bolt 3 host validate を再利用。remote official-docs fetch 禁止。excerpt は UI 非マウントのみ（API 削除は Must でない）（Recommended — NFR-B4-1 / ADR-B4-001/002）
- B. payload 検証なしでホストに渡してよい
- X. その他

[Answer]: A

## Q3. Tech stack

- A. 既存 TS / bun / React / VS Code Extension API のみ。新ランタイム・新パッケージなし（Recommended）
- B. 新ホストアダプタを追加
- X. その他

[Answer]: A

## Q4. Coverage / verify

- A. 新規 95% branch 床は設けない（NFR-B4-2）。non-mount + CTA→`open-official-doc` を `bun run check` に含める + Demo（Recommended）
- B. dashboard 全体に 95% 床を新設
- X. その他

[Answer]: A

## Q5. Scalability / Reliability

- A. ui unit のため scalability / reliability は N/A stub（ローカル単一ユーザー）（Recommended）
- B. 多ユーザー同時 Bridge 操作を Must にする
- X. その他

[Answer]: A

## Consolidated Summary Confirmation

- A. Looks correct — proceed（Recommended）
- B. Needs revision

[Answer]: A
