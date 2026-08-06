# Feasibility Assessment — Docs i18n Bolt 4（Bridge Degrade）

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-08-03  
> Intent: `260802-docs-bridge`  
> 根拠: [intent-statement.md](../intent-capture/intent-statement.md) + [feasibility-questions.md](./feasibility-questions.md)  
> 視点: Architect（主） / AWS Platform（インフラ不要確認） / Compliance（規制なし確認）  
> 追跡: Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)

## Verdict（結論）

**実行可能（Go）** — 技術・組織・規制のブロッカーは見当たらない。Bolt 1–3 で同梱 Docs・locale・StageCard → `openOfficialDoc` → Docs Shell は確立済み。本 intent は **Legacy Bridge の degrade（US-06）** に限定され、新規インフラや新ライブラリを要しない。

## Technical Viability（技術的実現性）

| 観点 | 評価 | 根拠 |
|------|------|------|
| サーフェス | 高 | dashboard Bridge 経路 + vscode-extension `openOfficialDoc` + Docs Shell 着地（Q1 = E） |
| スタック | 高 | 既存 TS / bun / Vite / React / Extension API（Q3 = A）。新ルーティングライブラリ不要 |
| Bridge degrade | 中 | excerpt を記事マウントしない／Open in Docs を primary CTA にする UI 契約変更（Q5 = A, B） |
| 着地再利用 | 高 | Bolt 3 の `openOfficialDoc` / Shell 契約を CTA が再利用（Q5 = C は再利用漏れが主リスク） |
| US-09 glossary | 低リスク | Should 切下げ可（Q5 = E / intent Q8 = A）— Must 膨らみを回避可能 |
| 境界 | 高 | ローカル専用・fetch なし・workflows 非変更を継承（Q7 = A） |

**アーキテクト所見:** 「正本は同梱 Docs のみ」は、Bridge を導線＋補助に縮退させ、一次操作を既存 Docs Shell 着地に寄せるだけで実現できる。難所は新機能追加ではなく **既存 Bridge UI から excerpt 正本体験を外す** ことと、CTA が Bolt 3 契約を必ず叩くことの回帰保証。

## AWS / Cloud Landscape（プラットフォーム）

| 項目 | 判定 |
|------|------|
| 利用 AWS サービス | **なし**（Q6 = A） |
| アカウント / リージョン | **非該当** |
| インフラコスト | **ゼロ** |
| 実行時ネットワーク依存 | **なし** |

project.md DECIDED（クラウド不使用）を継承。AWS 定型設計は不要。

## Compliance Scan（コンプライアンス）

| 項目 | 判定 |
|------|------|
| PCI / HIPAA / SOC2 / データレジデンシ | **非該当**（Q2 = A） |
| 特別な社内情報管理承認 | **不要** |
| 留意 | 公式 docs 再配布の帰属は親 intent と同様、本 Bolt のブロッカーではない |

## Organizational & Timeline Fit

- **締切:** なし。品質と運用可能性優先（Q4 = A）
- **組織ブロッカー:** なし（Q4 = A）
- **スコープ規律:** B3 再実装・B5 差分レポート・locale 再実装は Out of scope（intent）

## Recommendation（次アクション）

1. **Go** — Scope Definition へ進み、US-06 Must / US-09 Should / B5 除外を固定する  
2. BridgeRedirectPanel の文言・メッセージ type は Functional Design で固定（intent Assumption）  
3. Demo: Legacy Bridge → Open in Docs → Shell を受入の中核にする  
