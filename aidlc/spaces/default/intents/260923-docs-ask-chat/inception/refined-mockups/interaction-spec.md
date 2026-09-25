# 操作仕様

対象は `stories.md` の US1.1、US2.1、US3.1、US4.1 である。

## 質問の入口

| Field | Value |
|---|---|
| Component | 質問の入口 |
| Description | ホームで質問を始め、チャットへ移す |
| Category | input |

### States

| State | Description | Trigger |
|---|---|---|
| default | 空の入力と送信 | 会話が無くホームを開いた |
| focus | 入力にキーボード焦点 | Tab またはクリック |
| disabled | 送信できない | 空、2000字超、またはホストモード |
| loading | 送信ボタンが止まる | 送信後、チャットへ移るまで |
| error | 短い失敗メッセージ | 送信拒否 |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 入力と送信を縦に積む |
| desktop (>1024px) | 入力と送信を横に並べる |

## チャット

| Field | Value |
|---|---|
| Component | チャット |
| Description | 続きの質問、待ち、失敗、引用 |
| Category | layout |

### States

| State | Description | Trigger |
|---|---|---|
| default | 会話一覧と入力 | 送信後、または保存済み会話でドキュメントを開いた |
| loading | 送信ボタンが止まる | 応答中 |
| error | 入力のそばに短いメッセージ | 失敗または拒否 |
| disabled | 2000字超では送信できない | 入力が上限を超えた |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| mobile (<768px) | 会話と入力を縦に積む |
| desktop (>1024px) | 会話を中央の読みやすい幅に寄せる |

## 記事から戻る

| Field | Value |
|---|---|
| Component | チャットへ戻る |
| Description | 記事画面からチャットへ戻す |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | 戻る操作が見える | 引用から記事を開いた |
| focus | キーボードで操作できる | Tab |

戻ったあとのチャットは、離れる前の会話と書きかけの文を示す。分割表示にはしない。
