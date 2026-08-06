# RAID Log — Docs i18n Bolt 4

> ステージ: feasibility / Intent: `260802-docs-bridge` / 2026-08-03  
> 根拠: [feasibility-questions.md](./feasibility-questions.md) · [intent-statement.md](../intent-capture/intent-statement.md) · [feasibility-assessment.md](./feasibility-assessment.md)

## Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Bridge が excerpt を記事として載せ続け、二重正本が残る | Med | High | US-06 受入: excerpt 非マウントをテスト／デモで確認（Q5 = A） |
| R2 | Open in Docs が primary CTA にならない | Med | High | UI 契約で一次 CTA を固定；視覚・キーボード双方で主操作であること（Q5 = B） |
| R3 | `openOfficialDoc` / Shell 着地契約の再利用漏れ | Med | High | Bolt 3 契約を Functional Design で明示引用；回帰テスト（Q5 = C） |
| R4 | US-09 を Must 化してスコープ膨張 | Low | Med | Should 切下げを Scope で再確認（Q5 = E） |

## Assumptions

| ID | Assumption | Owner to validate |
|----|------------|-------------------|
| A1 | Bolt 3 の着地口は Bridge CTA から再利用可能 | Functional Design / Construction |
| A2 | BridgeRedirectPanel 文言・メッセージ type は FD で固定してよい | Design / Product |
| A3 | US-09 切下げでも US-06 DoD だけで Bolt 4 完了とみなせる | Scope / Stakeholder |

## Issues

| ID | Issue | Status |
|----|-------|--------|
| I1 | Legacy Bridge がまだ正本扱いになり得る（現状の問題認識） | Open — 本 Bolt で解消 |

## Dependencies

| ID | Dependency | Type |
|----|------------|------|
| D1 | Bolt 1–3 完了（同梱 Docs / locale / openOfficialDoc） | Hard |
| D2 | Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30) 追跡 | Tracking |
| D3 | Unit `docs-navigation`（BridgeRedirectPanel） | Delivery |
