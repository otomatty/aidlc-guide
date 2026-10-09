# solo・Unit・Boltの関係

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.10.0・2.11.0・solo。2.8.1との実行順序の比較は関連記事に掲載。内容確認: 2026年10月9日。

**soloは、1つのセッションが全Unitを担当する選択**です。実行順序や承認の自動化まで同時に決めるものではありません。

## 作業単位と実行設定

Unitは作業の単位、Boltはdelivery-planningで計画する提供単位です。Boltは1つ以上のUnitをまとめ、完了条件や担当などを持ちます。実際の実行順序は `unit-of-work-dependency.md` の依存関係と状態の設定から決まり、`bolt-plan.md` の区切りだけで5つの並列作業が始まるわけではありません。

1 Unit＝1 Boltなら、そのUnitに適用される機能設計、非機能要件、非機能設計、インフラ設計、コード生成・単体テストが、そのBoltの作業になります。スコープやUnitの種類により不要な工程は省かれます。全Unitの後に、共通のBuild and Test、実施対象ならCI Pipelineへ進みます。

| 確認する設定                                         | 決めること                                      |
| ---------------------------------------------------- | ----------------------------------------------- |
| `Unit Ownership`                                     | soloかteamか                                    |
| `Construction Iteration`                             | stage-majorかunit-majorか                       |
| `Construction Autonomy Mode`                         | 通常の完了承認を人に確認するか                  |
| `Construction Execution`・`Construction Checkpoints` | 2.10.0以降の直列・swarm実行と検証チェックポイント |
| `Plan Approval`                                      | 2.11.0で、各Unitのコード生成前に計画承認を尋ねるか |

## 2.11.0での追記

`Construction Iteration`・`Construction Checkpoints`・`Construction Execution` は、Construction中にチャットで頼むとその場で変わります。完了済みのUnitはそのまま残ります。手順は[進行中にunit-majorからstage-majorへ変更する](./aidlc-tip-switch-iteration.md)にあります。

`Plan Approval` は `express`・`poc` で既定がoff、ほかのスコープでonです。offにできるのは人だけで、`/aidlc --plan-approval off` などで作業ごとに切り替えます。

2.11.0で加わった `Collaborators` は、各ステージで支援エージェントを使うかの設定です。soloやteam（Unitの担当方式）とは別の設定で、`enterprise` 以外の既定はoffです。offでは各ステージを主担当のエージェントだけで進めます。支援エージェントを加えるときは `/aidlc --collaborators on` を使います。

## 根拠

[2.10.0のConstruction実行](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/reference/04-stages/construction.md#construction-walk)、[2.11.0のConstruction実行](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/reference/04-stages/construction.md#construction-walk)、[2.11.0の作業ごとの設定（計画承認・Collaborators）](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/guide/13-customization.md#ceremony-switches)。

## 関連記事

- [5 Boltのstage-majorとunit-major](./aidlc-tip-construction-order.md)
- [進行中にunit-majorからstage-majorへ変更する](./aidlc-tip-switch-iteration.md)
