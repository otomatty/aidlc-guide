# エンティティ

このインストールの会話は一つである。置き場は、質問を処理する側が使うホストのローカルな保存領域である。ワークスペースのファイルには書かない。データベースは使わない。根拠は `requirements.md` と `unit-of-work.md`。

```yaml
entities:
  - name: Conversation
    description: このインストールのドキュメント質問について、一つの継続したスレッド
    attributes:
      - name: turns
        logical_type: list of Turn
        required: true
        unique: false
        constraints: 画面の一覧は直近 8 件では切り詰めない
      - name: draft
        logical_type: text
        required: false
        unique: false
        constraints: チャットの書きかけ。記事から戻ったとき残る
    constraints:
      - インストールにつき一つ
      - 記事ごと、locale ごとには分けない
      - ホストのローカル保存に置く。ワークスペースのファイルにもクラウドにも置かない
    relationships:
      - to: Turn
        cardinality: one-to-many
        direction: Conversation owns Turn
  - name: Turn
    description: 完了した一往復。質問と回答と引用
    attributes:
      - name: question
        logical_type: text
        required: true
        unique: false
        constraints: 2000 字以内で送信されたもの
      - name: answer
        logical_type: text
        required: true
        unique: false
        constraints: 文字数では切らない
      - name: citations
        logical_type: list of Citation
        required: true
        unique: false
    relationships:
      - to: Citation
        cardinality: one-to-many
        direction: Turn owns Citation
  - name: Citation
    description: 回答が指す記事
    attributes:
      - name: locale
        logical_type: text
        required: true
        unique: false
        constraints: en または ja
      - name: article_path
        logical_type: text
        required: true
        unique: false
```

## 要約

会話がターンを持ち、ターンが引用を持つ。保存されるのは会話全体（一覧と書きかけ）である。モデルへ渡すときだけ、完了ターンの直近 8 件を使う。
