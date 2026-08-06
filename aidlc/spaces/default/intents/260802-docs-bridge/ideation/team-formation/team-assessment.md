# Team Assessment — Docs i18n Bolt 4

> ステージ: team-formation (Ideation 1.5) / 作成日: 2026-08-03  
> Intent: `260802-docs-bridge`  
> 根拠: [team-formation-questions.md](./team-formation-questions.md)  
> 上流: [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md) / [feasibility-assessment.md](../feasibility/feasibility-assessment.md)

## Availability

| 役割 | 体制 | 稼働 | 出典 |
|------|------|------|------|
| 実行者（ドライバー） | ソロ開発者 | 本 Bolt に集中可能 | Q1=A / Q2=A |
| レビュア | 必要時に依頼（固定専任なし） | スポット | Q1=A / Q4=A |
| ゲート承認 | 実行者本人 | — | Q5=A |

競合イニシアチブによる人材の引き抜きは想定しない（Q2=A）。外部パートナー／AWS PS は不要（Q6=A / feasibility-assessment: クラウド・規制 N/A）。

## Capacity Allocation

| 作業塊（intent-backlog） | 担当 | 備考 |
|--------------------------|------|------|
| U1 Bridge excerpt 非マウント | ソロ実行者 | Must / 先頭 |
| U2 Open in Docs primary CTA | ソロ実行者 | Must / Bolt 3 着地再利用 |
| U3 Demo 検証 | ソロ実行者 | Must |
| U4 US-09 glossary（Should） | ソロ実行者 | 切下げ可 |
| U5 文言ブラッシュアップ（Could） | 任意 | — |

scope-document の Sequencing（縮退 → CTA → Demo）に沿い、一人で直列消化する。

## Decision Rights（簡易 RACI）

| 決定 | R | A | C | I |
|------|---|---|---|---|
| Ideation / Inception ゲート | 実行者 | 実行者 | — | — |
| Construction PR merge | 実行者 | 実行者 | スポットレビュア | — |
| US-09 切下げ | 実行者 | 実行者 | — | — |

## Verdict

**編成十分** — scope-document の Must（M1–M3）と feasibility-assessment の Go を、ソロ＋PR 体制で消化できる。大規模チーム編成は不要。
