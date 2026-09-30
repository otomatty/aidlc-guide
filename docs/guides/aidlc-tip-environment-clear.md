# /clear後も環境変数は残る？

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: Claude Codeのプロセス環境。ガードの設定確認はAI-DLC 2.10.0。内容確認: 2026年9月30日。

起動時に渡した環境変数は、同じClaude Codeプロセスで会話を `/clear` しても、解除したことにはなりません。保持範囲を決めるのは、会話の履歴ではなく、どこで設定したかです。

## 保持される範囲と解除方法

| 設定方法                                            | 保持される範囲                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `AIDLC_SKIP_HUMAN_PRESENCE_GUARD=1 claude`          | その起動のClaude Codeと継承先。別の起動には自動で引き継がれない                      |
| シェルの `export` やPowerShellの `$env:`            | そのシェルと、そこから後で起動するプロセス。解除するまで同じシェルでの再起動にも渡る |
| シェル設定・OSの環境変数・Claude Codeの設定ファイル | 保存先の設定を変更するまで、新しい起動にも適用され得る                               |
| 1回のツールコマンドにだけ付けた変数                 | そのコマンドと子プロセス。起動済みClaude Code本体の環境は変更しない                  |

無効に戻したいときは、Claude Codeを終了し、元の設定場所から変数を取り除いてから起動し直します。2.10.0では `/aidlc config get guard.human-presence` でガードの状態を確認できます。

管理ポリシー下の復旧で `AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD` も設定した場合は、この変数も同じ範囲で保持されます。`/clear` では解除されないため、復旧後は両方を元の設定場所から取り除いて起動し直します。

## 根拠

[Claude Codeのhooksと環境変数](https://code.claude.com/docs/en/hooks)、[2.10.0の設定確認](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/13-customization.md)。

## 関連記事

- [AIDLC_SKIP_HUMAN_PRESENCE_GUARDとは？](./aidlc-tip-human-presence-guard.md)
- [Claude Codeのhooksを修復する](./aidlc-tip-hooks.md)
