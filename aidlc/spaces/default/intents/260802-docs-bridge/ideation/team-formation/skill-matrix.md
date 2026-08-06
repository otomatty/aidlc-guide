# Skill Matrix — Docs i18n Bolt 4

> ステージ: team-formation / Intent: `260802-docs-bridge` / 2026-08-03  
> 上流: [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md) / [feasibility-assessment.md](../feasibility/feasibility-assessment.md)

## Required vs Available

| スキル領域 | 要求元 | 必要度 | 保有 | ギャップ |
|------------|--------|--------|------|----------|
| React / Dashboard UI（Bridge 縮退） | scope M1 / U1 | Must | あり（Bolt 1–3） | なし |
| VS Code Extension API（`openOfficialDoc` 再利用） | scope M2 / U2 / feasibility C-T4 | Must | あり（Bolt 3） | なし |
| Docs Shell / `/api/official-docs` 契約理解 | scope Boundaries / U2 | Must | あり | なし |
| Demo / 手動受入 | scope M3 / U3 | Must | あり | なし |
| Glossary / US-09 補助 UI | scope S1 / U4 | Should | あり（任意） | なし（切下げ可） |
| AWS / クラウド設計 | feasibility N/A | 不要 | — | — |
| コンプライアンス専門 | feasibility N/A | 不要 | — | — |

## Gap Analysis

- **結論:** スキルギャップなし（Q3=A）
- **根拠:** feasibility-assessment は既存 TS / bun / Vite / React / Extension API に閉じると判定。新ライブラリ・新着地口なし
- **学習予算:** 追加の正式トレーニング不要。Functional Design で CTA 文言・message type を固定する程度

## Remediation

| ギャップ | 計画 | 期限 |
|----------|------|------|
| （なし） | — | — |
