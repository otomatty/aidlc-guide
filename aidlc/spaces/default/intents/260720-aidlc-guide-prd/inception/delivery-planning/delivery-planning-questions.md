# Delivery Planning — 質問ファイル

> ステージ: delivery-planning (Inception 2.8) / 深度: Standard / lead: delivery + architect support
> 入力: unit-of-work.md（9 Unit）+ unit-of-work-dependency.md（DAG）+ unit-of-work-story-map.md + requirements.md + stories.md + mockups.md + components.md + team-practices.md
> 確定済み前提: 骨格 ON・スライス=「state 1枚読取 → Now strip 1画面」（team.md）/ 全機能 Must・依存順 M1→M4（scope）/ team-formation SKIP → 全 Bolt は aidlc-developer-agent。質問は経済順序の4点。各質問 A-E + X。

---

## Q1. 順序ヒューリスティック

DAG（2.7）上の経路をどう選ぶ？

- A. walking-skeleton-first + 依存順（Bolt 1 = 骨格スライス、以降は DAG の依存順 = 確定済み M1→M4 と一致）。WSJF スコアリングは不使用 — 全 Must で切り下げ非想定のため価値の差別化が無く、順序は依存とリスク（Milkdown は M3 冒頭検証）で既に決まっている — 推奨
- B. WSJF スコアリングで再評価する
- C. リスク先行（Milkdown 検証を M1 直後に前倒し）
- X. その他（記入）

[Answer]: A（walking-skeleton-first + 依存順。WSJF不使用 — 全Mustで順序は依存とリスクで既決 / Mode: batch-recommended）

## Q2. Bolt 粒度（9 Unit をいくつの Bolt に束ねるか）

- A. 7 Bolt — B1 骨格（U1/U5/U6 の薄いスライス）→ B2 reader-core 完成 → B3 docs-bridge + mcp-server（M1完）→ B4 dashboard-server + dashboard-ui 完成（M2核）→ B5 btw → B6 artifact-viewer（M3）→ B7 mob-mode + ops-guides（M4）。小さな Unit は同マイルストーンで束ねゲート数を抑制 — 推奨
- B. 10 Bolt（骨格 + 1 Unit = 1 Bolt。ゲート最多・追跡最細）
- C. 5 Bolt（骨格 + M1〜M4 の4 Bolt。粗い）
- X. その他（記入）

[Answer]: A（7 Bolt: 骨格→reader-core→docs-bridge+mcp→dashboard核→btw→viewer→mob+guides / Mode: batch-recommended）

## Q3. Bolt の並行実行

- A. 直列パイプライン基本。例外として B5 btw（完全独立 Unit）のみ B4 と並行可能とマーク（AI 単独モブ・ゲート簡潔さ優先。並行の判断は Construction 時の autonomy モードに従う）— 推奨
- B. 依存が許す限り積極並行（B3/B4/B5 を同時など）
- C. 完全直列（並行なし）
- X. その他（記入）

[Answer]: A（直列基本、B5 btw のみ B4 と並行可能マーク / Mode: batch-recommended）

## Q4. Construction の設計イテレーション（unit-major / stage-major）

Bolt が unit-at-a-time（骨格先行）のため、設計ステージ（3.1〜3.3）の回し方を選ぶ。

- A. unit-major — 1 Unit の設計文書（functional/nfr-req/nfr-design）を連続して書き、次の Unit へ。Bolt 粒度と設計の一貫性が揃う（stage ファイルの「unit-at-a-time プランは典型的に unit-major」に該当）。ゲート数は不変（各ステージ1回、最後にカスケード）— 推奨
- B. stage-major（既定）— 各設計ステージを全 Unit 分回してから次ステージへ
- X. その他（記入）

[Answer]: A（unit-major — Bolt粒度と設計一貫性を揃える / Mode: batch-recommended）

## Q5. 外部依存（gated items）

ローカル完結だが、次の外部項目がある。マップに載せるのは？（複数選択可）

- A. 以下3点すべて — 推奨: ①tb-lxp フィクスチャ（別リポジトリ、要clone・コミットピン。B2 のゴールデンテストと 4.6 性能検証をブロック）②公式 docs リポジトリのローカル clone（B3 docs-bridge の解決先。パスは設定で指定）③Claude Code CLI の存在（B5 btw の前提。バージョン差で fork 挙動が変わり得る）
- B. ①のみ（テスト系のみ管理）
- C. 外部依存なしとして扱う
- X. その他（記入）

[Answer]: A（tb-lxpフィクスチャ・docsリポジトリclone・Claude Code CLI の3点 / Mode: batch-recommended）

---

## Consolidated Summary Confirmation

- Q1: A — 骨格先行+依存順（WSJF不使用）
- Q2: A — 7 Bolt
- Q3: A — 直列+btw並行可
- Q4: A — unit-major
- Q5: A — 外部依存3点

Does this look correct before I generate the 4 delivery artifacts + phase-boundary verification?

- Looks correct: この方針で成果物を生成する
- Request changes: 方針を修正する

[Answer]: Looks correct（2026-07-23 / Mode: batch-recommended）

---

## §13 Learnings（回答済み — 2026-07-23）

- A. c1: WSJF不使用の基準 / B. c2: Bolt束ね基準 / C. c3: unit-major選択 / D. 残さない

[Answer]: D（残さない — memory.md ダイアリーに保持）

追加メモ（Anything to add for next time?）: Nothing to add

[Answer]: Nothing to add
