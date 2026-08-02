# Feasibility Assessment — Docs i18n Bolt 3

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 根拠: [intent-statement.md](../intent-capture/intent-statement.md) + [feasibility-questions.md](./feasibility-questions.md)  
> 視点: Architect（主） / AWS Platform（インフラ不要確認） / Compliance（規制なし確認）  
> 上流: intent-statement（market-research はスキップ — 内部ツール）

## Verdict（結論）

**実行可能（Go）** — 技術・組織・規制のブロッカーは見当たらない。Bolt 1/2 で同梱 docs・API・Docs Shell・locale/untranslated・`stage-map` は確立済みであり、本 intent は StageCard → openOfficialDoc の brownfield 配線に限定される。

## Technical Viability（技術的実現性）

| 観点 | 評価 | 根拠 |
|------|------|------|
| サーフェス | 高 | dashboard StageCard + vscode-extension host + Docs Shell 着地口（Q1 = E） |
| スタック | 高 | 既存 TS / bun / Vite / React / Extension API（Q3 = A）。新ライブラリ不要 |
| slug map | 高 | `STAGE_DOC_MAP`（7 slug）と resolve API は Bolt 1 で存在。配線が差分 |
| deep-link 着地 | 中 | Docs Shell は path/anchor 消費済み。`locale` 付き payload 適用が本 Bolt の設計点（Q5 = B） |
| レガシー切替 | 中 | `docsOpenHref` / IDE open からの切替漏れリスク（Q5 = A） |
| unmapped → top | 中 | 既存 one-shot deep-link 消費ロジックとの整合（Q5 = C） |
| ホスト契約 | 中 | postMessage / コマンド名の Formal 固定が必要（Q5 = D） |

**アーキテクト所見:** US-05 は新規コンテンツ基盤ではなく、既存 Shell と静的 map への **メッセージ／状態配線**。難所は UI 見た目より **ホスト契約名と locale 付き deep-link の一回適用**。

## AWS / Cloud Landscape（プラットフォーム）

| 項目 | 判定 |
|------|------|
| 利用 AWS サービス | **なし**（Q6 = A） |
| アカウント / リージョン | **非該当** |
| インフラコスト | **ゼロ** |
| 実行時ネットワーク依存 | **なし**（外部ブラウザも開かない） |

project.md DECIDED（クラウド不使用）を継承。以降の AWS 定型は不要。

## Compliance Scan（コンプライアンス）

| 項目 | 判定 |
|------|------|
| PCI / HIPAA / SOC2 / データレジデンシ | **非該当**（Q2 = A） |
| 特別な社内情報管理承認 | **不要** |

## Organizational & Timeline Fit

- **締切:** なし（Q4 = A）
- **組織ブロッカー:** なし
- **運用:** Issue [#29](https://github.com/otomatty/aidlc-guide/issues/29) で追跡。B4/B5 は別 Issue

## Recommendation（次アクション）

1. **Go** — Scope Definition へ進み、Bolt 3 境界（deep links のみ、B4/B5・Bolt 2 再実装除外）を固定する
2. US-05 の payload／ラベル／unmapped 契約は Functional Design で Formal 再固定（intent Q6 = C）
3. openOfficialDoc メッセージ type 文字列を FD でピン留めし、dashboard と extension を同時に揃える
