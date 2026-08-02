# Decision Log — Docs i18n Bolt 2

> ステージ: approval-handoff (Ideation 1.7) / 作成日: 2026-08-01  
> Intent: `260801-docs-locale`

## Ideation Decisions

| 日時 | ステージ | 決定 | 根拠 |
|------|----------|------|------|
| 2026-08-01 | intent-capture | Bolt 2 = locale/untranslated のみ | Q5 = E（B3-B5 除外） |
| 2026-08-01 | intent-capture | 主受益者 = 初学者エンジニア | Q2 = A |
| 2026-08-01 | intent-capture | DoD = keep-path + notice + anchor + coverage | Q3 = A,B,C,D |
| 2026-08-01 | intent-capture | 親 intent brownfield 延長、未訳/anchor 契約再固定 | Q6 = C |
| 2026-08-01 | intent-capture | 技術境界継承（ローカル専用・fetch なし等） | Q7 = A |
| 2026-08-01 | feasibility | Go 判定 | ブロッカーなし、Bolt 1 で基盤確立済み |
| 2026-08-01 | feasibility | C-T7〜T9 追加（locale 維持・notice・anchor） | intent Q3 = B,C |
| 2026-08-01 | scope-definition | M1-M4 Must、coverage 床含む | Q2 = A |
| 2026-08-01 | scope-definition | シーケンス = 依存優先（official-docs → api-core → dashboard → coverage） | Q4 = A |
| 2026-08-01 | rough-mockups | 新規画面なし、W2a/W2b 状態追加 | Q2 = C |
| 2026-08-01 | rough-mockups | 未訳 notice は `main` 内 `role=status` | Q3 = D / Q6 = E |
| 2026-08-01 | rough-mockups | locale 維持は URL/状態管理で保持 | Q7 = C |
| 2026-08-01 | approval-handoff | Go — Inception へ | Q7 = A |

## Skipped Stages

| ステージ | 理由 |
|----------|------|
| market-research | 親 intent で実施済み、本 intent は実装 polish |
| team-formation | 単独作業想定、親 intent でチーム編成済み |
