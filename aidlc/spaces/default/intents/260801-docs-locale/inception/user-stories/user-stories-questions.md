# User Stories — 質問ファイル

> ステージ: user-stories (Inception 2.4) / 深度: Standard  
> Intent: `260801-docs-locale`（docs-i18n **Bolt 2**）  
> 親: 完了済み `260730-docs-i18n`（Bolt 1 / PR [#26](https://github.com/otomatty/aidlc-guide/pull/26)）  
> 追跡 Issue: [#28](https://github.com/otomatty/aidlc-guide/issues/28)  
> Bolt 1 で US-03 / US-04 の契約は定義済み。本 intent は **実装レベルのストーリー** を固定するための質問です。  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。

---

## Q1. ペルソナ開発アプローチ

Bolt 2 のペルソナはどうしますか？

- A. 親 intent の P1（初学者エンジニア）を継承
- B. 新規ペルソナを追加
- C. A（親 intent の P1/P2/P3 を継承し、P1 を主とする）
- X. その他（具体的に記入）

[Answer]: C

## Q2. ストーリー分解アプローチ

Bolt 2 のストーリー分解はどれですか？

- A. 親 intent の US-03 / US-04 を実装可能な詳細に分解
- B. 新規ストーリーを追加
- C. A（親 intent の US-03 / US-04 を継承しつつ実装詳細を追加）
- X. その他（具体的に記入）

[Answer]: C

## Q3. ストーリー優先度

Bolt 2 のストーリー優先度はどれですか？

- A. keep-path・notice・anchor・coverage すべて Must
- B. keep-path・notice・anchor は Must、coverage は Should
- C. keep-path のみ Must、他は Should
- X. その他（具体的に記入）

[Answer]: A

## Q4. 受入基準の形式

Bolt 2 の受入基準はどの形式ですか？

- A. GWT（Given-When-Then）
- B. チェックリスト
- C. A（GWT を基本とし、補助的にチェックリスト）
- X. その他（具体的に記入）

[Answer]: C

## Q5. INVEST 準拠

Bolt 2 のストーリーは INVEST を意識しますか？

- A. はい（Independent, Negotiable, Valuable, Estimable, Small, Testable）
- B. いいえ
- X. その他（具体的に記入）

[Answer]: A

## Q6. スコープ外の確認

Bolt 2 に **含めない** ストーリーを再確認します。（select all that apply）

- A. US-05（深リンク）→ B3 / #29
- B. US-06（Bridge 縮退）→ B4 / #30
- C. US-08（差分レポート）→ B5 / #31
- D. 上記すべて
- X. その他（具体的に記入）

[Answer]: D
