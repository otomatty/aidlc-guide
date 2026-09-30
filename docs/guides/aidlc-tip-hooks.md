# Claude Codeのhooksを修復する

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.10.0・Claude Code。内容確認: 2026年9月30日。

「hooksを直す」は、イベントに登録された処理をClaude Codeが実行できる状態に戻すことです。ガードを無効にする操作とは分けて考えます。

## 設定と実行環境の確認

| 確認する場所                                 | 見ること・対処                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/hooks` と `/aidlc --doctor`                | hooksの登録、実行失敗、記録不足を確認する                                                       |
| `.claude/settings.json`                      | 使用バージョンのhooksが登録され、コマンドが存在するパスを参照しているか                         |
| `.claude/settings.local.json` とユーザー設定 | `disableAllHooks` などで無効になっていないか                                                    |
| Claude Codeを起動する環境                    | コピー版が使う `bun` を、hooksを起動するプロセスから見つけられるか                              |
| 組織のmanaged settings                       | `allowManagedHooksOnly: true` でプロジェクトのhooksが禁止されていないか。変更は管理者へ依頼する |

Windowsでは、今開いているPowerShellで `bun --version` が通っても、以前から起動しているVS CodeやClaude Codeに同じPATHが渡っているとは限りません。PATHや設定を修正したら、起動元のアプリも終了して起動し直し、再診断します。

配布ファイルの欠落や登録のずれは、そのプロジェクトの導入方式・バージョンに合う公式の設定処理で修復します。独自設定がある場合は差分を確認してください。拡張機能から更新する場合の診断と修復は、[更新時の問題を診断・修正する](./updating-workflows.md)にあります。

`allowManagedHooksOnly: true` による禁止が原因で、管理者の対応まで人が付き添って復旧する場合は、[管理ポリシー下の一時回避手順](./aidlc-tip-human-presence-guard.md#管理ポリシーでproject-hooksが禁止されている場合)を参照してください。人の発言と要約確認の証跡を記録できないため、起動環境に両方のガード用変数が必要です。

## 根拠

[2.10.0のhooksに関する診断](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/15-troubleshooting.md)、[Claude Codeのhooks設定](https://code.claude.com/docs/en/hooks)。

## 関連記事

- [AIDLC_SKIP_HUMAN_PRESENCE_GUARDとは？](./aidlc-tip-human-presence-guard.md)
- [/clear後も環境変数は残る？](./aidlc-tip-environment-clear.md)
- [ステージが完了せず進まない](./aidlc-tip-stage-recovery.md)
