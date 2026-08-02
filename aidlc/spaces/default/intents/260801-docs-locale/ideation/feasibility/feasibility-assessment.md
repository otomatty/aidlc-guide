# Feasibility Assessment — Docs i18n Bolt 2

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-08-01  
> Intent: `260801-docs-locale`  
> 根拠: [intent-statement.md](../intent-capture/intent-statement.md) + [feasibility-questions.md](./feasibility-questions.md)  
> 視点: Architect（主） / AWS Platform（インフラ不要確認） / Compliance（規制なし確認）

## Verdict（結論）

**実行可能（Go）** — 技術・組織・規制のブロッカーは見当たらない。Bolt 1（PR #26）でコンテンツ同梱・API・Docs Shell の縦スライスは確立済みであり、本 intent はその上での locale/untranslated 実装 polish に限定される。親 intent の feasibility で最大リスクだった「upstream スナップショット取り込み」は Bolt 1 で解消済み。

## Technical Viability（技術的実現性）

| 観点 | 評価 | 根拠 |
|------|------|------|
| サーフェス | 高 | `vscode-extension` + `dashboard` Docs Shell（Q1 = E）。Bolt 1 の統合面をそのまま延長 |
| スタック | 高 | 既存 TypeScript / bun / Vite / React / VS Code Extension API（Q3 = A）。新規 i18n ライブラリ不要 |
| オフライン同梱 | 高 | 実行時 fetch なし・リリース単位更新（Q7 = A）。ローカル専用の既存前提と一致 |
| locale 維持 | 中 | 部分 `ja` での locale 保持・path 維持は状態管理とルーティングの設計次第（Q5 = A） |
| 未訳 notice | 中 | `role=status` の a11y 実装は既存 UI との競合に注意（Q5 = B） |
| アンカー | 中 | Markdown レンダリング後のアンカー解決とフォールバック（Q5 = C） |
| coverage 床 | 中 | branch 95% 導入で既存テストが赤くなる可能性（Q5 = D） |

**アーキテクト所見:** S-docs-1（en/ja 同目次・同スタイル切替）の「部分 `ja` でも成立」は、静的コンテンツ + locale 切替 + 既存拡張 Webview の延長で実現可能。実装の難所は UI より **locale 解決ロジックの状態管理**（missing_ja 時の locale 維持・path 保持・anchor フォールバック）側。

## AWS / Cloud Landscape（プラットフォーム）

| 項目 | 判定 |
|------|------|
| 利用 AWS サービス | **なし**（Q6 = A） |
| アカウント / リージョン | **非該当** |
| インフラコスト | **ゼロ**（ローカル同梱のみ） |
| 実行時ネットワーク依存 | **なし**（公式 docs を fetch しない） |

project.md DECIDED（クラウド不使用）を本 intent でも継承。以降のステージで AWS 定型設計は不要。

## Compliance Scan（コンプライアンス）

| 項目 | 判定 |
|------|------|
| PCI / HIPAA / SOC2 / データレジデンシ | **非該当**（Q2 = A） |
| 特別な社内情報管理承認 | **不要**（Q2 = A） |
| 留意 | 公式公開ドキュメントの再配布であっても、上流ライセンス／帰属表記の扱いは後段で確認推奨（現時点では必須要件ではない） |

## Organizational & Timeline Fit

- **締切:** なし。品質と運用可能性優先（Q4 = A）
- **組織ブロッカー:** なし。拡張リリースと翻訳 PR を本リポジトリ内で回せる（Q4 = A）
- **運用:** intent どおり差分レポート自動化 + 翻訳・承認は手動別 PR（親 intent 継承）

## Recommendation（次アクション）

1. **Go** — Scope Definition へ進み、Bolt 2 の境界（locale/untranslated のみ、B3-B5 除外）を固定する
2. 未訳/anchor の契約は Functional Design で Formal に再固定する（intent-capture Q6 = C）
3. coverage 床の導入は Build and Test ステージで既存テストへの影響を確認しながら進める
