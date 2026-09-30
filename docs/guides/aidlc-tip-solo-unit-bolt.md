# solo・Unit・Boltの関係

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.10.0・solo。2.8.1との実行順序の比較は関連記事に掲載。内容確認: 2026年9月29日。

**soloは、1つのセッションが全Unitを担当する選択**です。実行順序や承認の自動化まで同時に決めるものではありません。

## 作業単位と実行設定

Unitは作業の単位、Boltはdelivery-planningで計画する提供単位です。Boltは1つ以上のUnitをまとめ、完了条件や担当などを持ちます。実際の実行順序は `unit-of-work-dependency.md` の依存関係と状態の設定から決まり、`bolt-plan.md` の区切りだけで5つの並列作業が始まるわけではありません。

1 Unit＝1 Boltなら、そのUnitに適用される機能設計、非機能要件、非機能設計、インフラ設計、コード生成・単体テストが、そのBoltの作業になります。スコープやUnitの種類により不要な工程は省かれます。全Unitの後に、共通のBuild and Test、実施対象ならCI Pipelineへ進みます。

| 確認する設定                                         | 決めること                                      |
| ---------------------------------------------------- | ----------------------------------------------- |
| `Unit Ownership`                                     | soloかteamか                                    |
| `Construction Iteration`                             | stage-majorかunit-majorか                       |
| `Construction Autonomy Mode`                         | 通常の完了承認を人に確認するか                  |
| `Construction Execution`・`Construction Checkpoints` | 2.10.0での直列・swarm実行と検証チェックポイント |

## 根拠

[2.10.0のConstruction実行](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/reference/04-stages/construction.md#construction-walk)。

## 関連記事

- [5 Boltのstage-majorとunit-major](./aidlc-tip-construction-order.md)
- [進行中にunit-majorからstage-majorへ変更する](./aidlc-tip-switch-iteration.md)
