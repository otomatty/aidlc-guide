# ビジネスルール

根拠は `requirements.md` と `stories.md`。

```yaml
rules:
  - id: BR1.1
    statement: ホームには質問の入口があり、回答カードは無い
    category: constraint
    applies_to: Conversation
    trigger: ホームを開く
    logic: 保存済み会話が無いときホームを開く THEN 入口を出し、回答カードは出さない
    violation: 入口が無い、または回答カードがある
    source: FR1
  - id: BR1.2
    statement: 2000 字以内の質問を入口から送るとチャットへ移り、ホームに回答は積まない
    category: policy
    applies_to: Conversation
    trigger: 入口から送信
    logic: 質問が 2000 字以内 THEN チャットへ移る。ホームに回答は残さない
    violation: ホームに回答が積まれる、またはチャットへ移らない
    source: FR1.1
  - id: BR1.3
    statement: 2000 字を超える質問は入口から送れない
    category: validation
    applies_to: Turn
    trigger: 入口から送信
    logic: 質問が 2000 字を超える THEN 送信しない
    violation: 超えた質問が送られる
    source: FR6
  - id: BR1.4
    statement: ホストモードでは入口からの送信を拒否し、チャットへ移らない
    category: authorization
    applies_to: Conversation
    trigger: ホストモードで入口から送信
    logic: ホストモード THEN 送信を拒否し、チャットへ移らない
    violation: チャットへ移る
    source: NFR5
  - id: BR2.1
    statement: 完了したターンのあと、チャットから次の質問を送れる
    category: policy
    applies_to: Conversation
    trigger: ターンが完了したあと
    logic: 進行中が無い THEN チャットから次を送れる
    violation: 完了後も送れない
    source: FR2
  - id: BR2.2
    statement: 次の質問へ渡す履歴は直近 8 件の完了ターンで、回答は文字数で切らない
    category: calculation
    applies_to: Turn
    trigger: 質問を送る
    logic: 渡す履歴は完了ターンの新しい方から 8 件。各回答は全文。判定は送った内容を見る
    violation: 8 件以外、または回答が切られている
    source: FR4
  - id: BR2.3
    statement: 2000 字を超える続きの質問はチャットから送れない
    category: validation
    applies_to: Turn
    trigger: チャットから送信
    logic: 続きの質問が 2000 字を超える THEN 送信しない
    violation: 超えた続きが送られる
    source: FR6.1
  - id: BR2.4
    statement: 応答が完了するまで次の質問は送れず、待ち行列は無い
    category: constraint
    applies_to: Conversation
    trigger: 応答中に送信
    logic: 応答が未完了 THEN 送信できない。待ち行列は作らない
    violation: 応答中に次が受理される
    source: FR2.1
  - id: BR2.5
    statement: 進行中の応答は、いまと同じキャンセルで止められる
    category: policy
    applies_to: Conversation
    trigger: キャンセル
    logic: 進行中がある THEN いまのキャンセルで止める
    violation: 止められない
    source: FR2.2
  - id: BR2.6
    statement: 進行中に送信を試みても、そのジョブは切り替わらない
    category: constraint
    applies_to: Conversation
    trigger: 進行中に送信
    logic: 試みは拒否され、進行中の応答が残る
    violation: 別の質問へ切り替わる
    source: NFR4
  - id: BR2.7
    statement: 進行中が 1 件あるあいだ、2 件目は処理されない
    category: constraint
    applies_to: Conversation
    trigger: 2 件目の送信
    logic: 進行中が 1 件 THEN 2 件目を拒否する
    violation: 2 件が同時に処理される
    source: NFR4
  - id: BR2.8
    statement: ホストモードではチャットの送信、取得、キャンセル、根拠の取得を拒否する
    category: authorization
    applies_to: Conversation
    trigger: ホストモードでチャットを操作
    logic: ホストモード THEN 送信、取得、キャンセル、根拠の取得を拒否する
    violation: それらのいずれかが成功する
    source: NFR5
  - id: BR3.1
    statement: 閉じたあと開くと、一覧のターンが残る。スクロールで届く分も含む
    category: policy
    applies_to: Conversation
    trigger: アプリを閉じて次に開く
    logic: ホストのローカル保存から会話を戻し、チャットを開く。画面に一度に映る分だけで切らない
    violation: ターンが欠ける
    source: FR3
  - id: BR3.2
    statement: 一覧が 8 件を超えても、古いターンは一覧から消えない
    category: constraint
    applies_to: Conversation
    trigger: 一覧の表示
    logic: 表示は保存されたターン一式。渡す履歴の 8 件では切らない
    violation: 古いターンが一覧から消える
    source: FR3.1
  - id: BR3.3
    statement: 保存はこのマシンのホスト領域で完結し、クラウドへ送らない
    category: policy
    applies_to: Conversation
    trigger: 会話を保存する
    logic: ホストのローカル保存へ書く。ワークスペースのファイルにもクラウドにも書かない
    violation: クラウドへ送る、またはワークスペースのファイルへ書く
    source: NFR3
  - id: BR4.1
    statement: 引用を選ぶと記事へ移る。チャットを隣に残す分割はしない
    category: policy
    applies_to: Citation
    trigger: 引用を選ぶ
    logic: 記事の画面へ移る。チャットを残した分割表示はしない
    violation: 記事が開かない、または分割になる
    source: FR5
  - id: BR4.2
    statement: 記事からチャットへ戻れる
    category: policy
    applies_to: Conversation
    trigger: 記事を見ている
    logic: チャットへ戻る操作がある
    violation: チャットへ戻れない
    source: FR5.1
  - id: BR4.3
    statement: 戻ったとき、会話と書きかけの文が残る
    category: constraint
    applies_to: Conversation
    trigger: 記事からチャットへ戻る
    logic: ターン一覧と draft をそのまま出す
    violation: 会話または書きかけが消える
    source: FR3.2
```

## 要約

| ID | 規則 |
| --- | --- |
| BR1.1 | ホームは入口だけ |
| BR1.2 | 送信でチャットへ移る |
| BR1.3 | 入口は 2000 字まで |
| BR1.4 | ホストモードは入口を拒否 |
| BR2.1 | 完了後に続きを送れる |
| BR2.2 | 渡す履歴は直近 8 件、回答は切らない |
| BR2.3 | 続きも 2000 字まで |
| BR2.4 | 応答中は送れない |
| BR2.5 | いまのキャンセルで止める |
| BR2.6 | 進行中のジョブは切り替わらない |
| BR2.7 | 同時に 1 件だけ |
| BR2.8 | ホストモードはチャット操作を拒否 |
| BR3.1 | 閉じても一覧が残る |
| BR3.2 | 一覧は 8 件で切らない |
| BR3.3 | ホストのローカル保存。クラウドもワークスペースのファイルも使わない |
| BR4.1 | 引用は記事へ。分割しない |
| BR4.2 | 記事からチャットへ戻れる |
| BR4.3 | 戻ると会話と書きかけが残る |
