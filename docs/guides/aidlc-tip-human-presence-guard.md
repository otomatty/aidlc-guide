# AIDLC_SKIP_HUMAN_PRESENCE_GUARDとは？

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.10.0・Claude Code。内容確認: 2026年9月29日。

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

## 根拠

[2.10.0のガードと一時回避](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/13-customization.md)、[人が付き添う復旧](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/15-troubleshooting.md)。

## 関連記事

- [Claude Codeのhooksを修復する](./aidlc-tip-hooks.md)
- [/clear後も環境変数は残る？](./aidlc-tip-environment-clear.md)
