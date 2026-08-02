# Constraint Register — Docs i18n Bolt 3

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-08-02  
> 根拠: [feasibility-assessment.md](./feasibility-assessment.md) + [feasibility-questions.md](./feasibility-questions.md)  
> 入力参照: [intent-statement.md](../intent-capture/intent-statement.md)

## Technical Constraints（技術制約）

| ID | 制約 | 出典 | 影響 |
|----|------|------|------|
| C-T1 | 出荷・実行はローカル専用。公式 docs を実行時にネットワーク fetch しない。深リンクも拡張ホスト内で完結 | Q7 = A | 外部ブラウザをマップ済み経路で開かない |
| C-T2 | 実装スタックは既存 AIDLC Guide（TS / bun / Vite / React / VS Code Extension API）に閉じる | Q3 = A | 新規ディープリンクライブラリを必須化しない |
| C-T3 | 7 slug 静的 map（`STAGE_DOC_MAP`）を正とし、本 Bolt で slug 集合を増やさない | 親 US-05 / official-docs | マップ変更は別変更として扱う |
| C-T4 | 第一統合面は `dashboard` StageCard + `vscode-extension` host + Docs Shell | Q1 = E | 他サーフェスは初期 Must にしない |
| C-T5 | openOfficialDoc payload は `{locale, path, anchor?}` | intent / 親 FR-U3.1 | メッセージ type 文字列は FD で固定 |
| C-T6 | locale コードは `en` / `ja` のみ。locale は last-used preference \|\| `en` | team.md / US-05 | 多言語拡張はスコープ外 |
| C-T7 | 未マップ slug は Docs Shell 先頭（top）へ着地 | intent Q3 = E | path なし open と整合させる |
| C-T8 | リンクラベルは bare `Docs` alone 禁止 | intent Q3 = B | StageCard 表示文言の制約 |

## Organizational Constraints（組織制約）

| ID | 制約 | 出典 | 影響 |
|----|------|------|------|
| C-O1 | 明確な締切なし。品質と運用可能性を優先 | Q4 = A | 薄い縦スライス強制ではない |
| C-O2 | Bolt 3 は StageCard → openOfficialDoc のみ。B4 Bridge・B5 差分・Bolt 2 再実装は別 Issue | intent Q5 = E | スコープクリープ防止 |
| C-O3 | 拡張リリースは本リポジトリ内で完結 | 親 intent | 外部 CMS を正本にしない |

## Regulatory / Compliance Constraints（規制）

| ID | 制約 | 出典 | 影響 |
|----|------|------|------|
| C-R1 | PCI / HIPAA / SOC2 / データレジデンシ要件なし | Q2 = A | 規制スキャンは「非該当」で足りる |
| C-R2 | 社内の特別な同梱承認プロセスは不要（現時点） | Q2 = A | 通常ワークフロー承認のみ |

## Explicit Non-Constraints（いま縛らないもの）

- BridgeRedirectPanel / excerpt 非マウント（B4 / #30）
- upstream 差分レポート本番化（B5 / #31）
- locale keep-path / missing_ja の再実装（Bolt 2 完了）
- AWS / クラウド利用（全面的に非採用）
- 7 slug 以外への map 拡張
