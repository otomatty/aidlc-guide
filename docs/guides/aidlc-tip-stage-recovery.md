# ステージが完了せず進まない

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.10.0・Claude Code。内容確認: 2026年9月29日。

まず停止の原因を確認します。ステージ移動は、現在の工程を正常完了にする操作ではありません。

## 確認と復旧の手順

まず、チャットで次を順に実行します。

```text
/aidlc --status
/aidlc --doctor
```

承認待ち、未回答の質問、成果物不足、レビュー未完了、hooksの不調では対処が違います。完了条件を満たしているなら、表示された承認質問に答えます。エラーがある場合はdoctorが示す原因を直し、`/aidlc --resume` で再開します。

実施しない工程を飛ばす判断をした場合は、移動先を明示できます。

```text
/aidlc --stage code-generation
```

これは「今の工程を正常完了にする」コマンドではありません。途中の工程がスキップされ、後続の入力や成果物に影響することがあります。エンジンが示す影響を確認し、必要な承認を行ってください。状態ファイルのチェックボックスを手で完了に書き換えると、監査記録や完了判定と食い違います。

## 根拠

[2.10.0のセッション管理](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/11-session-management.md)、[トラブルシューティング](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/15-troubleshooting.md)。

## 関連記事

- [Claude Codeのhooksを修復する](./aidlc-tip-hooks.md)
- [composeで省略された非機能要件を含めたい](./aidlc-tip-compose-nfr.md)
