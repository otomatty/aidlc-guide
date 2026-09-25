## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-09-24T03:19:00Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | aidlc/spaces/default/intents/260923-docs-ask-chat/inception/requirements-analysis/requirements.md > FR1 / FR3 | FR3 はアプリ再起動後も同じ会話が残ることを要求するが、FR1 はホームを「入口だけ」に限定し、回答カードも会話一覧も置かない。再オープン時に、新規質問を送らずに残った会話を開き直す導線が無い。Q2-C の価値（次に開いたとき会話が残る）を満たす実装が、ホームから自動でチャットへ戻すのか、入口以外の再開操作なのか、送信時にだけ復元するのか、開発者が決められない。 | 再オープン／ホーム再訪時の再開要件を明示する（例: 保存済み会話があるときホームからチャットへ入れる操作、または起動時にチャットへ戻す）。そのとき会話が画面上で見えることと、新規質問なしで再開できることを受け入れ条件にする。 | New |
| R-02 | Major | aidlc/spaces/default/intents/260923-docs-ask-chat/inception/requirements-analysis/requirements.md > 前提 / FR3 | 「同じ会話」をインストール全体で一つのスレッドとし、記事・locale では分けない、と前提に書いているが、質問ファイルでは確認されていない。永続化のキーとチャットの対象範囲がここで決まると、後から記事単位に分けると FR3・保存設計のやり直しになる。 | ゲートで単一スレッド前提を採否する。採るなら前提のまま明示確認を残す。記事ごと／locale ごとに分けるなら FR3 と対象外を書き換える。 | New |
| R-03 | Major | aidlc/spaces/default/intents/260923-docs-ask-chat/inception/requirements-analysis/requirements.md > FR2 / 機能要件 | チャット画面での質問成功パス（送信・待ち・完了・キャンセル）は書かれているが、失敗・拒否・タイムアウト時に利用者が何を見るか、会話にどう残るかが無い。NFR5 の hostMode 拒否以外、エラーの観測条件が無い。 | チャットでの失敗表示（少なくともジョブ error・送信拒否）と、失敗ターンが履歴／画面に残るか消えるかを FR として書く。既存挙動踏襲なら「現状の DocsQuestionPanel と同等」と対象イベントを列挙する。 | New |
| R-04 | Minor | aidlc/spaces/default/intents/260923-docs-ask-chat/inception/requirements-analysis/requirements.md > FR3.1 | 「画面に見えていたターン一式」は、ビューポート内だけなのか、スクロール可能な会話全体なのか曖昧。FR4.2 と併読すれば全体と読めるが、単独だと切り詰め実装の抜け道になる。 | FR3.1 を「チャット画面に表示する会話ターン全体（スクロール分を含む）。モデルへ渡す件数で表示を切らない」など、観測可能な文言に直す。 | New |

### Summary

入口と遷移・履歴件数・永続化の「残る」までは揃っているが、再オープン後にその会話へ戻る導線が欠けており、単一スレッド前提とエラー表示も未確定のままでは実装と QA が分岐する。承認前に再開 UX を決めるのが最優先である。
