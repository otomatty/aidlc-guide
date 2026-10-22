# project.mdはいつ読み込まれる？

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.11.0・2.11.1・Claude Code。内容確認: 2026年10月22日。

Claude Codeでは、AI-DLCの `.claude/CLAUDE.md` が参照する `.claude/rules/aidlc.md` を通して、アクティブなspaceの `memory/project.md` などを会話のルールとして読み込みます。特定のステージだけで使うファイルではありません。

## 読み込みの仕組みと編集先

さらにAI-DLCエンジンは、ステージの実行指示に適用ルールを `rules_in_context` として含めます。ルールの組み合わせは `org → team → project → phase → stage` の順で、適用される内容を加えます。projectの記述で組織ルールを黙って上書きする方式ではありません。

既定の編集先は `aidlc/spaces/default/memory/project.md` です。別のspaceを使う場合は `aidlc/active-space` と参照先を確認してください。`.claude/` 内にルールの複製を作ると、本来の編集先と食い違います。

ルールの解決結果はグラフに保持されます。実行中に変更した場合は、その内容を再読込し、適用ルールを確認してから続けるようチャットで伝えてください。ファイル保存だけで現在の会話や実行中の指示が即座に差し替わったとは判断しません。

2.11.0のClaude Codeでは、セッション開始時からmemoryのファイルが変わっていない間、エンジンはステージ指示にルールの全文を再送せず、会話が保持しているルールを示すだけにします。会話の途中でファイルを編集した後は、次のステージ指示に全文を含めます。

## 2.11.1での追記

**会話が読むのはアクティブなspaceのコピーです。** 2.11.1の `.claude/rules/aidlc.md` は、`aidlc/spaces/<space>/memory/` を直接参照せず、`aidlc/active-memory/` のファイルを読み込みます。これはアクティブなspaceのmemoryをエンジンが複製した、gitに含めないコピーです。セッション開始時、spaceの切り替え時、ルールの全文を送るステージ指示のたびに更新されます。spaceを切り替えても追跡対象のファイルは変わらず、`.claude/rules/aidlc.md` はチーム全員で同じ内容のままです。

**編集先は変わりません。** 編集するのは引き続き `aidlc/spaces/<space>/memory/project.md` です。`aidlc/active-memory/` のコピーや `.claude/rules/aidlc.md` は編集しません。コピーが元のmemoryより古いままになっている場合は、`/aidlc --doctor` が `active space method copy is behind ...` と警告し、対処を示します。

**全文を送るかはファイルごとに判断します。** 2.11.1では、そのステージ指示が使うルールの各ファイルが、セッション開始時から変わっていないかを確かめます。会話の途中で編集したファイルが含まれるステージ指示には、全文が含まれます。

## 根拠

[2.11.0のルールと学習](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/guide/09-rules-and-the-learning-loop.md)、[Claude Codeのルール参照](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/harness/claude/rules-aidlc.md)、[2.11.1のルールと学習](https://github.com/awslabs/aidlc-workflows/blob/895a35d86d20336d9b7bc4aedc9440e4a12c83ab/docs/guide/09-rules-and-the-learning-loop.md)、[2.11.1のClaude Codeのルール参照](https://github.com/awslabs/aidlc-workflows/blob/895a35d86d20336d9b7bc4aedc9440e4a12c83ab/harness/claude/rules-aidlc.md)、[2.11.1のspace切り替えとコピー](https://github.com/awslabs/aidlc-workflows/blob/895a35d86d20336d9b7bc4aedc9440e4a12c83ab/docs/guide/03-spaces-and-intents.md)、[2.11.1のルール全文の送信判定](https://github.com/awslabs/aidlc-workflows/blob/895a35d86d20336d9b7bc4aedc9440e4a12c83ab/core/tools/aidlc-rules-held.ts)、[2.11.1のリリース](https://github.com/awslabs/aidlc-workflows/releases/tag/v2.11.1)。

## 関連記事

- [composeで省略された非機能要件を含めたい](./aidlc-tip-compose-nfr.md)
