# 監視

遠隔の収集は置かない。見る場所は、画面の短い失敗表示と、手元の `bun run check` である。

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
| --- | --- | --- | --- |
| docs-qa の分岐カバレッジ | `vitest.config.ts` の `coverage.thresholds` | branches 70% | この変更で足す下限 |
| 既存パスの分岐カバレッジ | 同じ設定の既存ブロック | branches 95% | 下げない |
| ワークスペースの行カバレッジ | 同じ設定に足す `lines` | 80% | ワークスペース全体の下限 |
| UI テストと契約テスト | `bun run check` | 欠けると失敗 | チャット画面と ask / job / cancel / evidence |

## Alerts

| Alert | Condition | Severity | Routes to |
| --- | --- | --- | --- |
| なし | — | — | 当番も遠隔通知も置かない。失敗は `bun run check` の終了コードと、入力のそばの短いメッセージ |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
| --- | --- | --- |
| 待ち時間 | 目標なし | 既存のローカル CLI のまま。この変更の合格条件にしない |
| `bun run check` | 成功 | 変更のたびに手元で一回 |

## Logs & Tracing

ログの集約も分散トレースも置かない。失敗した質問は、チャットの入力のそばの短いメッセージで分かる。
