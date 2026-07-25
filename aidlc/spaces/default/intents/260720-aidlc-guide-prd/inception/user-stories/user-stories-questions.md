# User Stories — 質問ファイル（Story Plan）

> ステージ: user-stories (Inception 2.4) / 深度: Standard / mob elaboration
> 入力: requirements.md（FR 8グループ+NFR7）+ intent-statement.md（3ペルソナ均等）+ team-practices.md
> ペルソナは intent-statement で確定済み（初学者/ドライバー/モブ参加者）のため、質問は「分割方針・粒度・優先度の扱い」に絞ります。各質問 A-E + X。

---

## Q1. ストーリーの分割方針（breakdown approach）

FR は機能グループ（F-01〜F-08）で整理済み。ストーリーはどの軸で切りますか？

- A. ペルソナ × 主要ジョブ を主軸に、各ストーリーを FR にトレースする（3ペルソナ均等の方針と整合、価値視点が明確）— 推奨
- B. 機能グループ（F-01〜F-08）ごとにストーリー化（FRと1:1で機械的）
- C. マイルストーン（M1〜M4）ごとにまとめる
- X. その他（記入）

[Answer]: A（ペルソナ×主要ジョブを主軸、各ストーリーをFRにトレース / Mode: batch-recommended）

## Q2. ストーリーの粒度（granularity）

INVEST の "Small" と網羅性のバランス。どの粒度を狙いますか？

- A. 中粒度: 1ペルソナの1ジョブ = 1ストーリー（例「初学者として現在地を把握したい」）。目安 12〜18 ストーリー — 推奨
- B. 細粒度: FR ごとに1ストーリー（目安 30+）。網羅的だが冗長
- C. 粗粒度: エピック級（ペルソナごと数本）。目安 6〜9
- X. その他（記入）

[Answer]: A（中粒度: 1ペルソナ1ジョブ=1ストーリー、目安12〜18 / Mode: batch-recommended）

## Q3. MoSCoW 優先度の扱い

scope-document で全機能 Must 確定（切り下げ非想定）。ストーリー優先度はどう付けますか？

- A. 全ストーリー Must Have としつつ、Must 内の実装順を依存順（M1→M4）で示す（delivery-planning が MVP 境界を正式決定）— 推奨
- B. ストーリーごとに MoSCoW を再評価（Must/Should 混在を許す）
- C. 優先度は付けず順序のみ
- X. その他（記入）

[Answer]: A（全ストーリーMust Have、Must内実装順は依存順M1→M4、MVP境界はdelivery-planningで正式決定 / Mode: batch-recommended）

---

## Consolidated Summary Confirmation

- Q1: A — ペルソナ×ジョブ主軸、FRトレース
- Q2: A — 中粒度（1ペルソナ1ジョブ、12〜18本）
- Q3: A — 全Must、Must内は依存順M1→M4

Does this look correct before I draft personas and stories (then run the mob)?

- Looks correct: この方針でドラフト → mob elaboration へ
- Request changes: 方針を修正する

[Answer]: Looks correct（2026-07-22 / Mode: batch-recommended — ユーザーが推奨一括を選択）

---

## §13 Learnings（回答済み — 2026-07-23）

- A. c1: mobエスカレーションの線引き
- B. c2: 網羅性優先の粒度拡張
- D. 残さない

[Answer]: D（残さない — memory.md ダイアリーに保持、project.md 昇格なし）

追加メモ（Anything to add for next time?）: Nothing to add

[Answer]: Nothing to add
