# 進行中にunit-majorからstage-majorへ変更する

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.8.1・2.10.0。soloとteamの制約を記載。内容確認: 2026年9月29日。

2.8.1のsoloでは設定を変更して再開できます。2.10.0のConstruction中は、変更内容に対する人の承認も必要です。

## 変更手順と制約

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

`Unit Ownership: team` では、unit-majorからの変更が拒否されます。teamでUnit作業を開始した後は所有方式の変更にも制限があるため、単にsoloへ書き換えて進めないでください。

## 根拠

[2.8.1の設定変更](https://github.com/awslabs/aidlc-workflows/blob/215afe1a61cb06e43002f5ace9ede10dfad80ed4/core/tools/aidlc-state.ts)、[2.8.1の完了記録の判定](https://github.com/awslabs/aidlc-workflows/blob/215afe1a61cb06e43002f5ace9ede10dfad80ed4/core/tools/aidlc-lib.ts)、[2.10.0の実行順序と変更時の承認](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/12-cli-commands.md#construction-order-and-execution)。

## 関連記事

- [5 Boltのstage-majorとunit-major](./aidlc-tip-construction-order.md)
- [solo・Unit・Boltの関係](./aidlc-tip-solo-unit-bolt.md)
