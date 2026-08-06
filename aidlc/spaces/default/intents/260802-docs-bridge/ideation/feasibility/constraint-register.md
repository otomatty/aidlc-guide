# Constraint Register — Docs i18n Bolt 4

> ステージ: feasibility / Intent: `260802-docs-bridge` / 2026-08-03  
> 根拠: [feasibility-questions.md](./feasibility-questions.md) · [intent-statement.md](../intent-capture/intent-statement.md)

## Technical Constraints

| ID | Constraint | Source | Notes |
|----|------------|--------|-------|
| C-T1 | ローカル専用。実行時に公式 docs を fetch しない | Q6 = A / Q7 = A | 親 intent 継承 |
| C-T2 | スタックは既存 AIDLC Guide（TS / bun / Vite / React / Extension API）に閉じる | Q3 = A | 新ライブラリ禁止 |
| C-T3 | Bridge degrade は拡張ホスト／Dashboard 内で完結 | Q7 = A / intent Q7 | 外部ブラウザ必須にしない |
| C-T4 | Docs 着地は Bolt 3 の `openOfficialDoc` / Docs Shell / `/api/official-docs` を再利用 | Q1 = E / Q5 = C | 並行の別着地口を増やさない |
| C-T5 | aidlc-workflows エンジン／ステージ定義は変更しない | Q7 = A / project Forbidden | — |
| C-T6 | excerpt を記事正本としてマウントしない（US-06） | intent DoD / Q5 = A | Bridge は導線に縮退 |
| C-T7 | Open in Docs が primary CTA | intent DoD / Q5 = B | 二次導線のみは Fail |

## Organizational Constraints

| ID | Constraint | Source |
|----|------------|--------|
| C-O1 | ハードデッドラインなし。品質優先 | Q4 = A |
| C-O2 | US-09 glossary は Should — Must DoD に含めない | intent Q8 = A / Q5 = E |

## Regulatory Constraints

| ID | Constraint | Source |
|----|------------|--------|
| C-R1 | PCI / HIPAA / SOC2 / データレジデンシ — 非該当 | Q2 = A |

## Explicit Non-Constraints（本 Bolt で縛らない）

- B5 upstream 差分レポート（#31）
- Bolt 2 locale/untranslated 再実装
- Bolt 3 deep link 再実装
- 大規模公式ツリー追加
