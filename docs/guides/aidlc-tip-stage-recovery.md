# ステージが完了せず進まない

[Tips一覧へ](./aidlc-workflows-tips.md)

対象: 2.10.0・2.11.0・2.11.1・Claude Code。内容確認: 2026年10月22日。

まず停止の原因を確認します。ステージ移動は、現在の工程を正常完了にする操作ではありません。

## 確認と復旧の手順

まず、チャットで次を順に実行します。

```text
/aidlc --status
/aidlc --doctor
```

承認待ち、未回答の質問、成果物不足、レビュー未完了、hooksの不調では対処が違います。完了条件を満たしているなら、表示された承認質問に答えます。エラーがある場合はdoctorが示す原因を直し、`/aidlc --resume` で再開します。2.11.0では、新しいセッションで `/aidlc` だけを入力しても、再開メニューを出さずに止まったところから続けます。

実施しない工程を飛ばす判断をした場合は、移動先を明示できます。

```text
/aidlc --stage code-generation
```

これは「今の工程を正常完了にする」コマンドではありません。途中の工程がスキップされ、後続の入力や成果物に影響することがあります。エンジンが示す影響を確認してください。2.11.0では、飛ばした工程と戻り方が1行で示されます。状態ファイルのチェックボックスを手で完了に書き換えると、監査記録や完了判定と食い違います。監査上は開始済みなのにチェックボックスが `[ ]` のままのステージがあると、その完了は拒否されます。この食い違いはdoctorが警告し、直すべき行を示します。

## 2.11.0で増えた復旧の手段

**中断したビルドは続きから再開します。** Code Generationがモデル・プロバイダーのエラーやエディターの終了で途中で止まった場合、次の実行は同じ計画の最初の未チェックのステップから再開します。例えば `Picking up unit-2's code at step 5 of 9 (1-4 done).` のような1行が表示されます。Redo、Request Changes、計画の再承認では、最初からやり直します。

**終わっていないレビューを越えて承認できます。** 依頼したレビューがまだ判定を返していないとき、人が承認すると、その承認が通ります。次の1行が表示され、監査ログの `GATE_APPROVED` には `Review: not finished` が記録されます。

```text
Approved. The <Stage> review did not finish.
```

ただし、チームのmemory（`org.md`・`team.md`・`project.md`）の `## Guard Policy` に `Mode: strict` がある場合は、レビューの完了が必要です。一度も依頼していないレビュー、検証できなかった結果、判定の後に内容が変わったレビューも、承認の前に完了が必要です。Unitのチェックポイントでは、作業のGuard Policyが `relaxed` か `off` の場合に限り、同じように承認できます。

**承認済みの計画は一度だけ尋ねます。** コード生成の計画承認はエンジンが尋ね、会話の圧縮や作業の中断の後でも、承認済みの計画を再び尋ねません。計画の回答を待つ間も、止まるのはビルドだけです。レビュー、設定の変更、コミットなどの依頼は実行されます。承認した計画やテスト手順がビルド前に変わった場合は、何が変わったかが示され、「go back to the approved plan」と伝えると承認した内容に戻せます。

## 2.11.1での追記

**コードが別の場所にあってもCode Generationを承認できます。** コードがworktree（子フォルダや `.worktrees/` 配下）・クローン・サブモジュール・monorepoのパッケージ・別の場所へのリンクにある場合や、記録より先にコミットした場合も、Code Generationの承認質問が開きます。`.claude/worktrees/<name>` のようなツールのフォルダ、プロジェクトの外、別ドライブにあってレビューから見えない場合は、質問に `AI-DLC found no source changes under <where it looked>` が1回添えられます。通常どおり承認するか、変更を依頼します。Guard Policyが `strict` か `relaxed` なら最初の報告が1回拒否され、次の報告で同じ質問が開きます。自律実行・人の発言の確認が無効・無人実行では、拒否が残ります。

**開いている承認質問から1回で戻れます。** Code Generationの承認質問が開いている間に、前のステージへ戻る、またはステージのやり直しを頼むと、どのGuard Policyでも最初の依頼で通ります（GitHub Copilotは従来どおり最初の依頼が1回拒否されます）。

**会話の圧縮後もビルドが続きます。** Guard Policyが `off`（`enterprise` 以外のスコープの既定）なら、ビルド中に会話が圧縮されても、記録済みのビルドの工程から続けます。繰り返しのレビューが終わらなかったUnitは、その前のレビューで承認質問が開きます（`relaxed` でも同じ）。

**自分の言葉で止められます。** 「ちょっと待って」「今日はここまで」のように止めると、エージェントはそれ以上進めず、続けるかどうかも尋ねません。止めた場所は次のように示されます。

```text
Paused at <Stage> with everything saved. Pick it back up any time here, or with /aidlc --resume in a new chat.
```

**計画の質問は返答まで待ちます。** 返答が届かなかった場合も、計画の承認質問は返答があるまで作業を始めません。質問を出したメッセージで頼んだ変更は、その回答として扱われます。待つ間も、読み取り、スキャン、テストの実行、AI-DLC自身のコマンド（頼んだ更新を含む）は実行されます。Code Generationは承認済みの計画からだけ完了し、承認後のAI-DLCの更新で再び尋ねられることはありません。

**新しいチャットで未回答の質問を再び尋ねます。** 以前のチャットで尋ねられて答えていない質問は、新しいチャットで `/aidlc` だけを入力すると、同じ形でもう一度尋ねられます。

## 根拠

[2.10.0のセッション管理](https://github.com/awslabs/aidlc-workflows/blob/2a883858f5483bce3b48f43b8f6d3ca2c042d6ae/docs/guide/11-session-management.md)、[2.11.0のセッション管理](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/guide/11-session-management.md)、[2.11.0のトラブルシューティング](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/guide/15-troubleshooting.md)、[2.11.0の計画承認](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/guide/13-customization.md#plan-approval)、[2.11.0のレビュー未完了での承認](https://github.com/awslabs/aidlc-workflows/blob/6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a/docs/reference/12-state-machine.md)、[2.11.0のリリース](https://github.com/awslabs/aidlc-workflows/releases/tag/v2.11.0)、[2.11.1のリリース](https://github.com/awslabs/aidlc-workflows/releases/tag/v2.11.1)、[2.11.1のセッション管理](https://github.com/awslabs/aidlc-workflows/blob/895a35d86d20336d9b7bc4aedc9440e4a12c83ab/docs/guide/11-session-management.md)、[2.11.1のソース変更が見えない場合](https://github.com/awslabs/aidlc-workflows/blob/895a35d86d20336d9b7bc4aedc9440e4a12c83ab/docs/reference/15-stage-definition.md)、[2.11.1の計画承認](https://github.com/awslabs/aidlc-workflows/blob/895a35d86d20336d9b7bc4aedc9440e4a12c83ab/docs/guide/13-customization.md#plan-approval)、[2.11.1のレビュー未完了での承認](https://github.com/awslabs/aidlc-workflows/blob/895a35d86d20336d9b7bc4aedc9440e4a12c83ab/docs/reference/12-state-machine.md)。

## 関連記事

- [Claude Codeのhooksを修復する](./aidlc-tip-hooks.md)
- [composeで省略された非機能要件を含めたい](./aidlc-tip-compose-nfr.md)
