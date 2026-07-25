# Requirements Analysis — 質問ファイル

> ステージ: requirements-analysis (Inception 2.3) / 深度: Standard
> 入力: intent-statement.md + scope-document.md + team-practices.md + PRD §5(FR)/§6(NFR)/§10(成功指標)
> PRD が FR-1.1〜FR-8.2 / NFR-1〜NFR-7 を詳細に定義済みのため、質問は「テスト可能な受入基準への落とし込み」で曖昧さが残る5点に絞ります。各質問 A-E + X。

---

## Q1. S-1 北極星「1分以内に現在地を説明」を、どうテスト可能な受入基準にするか

定性的な北極星（S-1）を検証可能な要件にしたい。どの操作可能な基準を採用しますか？

- A. 「Now strip 単体で phase/stage/unit/gate/完了数が読め、かつ現在ステージカードを1クリックで『次のステージ・そこで求められること』が表示される」= 情報到達性を基準にする（時間計測はモブ後アンケートで別途）— 推奨
- B. 実測1分以内をCIで自動計測（初学者代理スクリプトで到達時間を測る）
- C. 定性のまま（受入基準にせず、アンケートのみ）
- X. その他（記入）

[Answer]: A（Now strip単体でphase/stage/unit/gate/完了数が読め、現在ステージカード1クリックで次ステージ・求められることを表示。到達性を基準、時間はアンケートで別途 / Mode: batch-recommended）

## Q2. aidlc-reader が第一級で扱うべき失敗・エッジケース（複数選択可）

NFR-6（解析不可フォールバック）を要件化するにあたり、必ず要件として明記する失敗モードは？

- A. 以下すべて — 推奨: ①アクティブインテント未解決 ②複数インテント列挙 ③state パース不能（State Version不一致）④成果物の部分欠落（ユニット×ステージの穴）⑤監査シャード読取不能
- B. ①②③のみ（インテント解決とstate読取を優先、成果物欠落は後続）
- C. ③のみ（解析不可フォールバックの1点に集中）
- X. その他（記入）

[Answer]: A（①未解決②複数列挙③パース不能④部分欠落⑤監査読取不能 の全失敗モードを第一級要件化 / Mode: batch-recommended）

## Q3. MCP explain_stage / glossary の情報源

FR-2.2/FR-2.5 は「docs から要約して返す」。実装上の情報源は？

- A. docs-bridge の静的 slug→docs 対応表 + 対象 docs ファイルの該当節を読んで返す（対応表が単一所有、AI要約はしない=スコープ外§8）— 推奨
- B. AI がその場で docs を要約して返す（§8「AI自動要約」はスコープ外なので不可）
- C. 対応表のリンクのみ返す（本文は返さない）
- X. その他（記入）

[Answer]: A（docs-bridge静的対応表+該当節読取。AI要約はしない=§8スコープ外 / Mode: batch-recommended）

## Q4. 性能要件（NFR-2/NFR-3）の測定条件の明確化

受入基準として測定条件を固定します。どれを採用しますか？

- A. NFR-2=コールドスタート（プロセス起動→Dashboard初回描画）3秒以内 @ tb-lxp(約593ファイル) / NFR-3=単一ファイル変更→ビュー反映2秒以内 @ 同フィクスチャ。performance-validation で計測 — 推奨
- B. ウォームスタートも別途基準を設ける
- C. 目標値は据え置き、測定条件は performance-validation で決める
- X. その他（記入）

[Answer]: A（NFR-2=コールドスタート3秒@tb-lxp / NFR-3=単一ファイル変更→反映2秒@同fixture、performance-validationで計測 / Mode: batch-recommended）

## Q5. 質問ファイル回答記入（FR-6.2）の書き込み境界の要件

唯一の書き込み機能。要件としての制御方式は？

- A. ファイル名パターン（`*-questions.md`）+ 対象は Answer タグ行のみに限定。他ファイル・他行への書き込みは要件レベルで禁止（NFR-1/Forbidden整合）— 推奨
- B. `*-questions.md` 全体を編集可能にする（Answer 以外も）
- C. パス許可リストを設定ファイルで指定可能にする
- X. その他（記入）

[Answer]: A（*-questions.md の Answer タグ行のみ書込可、他は要件レベルで禁止 / Mode: batch-recommended）

---

## Consolidated Summary Confirmation

全回答の要約を提示し、requirements.md 生成前の確認を求める。

- Q1: A — 到達性基準（Now strip + 1クリックカード）、時間はアンケートで別途
- Q2: A — 5失敗モード全て第一級要件化
- Q3: A — docs-bridge静的対応表 + 該当節読取（AI要約なし）
- Q4: A — コールド3秒 / 反映2秒 @ tb-lxp、performance-validationで計測
- Q5: A — *-questions.md の Answer 行のみ書込可

Does this all look correct before I generate the requirements artifact?

- Looks correct: この回答から requirements.md を生成する
- Request changes: 生成前に回答を修正する

[Answer]: Looks correct（2026-07-22 / Mode: batch-recommended — ユーザーが推奨一括を選択）


---

## §13 Learnings（回答済み — 2026-07-22）

- A. c1: S-1 到達性基準（Now strip単体+1クリック次ステップ）
- B. c2: WYSIWYG合否は tb-lxp 実データチェックリスト
- D. 残さない

[Answer]: A（c1のみ — project.md ## Decided へ永続化。c2 は memory.md 保持）

追加メモ（Anything to add for next time?）: Nothing to add

[Answer]: Nothing to add
