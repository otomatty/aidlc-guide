# composeで省略された非機能要件を含めたい

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.10.0・2.11.0・Claude Code。内容確認: 2026年10月9日。

最初の計画を承認する前なら、ステージ選択の提案に対して「非機能要件 `nfr-requirements` をEXECUTEに含めて、計画を再提示してください」と伝えます。必要なら `nfr-design` も指定します。

## 計画への追加と再構成

2.10.0以降の進行中の作業では、次のように再構成を依頼できます。

```text
/aidlc compose "非機能要件 nfr-requirements を実施対象に追加してください。非機能設計 nfr-design と後続工程への入力も確認して計画を再提示してください。"
```

進行中の再構成が変更できるのは、現在地より先の未着手の工程です。完了済み・実行中の工程と、Constructionで最初に実行する工程には制約があります。対象をすでに通過している場合は、戻る工程と既存成果物への影響を確認してから変更します。

`/aidlc-nfr-requirements` のような単独ステージの実行は、本線の計画への追加とは別です。本線に含めたい場合は、実行対象の変更として依頼してください。

## 2.11.0での追記

**ステージ表は頼むと表示されます。** 2.11.0の計画の提案は短く、ステージごとの表とスコアは求めたときに表示されます。非機能要件が含まれているかを確かめたいときは、承認前に表を見せるよう伝えます。

**ステージを名指しすると、その場で計画が変わります。** 進行中に次のように入力すると、承認の質問なしで残りの工程に追加され、何が変わったかと元に戻す反対のフラグ（`--skip`）が1行で示されます。チャットで「nfr-requirementsを追加して」と名指しした場合も同じです。

```text
/aidlc --add nfr-requirements,nfr-design
```

計画が受け付けられない変更（現在地より前の工程、Constructionで最初に実行する工程など）は、理由と代わりの方法を示して拒否されます。すでに通過した工程を本線の計画と進捗を変えずに実行するには、`/aidlc --stage nfr-requirements --single` を使います。「ほかに何を削れる？」のような名指しのない相談は、従来どおり `/aidlc compose` と同じ提案と承認を経ます。

**composeはスコープファイルを書きません。** 2.11.0では、合成した計画はその作業だけのものです。再利用できるスコープとして残したい場合は、独自の計画の承認時に **Approve and save as scope** を選ぶか、後から「この計画をquick-fixとして保存して」のように頼みます。エンジンは `aidlc engine scope save --name quick-fix` を実行し、次から `/aidlc --scope quick-fix "..."` で使えます。保存したスコープは `aidlc/scopes/<name>.md` に置かれます。

## 根拠

[2.10.0のcomposeと進行中の再構成](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/05-scopes-and-depth.md)、[2.11.0のcomposeとスコープの保存](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/guide/05-scopes-and-depth.md#the-adaptive-composer)、[2.11.0の `--skip`・`--add` と単独ステージのコマンド](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/guide/12-cli-commands.md)、[2.11.0のリリース](https://github.com/awslabs/aidlc-workflows/releases/tag/v2.11.0)。

## 関連記事

- [ステージが完了せず進まない](./aidlc-tip-stage-recovery.md)
- [project.mdはいつ読み込まれる？](./aidlc-tip-project-rules.md)
