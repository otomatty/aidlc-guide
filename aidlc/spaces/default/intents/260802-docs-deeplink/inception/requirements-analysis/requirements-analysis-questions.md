# Requirements Analysis — 質問ファイル

> ステージ: requirements-analysis (Inception) / 深度: Standard  
> Intent: `260802-docs-deeplink`（docs-i18n **Bolt 3**）  
> 親: `260730-docs-i18n` FR-U3 / Issue [#29](https://github.com/otomatty/aidlc-guide/issues/29)  
> 回答モード: Chat — 推奨を適用（ユーザー指示 2026-08-02）

---

## Q1. 要件 ID の扱い

Bolt 3 の requirements.md で親 FR をどう扱いますか？

- A. 親 FR-U3.1–U3.3 を参照継承し、Bolt 3 固有の差分だけを新しい ID（例: FR-B3.*）で書く
- B. Bolt 3 用に FR を一から採番し直し、親 ID は Traceability 表だけに残す
- C. 親 FR 本文をコピーして Bolt 3 向けに改訂した版を正本とする
- X. その他（具体的に記入）

[Answer]: A

## Q2. openOfficialDoc 契約

Must の契約はどれですか？（select all that apply）

- A. payload `{ locale, path, anchor? }`（親 FR-U3.1）
- B. マップ済み経路で外部ブラウザを開かない
- C. locale = last-used preference \|\| `en`
- D. メッセージ type / コマンド名は FD でピン留め（Open Question 継承）
- E. A〜D すべて必須
- X. その他（具体的に記入）

[Answer]: E

## Q3. リンクラベル

StageCard の docs リンク文言はどれが必須ですか？

- A. bare `Docs` のみでよい
- B. ステージが分かる文言（例: `Docs: Intent Capture`）。bare `Docs` 禁止（親 FR-U3.2）
- X. その他（具体的に記入）

[Answer]: B

## Q4. slug map

7 slug map の扱いはどれですか？

- A. 親 FR-U3.3 の 7 slug を正とし、本 Bolt で集合を増やさない。未登録 → Shell top
- B. Bolt 3 で slug を追加・変更してよい
- X. その他（具体的に記入）

[Answer]: A

## Q5. Docs Shell 着地

deep-link 着地の必須挙動はどれですか？（select all that apply）

- A. path があればそのページを開く
- B. anchor があり見出しがあればスクロール／フォーカス；なければページ先頭（Bolt 2 先例）
- C. locale を payload どおりに適用（Shell 状態に載せる）
- D. one-shot 消費（再適用しない）
- E. A〜D すべて
- X. その他（具体的に記入）

[Answer]: E

## Q6. レガシー経路

`docsOpenHref` / IDE open はどう扱いますか？

- A. マップ済み StageCard 経路では openOfficialDoc に置き換え（外部ブラウザ禁止と両立）
- B. レガシーを残し併置
- X. その他（具体的に記入）

[Answer]: A

## Q7. NFR 床

Bolt 3 で新たに必須化する NFR はどれですか？

- A. 親 NFR（local-only・no runtime fetch・既存 check）継承のみ。新 coverage 床は必須化しない（深リンク配線が主）
- B. dashboard StageCard / deep-link 経路に新規 branch coverage 95% 床を追加
- X. その他（具体的に記入）

[Answer]: A

---

## Consolidated Summary Confirmation

推奨回答の要約:

| Q | Answer |
|---|--------|
| Q1 | A — 親 FR-U3 継承 + FR-B3.* 差分 |
| Q2 | E — payload / 外部ブラウザ禁止 / locale 源 / type→FD |
| Q3 | B — bare `Docs` 禁止 |
| Q4 | A — 7 slug 固定、未登録→top |
| Q5 | E — path / anchor / locale / one-shot |
| Q6 | A — レガシー置換 |
| Q7 | A — 新規 coverage 床なし |

この要約で requirements.md を生成してよいですか？

- Looks correct
- Needs edits（具体的に記入）

[Answer]: Looks correct
