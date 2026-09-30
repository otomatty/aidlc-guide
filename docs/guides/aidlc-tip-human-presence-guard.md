# AIDLC_SKIP_HUMAN_PRESENCE_GUARDとは？

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.10.0・Claude Code。内容確認: 2026年9月30日。

`AIDLC_SKIP_HUMAN_PRESENCE_GUARD=1` は、承認や回答が実際の人の発言に基づくことを検証するガードの一時回避です。hooksが発言の証跡を記録できない環境などで、人が付き添って復旧するための設定です。

## 一時回避の範囲と起動方法

hooksそのものを修復する設定でも、すべての承認を自動化する設定でもありません。別のガードや成果物の要件は残ります。2.10.0には起動セッションに結び付いた検証もあるため、AIがツール呼び出しの直前だけ環境変数を足せば、すべての拒否を回避できるわけではありません。

人が一時回避を選んだ場合の、ターミナル版Claude Codeの起動例です。

macOS / Linux / Git Bash:

```bash
AIDLC_SKIP_HUMAN_PRESENCE_GUARD=1 claude
```

PowerShell:

```powershell
$env:AIDLC_SKIP_HUMAN_PRESENCE_GUARD = "1"
claude
# Claude Code終了後に、このPowerShellの設定を解除する
Remove-Item Env:AIDLC_SKIP_HUMAN_PRESENCE_GUARD
```

修復後は設定を解除してClaude Codeを起動し直し、通常の検証へ戻します。常用設定としてチームに配布することは避けてください。

## 管理ポリシーでproject hooksが禁止されている場合

`/hooks` と `/aidlc --doctor` で、組織の `allowManagedHooksOnly: true` による禁止を確認した場合は、Claude Codeの管理者に解除を依頼します。プロジェクト側の設定では解除できません。

管理者の対応まで人が付き添って復旧する場合は、起動環境に `AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD=1` も設定します。hooksが禁止されていると、人の発言と要約確認の両方の証跡を記録できないため、`AIDLC_SKIP_HUMAN_PRESENCE_GUARD=1` だけでは要約確認の検証で止まります。

macOS / Linux / Git Bash:

```bash
AIDLC_SKIP_HUMAN_PRESENCE_GUARD=1 AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD=1 claude
```

この書き方では両方の変数をその起動にだけ渡します。シェルで `export` していた場合は、Claude Code終了後に両方を解除します。

```bash
unset AIDLC_SKIP_HUMAN_PRESENCE_GUARD AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD
```

PowerShell:

```powershell
$env:AIDLC_SKIP_HUMAN_PRESENCE_GUARD = "1"
$env:AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD = "1"
claude
# Claude Code終了後に、このPowerShellの両方の設定を解除する
Remove-Item Env:AIDLC_SKIP_HUMAN_PRESENCE_GUARD
Remove-Item Env:AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD
```

要約確認用の変数を追加するのは、この管理ポリシー下での一時復旧です。人が承認・回答する手順は続けます。管理者がポリシーを解除し、hooksの承認を終えたら、両方の変数を解除してClaude Codeを完全に終了・再起動し、`/aidlc --doctor` で再確認します。

## 根拠

[2.10.0のガードと一時回避](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/13-customization.md)、[人が付き添う復旧](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/15-troubleshooting.md)。

## 関連記事

- [Claude Codeのhooksを修復する](./aidlc-tip-hooks.md)
- [/clear後も環境変数は残る？](./aidlc-tip-environment-clear.md)
