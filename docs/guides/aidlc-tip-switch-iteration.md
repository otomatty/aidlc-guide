# 進行中にunit-majorからstage-majorへ変更する

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.8.1・2.10.0・2.11.0。soloとteamの制約を記載。内容確認: 2026年10月9日。

2.11.0では、Construction中にチャットで頼むと、その場で切り替わります。完了済みのUnitはそのまま残ります。2.8.1のsoloでは設定を変更して再開し、2.10.0のConstruction中は変更内容に対する人の承認も必要でした。

## 2.11.0の変更手順

Construction中に、チャットで自分の言葉で依頼します。

```text
ここからはステージごとに進めてください
```

「1 Unitずつ作って」「チェックポイントをオフにして」なども同じです。エージェントは確認の質問をせずにその場で設定を変え、変更内容と戻し方を1行で伝えます。例えば次の1行です。

```text
Construction now goes stage by stage (it built one Unit at a time). You can switch back any time.
```

監査ログには、依頼した人の言葉とともに `CONSTRUCTION_POLICY_SET` が記録されます。戻したいときも、チャットで頼むだけです。

**完了済みのUnitは残ります。** unit-majorやチェックポイント有効への切り替えでも、stage-majorやチェックポイント無効への切り替えでも、完了済みのUnitを作り直しません。`/aidlc` は、まだ作業が残っているUnitから続けます。切り替えの前にジャンプ・Redo・チェックポイントの差し戻しで再作業になったUnitは、その再作業を行い、終わればそのまま残ります。

**人の依頼がある場合だけ変わります。** エンジンは、前回の決定以降に人の発言が記録されている場合だけ変更します。AIが自分の判断で変えることはなく、無人実行でも変わりません。ほかの設定が先に必要な変更（Unitの並列実行には、stage-majorとチェックポイント有効の両方が必要）は、両方を変えて両方を伝えます。

現在の設定は、ネイティブCLIなら次で読めます。

```bash
aidlc engine state get "Construction Iteration"
```

## ジャンプとRedoでも完了済みのUnitは残る

2.11.0のunit-majorでは、ジャンプやRedoでも、指定した範囲だけをやり直します。

| 操作                                                              | やり直す範囲                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 作業中のUnitが終えた工程へ戻る（例: `/aidlc --stage nfr-design`） | そのUnitの、その工程と以降の工程だけ。ほかのUnitは完了済みの作業を保つ |
| Unitを指定して戻る（例: 「Unit 2だけCode Generationに戻して」）   | 指定したUnitだけ。ほかのUnitの承認はそのままで、質問もされない         |
| 「for every unit」と伝える、またはステージ全体へ戻る              | 全Unitの、その工程と以降の工程。それより前の工程は保つ                 |
| Redo（いずれかのUnitに完了済みの作業があるとき）                  | 作業中のUnitのその工程だけ。ほかのUnitの完了済みの作業は残る           |

ジャンプでは、何を戻したかと戻り方が1行で示されます。ファイルは削除されず、戻った工程が以前のファイルを見つけると、Keep・Modify・Redoのどれにするかを尋ねます。

## 2.8.1・2.10.0での手順

**2.8.1・soloでは変更できます。** 対象intentがアクティブであることを確認し、実行中の作業が止まっているタイミングで、ネイティブCLIなら次を実行します。

```bash
aidlc engine state set-construction-iteration stage-major
aidlc engine state get "Construction Iteration"
```

コピー版なら、同じ操作は次です。両方を実行する必要はありません。

```bash
bun .claude/tools/aidlc-state.ts set-construction-iteration stage-major
bun .claude/tools/aidlc-state.ts get "Construction Iteration"
```

その後、チャットで `/aidlc --resume` します。次のエンジン判定から順序が変わります。設定変更自体は既存の設計書・コードを削除しませんが、完了記録を有効とする基準が変わり、作業済みUnitの再確認・レビュー・完了処理が必要になる場合があります。すべてが無条件で引き継がれる移行コマンドではありません。

**2.10.0のConstruction中は、追加の承認手順が必要です。** チャットで「Construction Iterationをstage-majorへ変更したい」と依頼し、その項目・値に対する承認質問に答えます。エンジンは同じセッションでの明示的な選択を確認してから設定します。上のsetterだけを先に実行すると拒否される場合があります。Inception中はこのConstruction方針変更の証跡は不要です。

## teamでの制約

`Unit Ownership: team` では、2.11.0でもunit-majorからの変更が拒否されます。先にUnit Ownershipをsoloへ変える必要があります。teamでUnit作業を開始した後は所有方式の変更にも制限があるため、単にsoloへ書き換えて進めないでください。

## 根拠

[2.11.0のリリース](https://github.com/awslabs/aidlc-workflows/releases/tag/v2.11.0)、[2.11.0の実行順序と会話での変更](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/guide/12-cli-commands.md#construction-order-and-execution)、[2.11.0のジャンプとRedo](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/guide/11-session-management.md#jump-to-a-specific-stage)、[2.11.0の設定変更とteamの制約](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/core/tools/aidlc-state.ts)、[2.8.1の設定変更](https://github.com/awslabs/aidlc-workflows/blob/215afe1a61cb06e43002f5ace9ede10dfad80ed4/core/tools/aidlc-state.ts)、[2.8.1の完了記録の判定](https://github.com/awslabs/aidlc-workflows/blob/215afe1a61cb06e43002f5ace9ede10dfad80ed4/core/tools/aidlc-lib.ts)、[2.10.0の実行順序と変更時の承認](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/12-cli-commands.md#construction-order-and-execution)。

## 関連記事

- [5 Boltのstage-majorとunit-major](./aidlc-tip-construction-order.md)
- [solo・Unit・Boltの関係](./aidlc-tip-solo-unit-bolt.md)
