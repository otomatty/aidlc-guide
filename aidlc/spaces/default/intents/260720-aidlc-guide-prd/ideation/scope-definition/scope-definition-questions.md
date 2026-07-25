# Scope Definition — 質問ファイル

> ステージ: scope-definition (Ideation 1.4) / 深度: Standard
> 入力: intent-statement.md（M1〜M4全実装が確定）+ feasibility-assessment.md + constraint-register.md + PRD §5, §8-§9
> 実装範囲（M1〜M4）とスコープ外リスト（PRD §8）は確定済みのため、質問は境界の微調整・優先度・切り下げ時の保護範囲に絞っています。

---

## Q1. 機能グループのMoSCoW分類

PRD の機能 F-01〜F-08 はすべて M1〜M4 に割り当て済みですが、万一の切り下げ判断に備えて優先度を明確化します。どの分類が実態に合いますか？

- A. F-01〜F-06 = Must / F-07 Mob モード・F-08 運用ガイド = Should（コア閲覧体験を優先保護）
- B. F-01〜F-05 = Must / F-06 WYSIWYG・F-07・F-08 = Should（ビューアは plain preview でも代替可のため）
- C. すべて Must（切り下げは想定しない）
- D. F-01〜F-02 のみ Must（MCP で最小価値）/ 残りは Should 以下
- X. その他（具体的に記入）

[Answer]: C（すべて Must — 当初 A を選択したが、Q6 フォローアップで Q2「M4まで価値不可分」との矛盾を解消するため C に修正。切り下げは想定しない）

## Q2. 最小価値スコープ（MVP境界）

「これだけ出せば価値がある」最小境界はどこですか？（S-1北極星の達成に必要な範囲）

- A. M1 完了時点（MCP サーバーでサイドセッションから現在地・ステージ解説が得られる）
- B. M2 完了時点（Dashboard の Now strip + Stage rail で視覚的に現在地がわかる）
- C. M3 完了時点（成果物も読めて初めて価値と言える）
- D. M4 完了まで価値は語れない
- X. その他（具体的に記入）

[Answer]: D（M4完了まで不可分 — 全機能そろって初めて完全な価値。Q6で整合確認済み）

## Q3. 実装順序の方針

M1→M4 のマイルストーン順は基盤先行（aidlc-reader → 各サーフェス）の依存順です。この順序方針を確認します。

- A. 依存順（dependency-first）— PRD のマイルストーン順のまま。基盤の aidlc-reader を最初に固める
- B. リスク先行（risk-first）— Milkdown 等の不確実要素を先に検証する順に組み替える
- C. 価値先行（value-first）— S-1 に直結する Dashboard を最優先で出す順に組み替える
- X. その他（具体的に記入）

[Answer]: A（依存順 — PRDのマイルストーン順のまま。aidlc-readerを最初に固める）

## Q4. 質問ファイル回答機能（FR-6.2）の位置づけ

唯一の書き込み機能（`*-questions.md` の `[Answer]:` 記入）は M3 に含まれます。優先度は？

- A. Must — M3 の完了条件に含める（PRD どおり）
- B. Should — WYSIWYG 閲覧が優先。回答記入は M3 内で余力があれば
- C. Could — 初回リリース後の改善候補に回してよい
- X. その他（具体的に記入）

[Answer]: B（Should — WYSIWYG閲覧が優先。回答記入はM3内で余力があれば。※機能グループF-06自体はMust（Q6整合後）だが、F-06内部の優先順として閲覧 > 回答記入）

## Q5. バックログの粒度（proto-Unit の切り方）

Inception の Units Generation に渡すバックログの単位をどう切りますか？

- A. 機能グループ単位（F-01〜F-08 の8項目をそのまま proto-Unit とする）
- B. マイルストーン単位（M1〜M4 の4項目に集約する）
- C. 機能グループ基準 + 大きいものは分割（例: F-04 Dashboard を Now strip / Stage rail / マトリクスに分割）— 推奨
- X. その他（具体的に記入）

[Answer]: C（機能グループ基準 + 大きいものは分割）

## Q6.（フォローアップ）Q1とQ2の整合

Q1 の回答「F-07/F-08 は Should（切り下げ候補）」と Q2 の回答「M4 完了まで価値は不可分」は矛盾する可能性があります。F-07（Mobモード）は M4 の中核であり、切り下げ候補でありながら価値の必須要素でもあることになります。どう整合させますか？

- A. 両立と解釈する — 「完全な価値は M4 で実現」だが、万一の切り下げ時は F-07/F-08 を犠牲にする（Q1・Q2 とも維持。Must部分= F-01〜F-06 が守るべき下限）
- B. Q2 を修正する — 実質的な MVP 境界はもっと手前（例: M2 or M3）にある
- C. Q1 を修正する — すべて Must とし、切り下げ自体を想定しない
- X. その他（具体的に記入）

[Answer]: C（Q1をすべてMustに修正。切り下げは想定しない）

---

## Consolidated Summary Confirmation

全回答の要約を提示し、アーティファクト生成前の確認を求める。

- Q1: C — F-01〜F-08 すべて Must（Q6フォローアップで A から修正）
- Q2: D — M4完了まで価値は不可分
- Q3: A — 依存順（PRDのマイルストーン順 M1→M4）
- Q4: B — FR-6.2 の回答記入は F-06 内部の優先順で Should（閲覧が先）
- Q5: C — proto-Unit は機能グループ基準 + 大きいもの（F-04等）は分割
- Q6: C — Q1/Q2矛盾は「すべてMust」への修正で解消

選択肢:
- Looks correct: この回答からアーティファクトを生成する
- Request changes: 生成前に回答を修正する

[Answer]: Looks correct（2026-07-21 / Mode: guided）

---

## §13 Learnings（回答済み — 2026-07-21）

今回のステージの観察から、永続プラクティスとして project.md に残すものは？（複数選択可）

- A. c1: Q1/Q2矛盾をフォローアップで解消し全Must化した決定の記録
- B. c2: F-06は閲覧＞回答記入の内部優先順
- C. c3: docs対応表はdocs-bridgeが単一所有し、MCP/Dashboardは参照のみ
- D. 残さない（ダイアリーには残る）
- X. その他（自由記述メモを追加）

[Answer]: A（c1のみ — 全Must化の決定を project.md の ## Decided に永続化。c2/c3 は memory.md ダイアリーに保持）

追加メモ（Anything to add for next time?）: Nothing to add / Add a note（内容を記入）

[Answer]: Nothing to add
