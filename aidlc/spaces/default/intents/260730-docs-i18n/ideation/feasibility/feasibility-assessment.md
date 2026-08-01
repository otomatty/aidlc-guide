# Feasibility Assessment — Docs i18n

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-07-31  
> Intent: `260730-docs-i18n`  
> 根拠: [intent-statement.md](../intent-capture/intent-statement.md) + [feasibility-questions.md](./feasibility-questions.md)  
> 視点: Architect（主） / AWS Platform（インフラ不要確認） / Compliance（規制なし確認）

## Verdict（結論）

**実行可能（Conditional Go）** — 技術・組織・規制のブロッカーは見当たらない。ただし **原文スナップショットの取り込み経路がリポジトリ上まだ未確立**（ワークスペースに `docs/guide/` / `docs/reference/` が現状存在しない）。Q8=A（モノレポ内 upstream 追跡）を成立させる作業が、実装より先の依存関係になる。

## Technical Viability（技術的実現性）

| 観点 | 評価 | 根拠 |
|------|------|------|
| サーフェス | 高 | 統合面は `vscode-extension` と `dashboard` 深リンク（Q1 = A,C）。既存 Webview / React スタックで言語切替 UI を載せる想定 |
| スタック | 高 | 既存 AIDLC Guide と同じ TypeScript / bun / Vite / React / VS Code Extension API で足りる（Q3 = A）。新規 SSG／機械翻訳パイプラインは初期不要 |
| オフライン同梱 | 高 | 実行時 fetch なし・リリース単位更新（Q6 = A）。ローカル専用の既存前提と一致 |
| 同梱サイズ | 中 | guide+reference 程度は許容、監視は後段 NFR（Q7 = A）。上限 MB は未設定のため RAID に Residual Risk として残す |
| 原文入手 | 要確認 | Q8 = A（モノレポ内追跡）だが、現状ツリーに対象 docs が無い。取り込み／同期の仕組みが未実装 |

**アーキテクト所見:** S-docs-1（en/ja 同目次・同スタイル切替）は、静的コンテンツ + locale 切替 + 既存拡張 Webview の延長で実現可能。実装の難所は UI より **コンテンツパイプライン**（snapshot → en 同梱 → ja PR → 差分レポート）側。

## AWS / Cloud Landscape（プラットフォーム）

| 項目 | 判定 |
|------|------|
| 利用 AWS サービス | **なし** |
| アカウント / リージョン | **非該当** |
| インフラコスト | **ゼロ**（ローカル同梱のみ — Q6 = A） |
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
- **組織ブロッカー:** なし。拡張リリースと翻訳 PR を本リポジトリ内で回せる（Q5 = A）
- **運用:** intent どおり差分レポート自動化 + 翻訳・承認は手動別 PR（intent-capture Q6 = B）

## Integration Scope Note（Q1 と intent の関係）

- 本ステージの回答では初期統合面を **A（拡張）+ C（dashboard 深リンク）** に限定
- intent の Docs Bridge「置き換え」（本文正本は同梱サイト、bridge-map は補助）は **破棄していない** — Q1 で B を選ばなかったのは「第一統合面ではない」という意味と解釈し、bridge-map 補助は scope-definition 以降で任意／段階移行として扱える
- スナップショット取得経路（質問 D）は Q1 では未選択だが、Q8 = A によりモノレポ内追跡として別途必須依存

## Recommendation（次アクション）

1. **Go** — Scope Definition へ進み、同梱ツリー・運用・非ゴールを境界として固定する  
2. Scope 以前または並行で、**upstream docs をモノレポに載せる方式**（コピー場所・バージョン明示・更新コマンド）を1つ決める — これが無いと Construction でコンテンツが空になる  
3. VSIX サイズ上限は数値化せず、NFR ステージで計測ベースラインを取る（Q7 = A）
