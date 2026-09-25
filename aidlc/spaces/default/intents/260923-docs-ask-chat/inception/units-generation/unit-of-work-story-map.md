# 物語と塊の対応

各物語の実装先は `docs-ask-chat`（U1、`u1-docs-ask-chat`）である。根拠は `stories.md` と `requirements.md`。部品一覧（`components.md`）と決定記録（`decisions.md`）は無い。複数の塊にまたがる物語は無い。

ここでは実装の順番を決めない。物語同士の依存は `stories.md` に既にある記述のまま残し、作る順にはしない。

## 対応

| Story | Unit ID | Name | Directory |
| --- | --- | --- | --- |
| US1.1 | U1 | `docs-ask-chat` | `u1-docs-ask-chat` |
| US2.1 | U1 | `docs-ask-chat` | `u1-docs-ask-chat` |
| US3.1 | U1 | `docs-ask-chat` | `u1-docs-ask-chat` |
| US4.1 | U1 | `docs-ask-chat` | `u1-docs-ask-chat` |

## 複数の塊にまたがる物語

無し。入口、チャットでの続き、保存、引用から戻る、はすべて同じ塊の内側である。

## 塊の内側

次はラベルである。作る順ではない。

- US1.1 ホームからチャットへ入る
- US2.1 チャットで続きを聞く
- US3.1 次に開いても会話が残る
- US4.1 引用から記事へ移って戻る

## 被覆

| 確認 | 結果 |
| --- | --- |
| すべての物語が割り当て済み | US1.1、US2.1、US3.1、US4.1 |
| すべての塊に物語がある | `docs-ask-chat` に 4 件 |
