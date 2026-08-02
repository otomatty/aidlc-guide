# Constraint Register — Docs i18n Bolt 2

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-08-01  
> 根拠: [feasibility-assessment.md](./feasibility-assessment.md) + [feasibility-questions.md](./feasibility-questions.md)  
> 入力参照: [intent-statement.md](../intent-capture/intent-statement.md)

## Technical Constraints（技術制約）

| ID | 制約 | 出典 | 影響 |
|----|------|------|------|
| C-T1 | 出荷・実行はローカル専用。公式 docs を実行時にネットワーク fetch しない | Q7 = A / 親 intent 継承 | コンテンツは VSIX／リポジトリ同梱が必須 |
| C-T2 | 実装スタックは既存 AIDLC Guide（TS / bun / Vite / React / VS Code Extension API）に閉じる | Q3 = A | 新規 i18n ライブラリ・SSG を必須化しない |
| C-T3 | 初期同梱ツリーは `docs/guide/` + `docs/reference/`（親 intent）。harness-engineering 等は初期対象外 | 親 intent Q5 = B | コンテンツ量・ナビ範囲の上限 |
| C-T4 | 原文スナップショットはモノレポ内 upstream 追跡で入手する | 親 intent Q8 = A | 外部 CDN 依存の閲覧経路は採用しない |
| C-T5 | 第一統合面は `vscode-extension` と `dashboard` 深リンク | Q1 = E | 他サーフェスは初期 Must にしない |
| C-T6 | guide+reference 程度のサイズは許容。厳密な MB 上限は未設定（後段 NFR） | 親 intent Q7 = A | サイズは監視対象だが現時点のハードゲートではない |
| C-T7 | locale コードは `en` / `ja` のみ | team.md / 親 intent | 多言語拡張は本 intent のスコープ外 |
| C-T8 | 未訳時は locale を `ja` のまま維持し、notice（`role=status`）で明示する | intent Q3 = B | UI 状態管理と a11y の設計制約 |
| C-T9 | 欠落アンカーはページ先頭へフォールバックする | intent Q3 = C | Markdown レンダリング後のスクロール制御 |

## Organizational Constraints（組織制約）

| ID | 制約 | 出典 | 影響 |
|----|------|------|------|
| C-O1 | 明確な締切なし。品質と運用可能性を優先 | Q4 = A | 薄い縦スライス強制ではないが、価値検証は早めが望ましい |
| C-O2 | 翻訳・承認は手動の別 PR（自動化は差分レポートまで） | 親 intent Q6 = B | ja 更新レイテンシは人手依存 |
| C-O3 | 拡張リリースと翻訳 PR は本リポジトリ内で完結させる | 親 intent Q5 = A | 外部 CMS / 別ドキュメントサイトを正本にしない |
| C-O4 | Bolt 2 は locale/untranslated のみ。B3（深リンク）・B4（Bridge）・B5（差分レポート）は別 Issue で扱う | intent Q5 = E | スコープクリープ防止 |

## Regulatory / Compliance Constraints（規制）

| ID | 制約 | 出典 | 影響 |
|----|------|------|------|
| C-R1 | PCI / HIPAA / SOC2 / データレジデンシ要件なし | Q2 = A | compliance 設計ステージの規制スキャンは「非該当」で足りる |
| C-R2 | 社内の特別な同梱承認プロセスは不要（現時点） | Q2 = A | ゲートは通常のワークフロー承認のみ |

## Explicit Non-Constraints（いま縛らないもの）

- VSIX の具体的 MB 上限（C-T6 の通り後段計測）
- Docs Bridge 本文の即時削除（親 intent は置き換え方針だが、B4 で扱う）
- AWS / クラウド利用（全面的に非採用）
- StageCard → `openOfficialDoc` ディープリンク（B3 / #29）
- upstream 差分レポートの本番化（B5 / #31）
