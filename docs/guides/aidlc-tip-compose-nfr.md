# composeで省略された非機能要件を含めたい

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.10.0・Claude Code。内容確認: 2026年9月29日。

最初の計画を承認する前なら、ステージ選択の提案に対して「非機能要件 `nfr-requirements` をEXECUTEに含めて、計画を再提示してください」と伝えます。必要なら `nfr-design` も指定します。

## 計画への追加と再構成

進行中の2.10.0では、次のように再構成を依頼できます。

```text
/aidlc compose "非機能要件 nfr-requirements を実施対象に追加してください。非機能設計 nfr-design と後続工程への入力も確認して計画を再提示してください。"
```

進行中の再構成が変更できるのは、現在地より先の未着手の工程です。完了済み・実行中の工程と、Constructionで最初に実行する工程には制約があります。対象をすでに通過している場合は、戻る工程と既存成果物への影響を確認してから変更します。

`/aidlc-nfr-requirements` のような単独ステージの実行は、本線の計画への追加とは別です。本線に含めたい場合は、実行対象の変更として依頼してください。

## 根拠

[2.10.0のcomposeと進行中の再構成](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/05-scopes-and-depth.md)、[単独ステージのコマンド](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/12-cli-commands.md)。

## 関連記事

- [ステージが完了せず進まない](./aidlc-tip-stage-recovery.md)
- [project.mdはいつ読み込まれる？](./aidlc-tip-project-rules.md)
