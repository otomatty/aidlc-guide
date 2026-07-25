# Units Generation — 質問ファイル

> ステージ: units-generation (Inception 2.7) / 深度: Standard / lead: architect + delivery support
> 入力: application-design 5成果物 + requirements.md + stories.md + intent-backlog.md（proto-Unit PU-01〜13）
> 本ステージはトポロジー（何が何に依存できるか）のみを決める。実装順・クリティカルパスは 2.8 delivery-planning の判断。質問は Unit 境界の4点。各質問 A-E + X。

---

## Q1. Unit 境界の基本戦略

application-design の7パッケージ（bun workspaces）が物理境界。Unit の切り方は？

- A. パッケージ整合（1パッケージ ≒ 1 Unit を基本に、UI 内の大きな塊は分割）— 推奨（パッケージ境界 = ワークツリー分離しやすい・依存が package.json と一致）
- B. 機能グループ整合（F-01〜F-08 をそのまま Unit に）
- C. マイルストーン整合（M1〜M4 の4 Unit）
- X. その他（記入）

[Answer]: A（パッケージ整合、UI内の大きな塊は分割 / Mode: batch-recommended）

## Q2. shared-types の扱い

型のみの最下層パッケージ。独立 Unit にする？

- A. reader-core Unit に同梱（型は reader-core と同時に生まれる。独立 Unit にするほどの作業量がない）— 推奨
- B. 独立 Unit（全 Unit の前提として最初に固める）
- X. その他（記入）

[Answer]: A（shared-types は reader-core Unit に同梱 / Mode: batch-recommended）

## Q3. WYSIWYG ビューア（Milkdown リスク）の Unit 分割

M3 の Milkdown 検証リスク（feasibility R-2）を隔離する切り方は？

- A. `artifact-viewer` を dashboard-ui から独立した Unit にする（Milkdown 検証・交代の影響を1 Unit に閉じる。ADR-05 の隔離と一致）。回答記入（answer-editing）も同 Unit 内の後続作業 — 推奨
- B. dashboard-ui Unit に含める（Unit 数削減）
- C. viewer と answer-editing を別々の Unit に（PU-10/PU-11 どおり）
- X. その他（記入）

[Answer]: A（artifact-viewer を独立 Unit に。answer-editing は同 Unit 内後続 / Mode: batch-recommended）

## Q4. Mob モードの Unit 化

FR-7 は server（bind/broadcast/403）と UI（参加者ビュー）にまたがる。どう切る？

- A. `mob-mode` を独立 Unit にし、dashboard-server と dashboard-ui に依存させる（LAN 公開・警告・参加者 read-only を一体で検証できる）— 推奨
- B. server 側は dashboard-server Unit、UI 側は dashboard-ui Unit に分散
- X. その他（記入）

[Answer]: A（mob-mode を独立 Unit にし dashboard-server / dashboard-ui に依存 / Mode: batch-recommended）

---

## Consolidated Summary Confirmation

- Q1: A — パッケージ整合
- Q2: A — reader-core に同梱
- Q3: A — artifact-viewer 独立（answer-editing 含む）
- Q4: A — mob-mode 独立

Does this look correct before I present the decomposition plan?

- Looks correct: この方針で分解プランを提示する
- Request changes: 方針を修正する

[Answer]: Looks correct（2026-07-23 / Mode: batch-recommended）

---

## §13 Learnings（回答済み — 2026-07-23）

- A. c1: 統合時のエッジ持ち上げ
- B. c2: build-time依存の別チャネル運搬
- D. 残さない

[Answer]: D（残さない — memory.md ダイアリーに保持）

追加メモ（Anything to add for next time?）: Nothing to add

[Answer]: Nothing to add
