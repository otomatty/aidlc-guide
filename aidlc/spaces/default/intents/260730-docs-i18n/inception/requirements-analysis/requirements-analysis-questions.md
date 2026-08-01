# Requirements Analysis — 質問ファイル

> ステージ: requirements-analysis (Inception 2.3) / 深度: Standard  
> Intent: `260730-docs-i18n`  
> 入力: intent-statement / scope-document / codekb / team-practices（肯定済み）  
> 各 `[Answer]:` に記入してください。

---

## Q1. 機能要件の粒度

要件書に載せる機能の切り方は？

- A. proto-Units（U1–U6）に対応する FR 群（Snapshot / Reader+i18n / Deep link / Bridge / Translate PR / Diff report）
- B. ユーザー成果ベース（開く・読む・切替・着地・誘導・運用）に整理し、Unit 対応は後段
- C. A を主とし、各 FR に受入可能な Given/When/Then を付ける
- X. その他（具体的に記入）

[Answer]: A

## Q2. 未訳ページの受入（S-docs-1）

wireframes 確定どおり、locale=ja で未訳のとき必須の挙動は？

- A. en 本文 + 可視 notice（「日本語訳はまだありません」）+ locale コントロールは ja のまま — これを FR の受入条件にする
- B. A に加え、TOC の未訳印も Must
- C. notice なしで en を静かに出す（wireframes より緩和）
- X. その他（具体的に記入）

[Answer]: A

## Q3. sourceVersion の表示

同梱 upstream 版の表示要件は？

- A. Docs Shell ヘッダに `sourceVersion` を常時表示（Must）
- B. 設定／About 相当でのみ見せればよい（Should）
- C. 初期はログ／マニフェストのみで UI 必須にしない
- X. その他（具体的に記入）

[Answer]: A

## Q4. Diff report（Should / U6）の要件化

- A. 初期要件に FR として書き、優先度 Should と明記（切り下げ可）
- B. 初期要件書からは外し、後続 intent / backlog メモのみ
- C. Must に格上げ（scope を変更）
- X. その他（具体的に記入）

[Answer]: A

## Q5. NFR の初期セット

requirements.md に今書く NFR はどれですか？（複数可）

- A. オフライン可読（実行時 fetch なし）
- B. パス containment（guardPath + 否定テスト）
- C. Locale resolver の branch coverage 95%
- D. クロスプラットフォーム（Windows Git Bash + macOS）
- E. VSIX サイズ上限（数値）— practices では NFR 延期だが要件にプレースホルダを置く
- F. A–D を Must、E は「後段で数値化」と明記
- X. その他（具体的に記入）

[Answer]: F

## Q6. Bridge 縮退の受入

旧抜粋 UI の Must 条件は？

- A. 抜粋本文を出さず、同梱 Docs への誘導（Open in Docs）が主操作になる
- B. 抜粋は残してよいが、先頭に同梱 Docs への目立つ導線があればよい
- C. bridge-map ナビ／用語だけ残し、抜粋 UI は削除
- X. その他（具体的に記入）

[Answer]: A

---

## Consolidated Summary Confirmation

要件アーティファクト生成前の確認です。以下で合っていますか？

| Q   | 回答 | 要約                                                 |
| --- | ---- | ---------------------------------------------------- |
| Q1  | A    | FR は proto-Units U1–U6 対応                         |
| Q2  | A    | 未訳: en 本文 + 可視 notice + locale=ja 維持         |
| Q3  | A    | sourceVersion を Docs Shell ヘッダに常時表示（Must） |
| Q4  | A    | Diff report は FR・優先度 Should（切り下げ可）       |
| Q5  | F    | NFR A–D Must、VSIX サイズは後段で数値化と明記        |
| Q6  | A    | Bridge: 抜粋なし、Open in Docs 誘導が主操作          |

Does this all look correct before I generate the requirements artifact?

- Looks correct: この要約で `requirements.md` を生成する
- Request changes: 生成前に回答を修正する

[Answer]: Looks correct

---

## Q7. Learnings (§13)

どれを `project.md` に残しますか？

- A. c1 — requirements 質問は未固定の受入（未訳・version・diff・NFR・Bridge）に絞る
- B. c2 — deep-link 契約・manifest・anchor fallback・stage slug 列挙を FR に固定して READY にした
- C. None
- X. その他

[Answer]: C

## Q8. Anything to add for next time?

- A. Nothing to add
- B. Add a note（具体的に記入）
- X. その他

[Answer]: A
