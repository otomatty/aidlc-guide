# Practices Discovery — 質問ファイル

> ステージ: practices-discovery (Inception 2.2) / 深度: Standard / Greenfield
> 入力: org.md（既定プラクティスの提案元）+ 3サポートレビュー（quality/developer/devsecops の contribution）+ constraint-register.md
> これらの回答は team.md（5セクション）と project.md（Mandated/Forbidden）に昇格されます。org.md の既定を提案として提示し、ローカル専用ツール向けに調整済みです。各質問 A-E + X(その他)。

---

## Q1. Way of Working（開発の進め方）

org.md 既定: trunk-based development、短命フィーチャーブランチ、Bolt は squash-merge で main へ。ローカル専用ツールでもこの方針は妥当か？

- A. org.md 既定どおり（trunk-based + squash-merge Bolt）を team практиスとして確定 — 推奨
- B. trunk-based だが Bolt は通常 merge（履歴を残す）
- C. その他の分岐戦略
- X. その他（記入）

[Answer]: A（org.md 既定どおり / Mode: guided）

## Q2. Walking Skeleton（歩く骨格の最初のスライス）

スコープは `skeleton: on`（最初の Bolt で最薄のエンドツーエンドを通す）。lead 提案スライス:「1つの state ファイルを読む → Dashboard 1画面を描画」。これで aidlc-reader→Dashboard の統合点を最小実証できる。

- A. 提案どおり「state 1ファイル読取 → Dashboard の Now strip 1枚描画」を最初の骨格に — 推奨
- B. MCP 経由の骨格（aidlc-reader → `aidlc_status` が実データを返す）を最初に（M1 基盤優先）
- C. reader-core のパース単体（UI なし、fixture 1件のパース実証）に絞る
- X. その他（記入）

[Answer]: A（state 1ファイル読取 → Dashboard Now strip 1枚描画 / Mode: guided）

## Q3. Testing Posture（テスト方針）※quality レビューの争点

org.md 既定は「80%ラインカバレッジ / CIで実行」。quality レビュー: パーサ（State Version 検知・不正入力・593ファイル規模）がリスク中心なので、フラットな行カバレッジより**パーサはブランチカバレッジ + fixture ゴールデンテスト**が要る。テストランナー未定（`bun test` はブランチカバレッジが弱い→ Vitest 検討）。どうする？（複数選択可）

- A. ランナー = Vitest（ブランチカバレッジ対応）。パーサ層はブランチ重視 + tb-lxp ゴールデン、UI層は行80%目安、Milkdown は実fixture表示検証 — 推奨
- B. ランナー = `bun test`（C-T1「bunのみ」に忠実）。カバレッジは行80%一律、パーサは手厚くゴールデン追加
- C. フラット 80% ラインカバレッジのまま（org.md 既定を変えない）
- X. その他（記入）

[Answer]: A（Vitest / パーサはブランチ重視+tb-lxpゴールデン、UIは行80%、Milkdownは実fixture表示検証。※Vitestはdev-time devDependencyでありC-T1「bunのみのランタイム」に抵触しない / Mode: guided）

## Q4. Deployment（配布・リリース）※local-only 前提

本ツールはクラウド・デプロイ先なし（project.md / scope）。lead 再定義:「デプロイ環境なし。『リリース』= main へ squash-merge or git タグ。CD パイプラインなし。検証は performance-validation の NFR-2/NFR-3（3秒起動 / 2秒反映、tb-lxp フィクスチャ）で代替」。

- A. この local-only 再定義を確定（環境・CD なし、リリース=タグ/merge、性能検証で代替）— 推奨
- B. さらに軽く（タグも切らず、main が常にリリース可能状態）
- C. その他
- X. その他（記入）

[Answer]: A（local-only 再定義: 環境・CDなし、リリース=タグ/merge、性能検証で代替 / Mode: guided）

## Q5. Code Style（コード規約）※developer レビューの争点

developer レビュー: フォーマッタは「Biome 単一（bun+TS で1ツール完結・lazy）」を推奨（"bunfmt" は実在せず不採用）。加えて「1ライブラリ・3サーフェス」の構造規約3点を骨格前にロックすべき — ①reader-core は UI/トランスポート非依存（一方向依存）②State Version パーサは単一の差し替え可能モジュールに隔離（NFR-6）③パース境界は throw でなく型付き Result で「解析不可」を表現。どうする？（複数選択可）

- A. フォーマッタ = Biome 単一 + 構造規約3点（reader-core非依存 / パーサ隔離 / 型付きResult）を team 規約に確定 — 推奨
- B. フォーマッタ = Prettier + ESLint（React エコシステム標準）+ 構造規約3点は確定
- C. フォーマッタは後決め、構造規約3点のみ確定
- X. その他（記入）

[Answer]: A（Biome 単一 + 構造規約3点: reader-core非依存/パーサ隔離/型付きResult / Mode: guided）

## Q6. Mandated / Forbidden（ハード制約）※devsecops レビュー

devsecops レビュー: セキュリティ面は小（ローカル読取専用・規制データなし C-R1）だが、次はハードルールにすべき。確定するものは？（複数選択可）

- A. 以下すべてを確定 — 推奨:
      NEVER: aidlc 配下・リポジトリへ書込（`*-questions.md` の `[Answer]:` のみ例外）/ クラウド・AWS依存の追加 / bun 以外のランタイム・DB導入
      ALWAYS: Mob の listen は既定 loopback、LAN公開は `--host` 明示時のみ + 公開警告表示 / bun lockfile をコミット・ピン + ローカルゲートで `bun audit`
- B. 書込禁止・bun専用・クラウド禁止のみ確定（ネットワーク/サプライチェーンは design 段階で扱う）
- C. 最小（読み取り専用の書込境界のみ）
- X. その他（記入）

[Answer]: A（全部確定: 書込禁止/クラウド禁止/bun専用 + Mob loopback既定・--host警告 + lockfileピン・bun audit / Mode: guided）

---

## Consolidated Summary Confirmation

全回答の要約を提示し、team.md/project.md への昇格前に確認を求める。

- Q1: A — trunk-based + Bolt squash-merge
- Q2: A — state 1ファイル読取 → Dashboard Now strip 1枚
- Q3: A — Vitest / パーサはブランチ+tb-lxpゴールデン、UI行80%、Milkdown実fixture検証
- Q4: A — local-only（環境・CDなし、リリース=タグ/merge、性能検証で代替）
- Q5: A — Biome単一 + 構造規約3点（reader-core非依存/パーサ隔離/型付きResult）
- Q6: A — 書込禁止・クラウド禁止・bun専用 + Mob loopback既定/--host警告 + lockfileピン/bun audit

選択肢:
- Looks correct: この回答で成果物を統合し、承認ゲートへ
- Request changes: 生成前に回答を修正する

[Answer]: Looks correct（2026-07-22 / Mode: guided）

---

## §13 Learnings（回答済み — 2026-07-22）

practices の観察から project.md に残す解釈メモは？（プラクティス本体はゲートで昇格済み）

- A. c1: Vitest 等 dev-time devDependency は C-T1 に非抵触
- B. c2: Deployment を local-only 再定義した根拠
- C. c3: 構造規約3点（team.md 昇格に含むため重複回避で非選択）
- D. 残さない
- X. その他

[Answer]: A, B（c1・c2 を project.md の ## Decided に永続化。c3 は practices 昇格側に含む）

追加メモ（Anything to add for next time?）: Nothing to add / Add a note

[Answer]: Nothing to add
