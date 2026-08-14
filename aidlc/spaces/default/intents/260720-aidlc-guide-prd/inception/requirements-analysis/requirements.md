# Requirements — AIDLC Guide

> ステージ: requirements-analysis (Inception 2.3) / 作成日: 2026-07-22 / 深度: Standard
> 入力: intent-statement.md（3ペルソナ・S-1北極星）+ scope-document.md（F-01〜F-08 全Must・依存順M1→M4）+ team-practices.md（Vitest/パーサブランチ・local-only・Biome+構造3規約・書込境界）+ PRD §5/§6/§10
> 受入基準は inception フェーズ規約に従い Given/When/Then（BDD）形式。各要件はテスト可能な pass/fail 基準を持つ。曖昧語は使わない。
> トレーサビリティ: 各 FR/NFR は PRD の FR-x.y / NFR-x と scope-document の機能グループ（F-01〜F-08）に対応。

## Intent Analysis（達成したいこと）

aidlc-workflows の経験が浅いエンジニアでも、**現在地と今後のステージを迷わず理解でき**、成果物を**読みやすく閲覧・共有できる**ローカル読み取り専用ツール（intent-statement / PRD §2）。北極星は S-1（初学者が現在地・次ステージ・求められることをツールだけで把握できる）。3ペルソナ（初学者 / ドライバー / モブ参加者）を均等に扱い、M1→M4 の依存順で価値を届ける。

「機能を作る」ではなく「初学者のオンボーディング負荷を下げ、本線セッションの文脈汚染を減らす」ことがゴール。

## Functional Requirements

要件は機能グループ（F-01〜F-08）ごとに整理。ID は `FR-<group>.<n>`。各要件に受入基準（AC）を付す。

### FR-1: aidlc-reader（状態モデルライブラリ / F-01, M1）

- **FR-1.1 state パース**: `aidlc-state.md` をパースし、フェーズ/ステージ進捗（EXECUTE・SKIP・完了・進行中・ゲート待ち）・スコープ・ユニット情報を型付きモデルで提供する。
  - **AC**: *Given* State Version 8 の有効な `aidlc-state.md`, *When* reader がパースする, *Then* phase・current stage・各ステージの状態（[ ]/[-]/[?]/[x]/[S]）・scope・depth・完了数を型付きオブジェクトで返す。
- **FR-1.2 成果物ツリー走査**: インテント記録配下を走査し、ユニット×ステージ×成果物種別のマトリクスを構築する。
  - **AC**: *Given* construction 配下にユニット別成果物がある記録, *When* reader が走査する, *Then* 各セル（ユニット×ステージ）の成果物有無・件数・レビュー verdict（READY/NOT-READY/なし）を返す。
- **FR-1.3 監査イベント抽出**: 監査シャード（`<record>/audit/`）から直近イベント（ステージ開始/完了/ゲート/レビュー verdict）を抽出する。
  - **AC**: *Given* 監査シャードが存在する, *When* reader が直近 N 件を要求する, *Then* 時系列順のイベント（種別・stage・timestamp）を返す。
- **FR-1.4 インテント解決**: アクティブインテント（`active-intent` カーソル）を解決し、複数インテントを列挙する。
  - **AC**: *Given* `active-intent` カーソルが指すインテント, *When* reader が解決する, *Then* そのインテントを返す。*Given* カーソルが無い/壊れている, *Then* 全インテントを列挙し「未解決」を示す（→ FR-1.6）。
- **FR-1.5 ファイル監視**: state・construction 配下の変更を監視し、モデルを追従させる（chokidar）。
  - **AC**: *Given* reader が監視中, *When* 監視対象ファイルが変更される, *Then* モデルが再構築され変更通知が発火する（反映時間は NFR-3）。
- **FR-1.6 解析不可フォールバック（第一級要件・Q2）**: 次の失敗モードを局所的縮退で扱う — ①アクティブインテント未解決 ②複数インテント列挙 ③state パース不能（State Version 不一致）④成果物の部分欠落 ⑤監査シャード読取不能。
  - **AC**: *Given* 上記いずれかの失敗, *When* reader がその要素を処理する, *Then* 全体を落とさず該当要素のみ「解析不可（理由付き）」として返し、他の健全な要素は通常どおり返す（NFR-6 整合）。

### FR-2: MCP サーバー（F-02, M1）

5ツールすべて読み取り専用。stdio。`.mcp.json` 登録で本線・サイドセッション双方から利用可能。

- **FR-2.1 `aidlc_status`**: 現在のフェーズ/ステージ/ユニット/ゲート状態/完了数を返す。
  - **AC**: *Given* アクティブインテント, *When* `aidlc_status` 呼び出し, *Then* phase・stage・unit・gate 状態・完了数（例 15/22）を構造化して返す。
- **FR-2.2 `aidlc_explain_stage(slug)`**: ステージの目的・入出力・担当エージェントを docs から要約して返す（情報源 = docs-bridge 静的対応表 + 該当節読取。AI 自動要約はしない=§8 — Q3）。
  - **AC**: *Given* 有効な stage slug, *When* 呼び出し, *Then* 対応表が示す docs 該当節の内容と担当エージェント・入出力を返す。*Given* 未知の slug, *Then* 「該当なし」を返す。
- **FR-2.3 `aidlc_next_steps`**: 次に来るステージと、そこで人間に求められること（ゲート/質問）を返す。
  - **AC**: *Given* 現在ステージ, *When* 呼び出し, *Then* 次の in-scope ステージ名とそのゲート/求められる人間アクションを返す。
- **FR-2.4 `aidlc_read_artifact(path)`**: インテント配下の成果物本文を返す（記録ディレクトリ配下に限定）。
  - **AC**: *Given* 記録配下の成果物パス, *When* 呼び出し, *Then* 本文を返す。*Given* 記録外パス, *Then* 拒否する（読み取り境界）。
- **FR-2.5 `aidlc_glossary(term)`**: Bolt/gate/unit 等の用語を docs から引いて返す（情報源は FR-2.2 と同じ対応表）。
  - **AC**: *Given* 既知の用語, *When* 呼び出し, *Then* docs 由来の定義を返す。*Given* 未知の用語, *Then* 「未定義」を返す。

### FR-3: btw ラッパー（F-03, M2）

- **FR-3.1 `btw`**: 読み取り専用（`--permission-mode plan`）の独立 Claude Code セッションを新ターミナルに起動する。
  - **AC**: *Given* `btw` 実行, *When* 起動, *Then* plan モードのセッションが別ターミナルで開く。
- **FR-3.2 `btw --fork`**: 本線の文脈を引き継いだ分岐セッションを起動する（最新セッションID解決を隠蔽）。
  - **AC**: *Given* 本線セッションが存在, *When* `btw --fork`, *Then* 最新セッションIDを解決して fork 起動する。
- **FR-3.3 `btw -p "<質問>"`**: ヘッドレスのワンショット質問に応答する。
  - **AC**: *Given* `btw -p "<Q>"`, *When* 実行, *Then* ヘッドレスで回答を標準出力に返す。
- **FR-3.4 fork 制約の明記**: `--fork-session` の JSONL フラッシュ制約（本線実行中の直近会話が乗らないことがある）をヘルプ・docs に明記し、文脈必須時は本線内 `/branch` を第一案内する。
  - **AC**: *Given* `btw --help`, *When* 表示, *Then* fork 制約と `/branch` 代替案内が含まれる。

### FR-4: Dashboard（F-04, M2）

- **FR-4.1 Now strip**: フェーズ/現在ステージ/Depth/**ゲート状態**/完了数を常時表示（S-1 到達性基準 — Q1）。※「ユニット」は**削除**（2026-07-25 修正）: `aidlc-state.md` に現在ユニットを示すフィールドが存在せず、reader が返せる情報ではないため（Construction 中のユニットは監査ログ側の情報）。進行中ユニットの可視化は FR-4.3 の Unit×Stage マトリクスが担う。
  - **AC**: *Given* アクティブインテント, *When* Dashboard 表示, *Then* Now strip **単体で** phase・current stage・depth・**gate 状態（例: awaiting approval / なし）**・完了数（例 15/22）が他の操作なしに読める（プロミネンス最上位 — rough-mockups Q2）。この「Now strip 単体で現在地が読める」ことが S-1 の受入基準の第一要素（Q1）。
- **FR-4.2 Stage rail**: 実行対象ステージを一列表示し、状態を色+記号+ラベルで区別（完了/進行中/ゲート待ち/SKIP）。クリックで成果物・解説・docs へ遷移。
  - **AC**: *Given* Stage rail 表示, *When* 各ステージを見る, *Then* 状態が色に依存せず色+記号+ラベルで判別できる（project.md Code Style 規約）。*When* ステージをクリック, *Then* 右サイドパネルに解説/成果物が開く。
- **FR-4.3 Unit×Stage マトリクス**: 行=ユニット・列=Construction ステージ。セルに成果物有無・件数・レビュー verdict を表示。
  - **AC**: *Given* construction 成果物がある記録, *When* マトリクス表示, *Then* 各セルが件数と verdict（READY/NOT-READY）を表示し、空セルと対象外セルを区別する。
- **FR-4.4 ステージカード解説**: 各ステージに初学者向け解説（目的・入出力・担当エージェント・ゲートで求められること）を表示。
  - **AC**: *Given* ステージ選択, *When* カード表示, *Then* 目的・入出力・担当エージェント・ゲート要求を平易な言葉で表示し、docs deep-link を持つ。
- **FR-4.5 SKIP 折りたたみ**: SKIP ステージは折りたたみ、SKIP 理由（スコープ由来）を表示。
  - **AC**: *Given* SKIP ステージがある, *When* Dashboard 表示, *Then* SKIP は既定折りたたみ、展開で理由を表示する。
- **FR-4.6 現在ステージからの次ステップ導線（S-1 到達性基準・Q1）**: 現在ステージのカードは、1クリック（1操作）で「**次のステージ名**」と「**そこで人間に求められること**（ゲート/質問）」を表示する。
  - **AC**: *Given* Now strip が現在ステージを示している, *When* 現在ステージカードを1回開く（1クリック）, *Then* *次の* in-scope ステージ名と、そのステージで人間に求められること（ゲート種別/質問の有無）が表示される（クリックしたステージ自身の情報ではなく、次ステージの情報）。Now strip 単体の現在地表示（FR-4.1）と本要件の1クリック次ステップが揃って S-1 の受入基準を構成する（Q1。時間計測はモブ後アンケートで別途）。

### FR-5: Docs Bridge（F-05, M2）

- **FR-5.1 対応表の単一所有**: ステージ slug → 公式ドキュメント該当節への静的対応表を docs-bridge が単一所有し、Dashboard と MCP（FR-2.2/2.5）の両方が参照する。
  - **AC**: *Given* 対応表, *When* Dashboard と MCP が slug を引く, *Then* 同一の docs 該当節を返す（所有権は docs-bridge のみ、他は参照）。
- **FR-5.2 docs パス設定**: docs リポジトリの場所を設定ファイルで指定する（ローカル clone パス）。
  - **AC**: *Given* 設定に docs パス, *When* Docs Bridge 起動, *Then* そのパスから docs を解決する。
- **FR-5.3 プロジェクト固有リンク**: PRD/ADR/team practices へのリンク欄を設定で追加できる。
  - **AC**: *Given* 設定にプロジェクトリンク, *When* 表示, *Then* リンク欄に反映される。

### FR-6: WYSIWYG Markdown ビューア（F-06, M3）

内部優先順: WYSIWYG閲覧・Mermaid（FR-6.1/6.3）＞ 回答記入（FR-6.2）— scope Q4。

- **FR-6.1 WYSIWYG 表示**: 成果物 Markdown を WYSIWYG 表示する（第一候補 Milkdown/Crepe。M3 冒頭に実データ表示検証、崩れれば候補交代 — feasibility R-2）。
  - **AC（測定可能な合否）**: *Given* tb-lxp から抽出した検証フィクスチャ集合（GFM テーブル / Mermaid ブロック / ネストしたリスト / コードフェンス / 見出し階層 / インラインコード の各要素を含む代表 5 成果物）, *When* 各成果物をビューアで開く, *Then* 次のチェックリスト全項目を満たす（1項目でも不合格なら候補交代 — feasibility R-2）:
    1. GFM テーブルが列・行を保持して表として描画される（プレーンテキスト化しない）
    2. Mermaid ブロックが図としてレンダリングされる（FR-6.3）
    3. 見出し階層・ネストリスト・コードフェンスが原文の構造を保持する
    4. ソース Markdown ↔ 表示の往復で内容欠落・文字化けがない
    5. 表示から編集モード（read-only 既定）への切替でクラッシュしない
  - この5項目チェックは M3 冒頭で実 tb-lxp データに対して実施し、結果を記録する（合否は項目単位で pass/fail 判定）。
- **FR-6.2 回答記入（書込境界・Q5）**: 既定 read-only。書き込みは `*-questions.md` の `[Answer]:` タグ行のみ許可（ファイル名パターン + 対象行で制御）。
  - **AC**: *Given* `*-questions.md` を開く, *When* `[Answer]:` 行を編集し保存, *Then* その行のみ書き込まれる。*Given* `*-questions.md` 以外 or `[Answer]:` 以外の行, *When* 編集を試みる, *Then* 拒否される（NFR-1 / Forbidden 整合）。
- **FR-6.3 Mermaid レンダリング**: 成果物中の Mermaid 図をレンダリング表示する。
  - **AC**: *Given* Mermaid ブロックを含む成果物, *When* 表示, *Then* 図としてレンダリングされる（構文不正時はコードとして表示しクラッシュしない）。

### FR-7: Mob モード（F-07, M4）

- **FR-7.1 LAN 公開**: Dashboard を `--host` で LAN 公開でき、参加者はブラウザで閲覧できる（既定 localhost）。
  - **AC**: *Given* `dashboard --host`, *When* 起動, *Then* LAN バインドし公開警告を表示する。*Given* フラグなし, *Then* loopback のみバインド（Mandated 整合）。
- **FR-7.2 リアルタイム反映**: ファイル監視→WebSocket push でドライバーの状態変化（ステージ遷移・成果物生成）を参加者ビューに即時反映する。
  - **AC**: *Given* 参加者が接続中, *When* ドライバー側でファイルが変わる, *Then* 参加者ビューが反映される（反映時間は NFR-3）。
- **FR-7.3 参加者 read-only**: 参加者ビューは read-only 固定（編集UI・FR-6.2 の編集も無効）。
  - **AC**: *Given* 参加者ビュー, *When* 表示, *Then* 編集UIが DOM に存在せず、`[Answer]:` 編集も不可（rough-mockups S-3）。
- **FR-7.4 トンネル手順**: リモート参加のトンネル公開（cloudflared/Tailscale 等）は運用ガイドの手順として提供（ツール本体には組み込まない）。
  - **AC**: *Given* 運用ガイド, *When* 参照, *Then* トンネル手順と認証注意が記載されている（F-08 に属す）。

### FR-8: 運用ガイド（F-08, M4）

- **FR-8.1 Live Share 運用ガイド**: ワークスペース共有 + Claude Code ターミナルの read-only 共有手順・設定（`liveshare.autoShareTerminals` 等）・注意点。
  - **AC**: *Given* Live Share ガイド, *When* 手順どおり実施, *Then* ドライバーがワークスペース + read-only ターミナルを共有できる。
- **FR-8.2 非同期共有規約**: ゲート通過時に自動 `git push` するフック手順 + 参加者側の checkout 不要閲覧（`git fetch` + `git show origin/<branch>:<path>`）手順。
  - **AC**: *Given* 非同期共有ガイド, *When* 手順どおり実施, *Then* ゲート通過で push され、参加者が checkout 不要で成果物を閲覧できる。

## Non-Functional Requirements

- **NFR-1 読み取り専用原則**: FR-6.2 の質問ファイル書込を除き、aidlc 配下・リポジトリに書き込まない。
  - **AC**: *Given* 全サーフェス, *When* 任意操作, *Then* `*-questions.md` の `[Answer]:` 行以外への書き込みは発生しない（監査で検証）。
- **NFR-2 起動速度**: コールドスタート（プロセス起動→Dashboard 初回描画）3秒以内 @ tb-lxp（約593ファイル）。performance-validation で計測（Q4）。
  - **AC**: *Given* tb-lxp 記録, *When* Dashboard をコールド起動, *Then* 初回描画まで ≤3秒。
- **NFR-3 追従性**: 単一ファイル変更→ビュー反映 2秒以内 @ 同フィクスチャ（ローカル）。
  - **AC**: *Given* Dashboard 表示中, *When* 単一ファイルを変更, *Then* ビュー反映まで ≤2秒。
- **NFR-4 クロスプラットフォーム**: Windows（Git Bash 含む）と macOS で動作する。
  - **AC**: *Given* Windows/macOS, *When* 起動, *Then* パス処理・監視・プロセス起動が両OSで機能する。
- **NFR-5 依存最小**: 出荷ランタイムは bun のみ、DB 不要（ファイルシステムが唯一の真実のソース）。※Vitest 等 dev-time devDependency は本 NFR の対象外（project.md Decided）。
  - **AC**: *Given* 出荷物, *When* 実行, *Then* bun 以外のランタイム・DB を要求しない。
- **NFR-6 堅牢性**: パース不能な state/成果物があっても全体は落とさず、該当箇所を「解析不可」として表示する（FR-1.6 が実体）。
  - **AC**: *Given* 一部が壊れた記録, *When* 表示, *Then* 健全部分は表示され、壊れた箇所のみ「解析不可」表示。
- **NFR-7 セキュリティ**: Mob モードの listen は既定 localhost。LAN 公開は明示フラグ + 公開警告。トンネル公開時の認証は運用ガイドで注意喚起。
  - **AC**: *Given* Mob モード, *When* フラグなし起動, *Then* loopback のみ。*When* `--host`, *Then* LAN バインド + 警告表示。

## Constraints（constraint-register.md より）

- C-T1 出荷ランタイムは bun のみ・DB 禁止 / C-T2 読み取り専用（Answer 記入のみ例外）/ C-T3 現行 State Version 8（aidlc-workflows 2.6.2 / 33 ステージ）のみサポート / C-T4 Win+macOS / C-T5 fork JSONL フラッシュ制約は明記で受容 / C-T6 Mob listen 既定 localhost / C-T7 性能目標（NFR-2/3）。
- 組織: trunk-based + Bolt squash-merge、テストはコードと同時・パーサはブランチ重視、local-only（環境・CD なし）。
- 規制: 該当なし（社内ツール、PII/決済/医療非対象）。

## Assumptions

- PRD v0.1 は承認済みベースライン扱い（intent-capture Q1）。
- tb-lxp フィクスチャ（約593ファイル）は別リポジトリから clone 可能（feasibility A-2）。
- 期限制約なし・品質優先（M3 の Milkdown 交代が起きてもスケジュールリスクにならない）。
- テストランナーは Vitest（practices-discovery Q3）。フォーマッタ/リンタは Biome。

## Out of Scope（PRD §8 / scope-document.md）

- aidlc 成果物への書き込み（Answer 記入を除く）/ AI 自動要約・自動レビュー / 全文検索エンジン / 複数インテント・複数スペース横断ビュー / 認証付き社外公開ホスティング / aidlc-workflows 本体の変更 / 旧 State Version サポート。

## Open Questions（後続ステージで扱う）

- ワークスペースのディレクトリ・パッケージ構成（monorepo か単一 package か）→ application-design / units-generation。
- 対応表の具体的な slug→docs 節マッピングのメンテナンス方法（PRD §12 未決）→ functional-design。
- Milkdown 実データ検証の合否とフォールバック先（BlockNote / plain preview）→ M3 冒頭（construction）。

## Review

**Verdict:** READY

**Reviewer:** aidlc-product-lead-agent

**Date:** 2026-07-22

- **Finding 1 — S-1 testability (high): RESOLVED.** FR-4.1's AC now states gate status is one of the fields readable "Now strip **単体で**...他の操作なしに読める" and explicitly names it "S-1 の受入基準の第一要素" (line 61-62). A new FR-4.6 was added whose AC specifies a 1-click affordance on the current-stage card that shows the **next** stage's name and what's required there — and the AC explicitly disambiguates this from the clicked stage's own info: "クリックしたステージ自身の情報ではなく、次ステージの情報" (line 69-70). Together FR-4.1 + FR-4.6 are stated as jointly constituting the S-1 acceptance criterion, matching Q1's answer A exactly (Now strip alone for current-state legibility, 1-click card for next-stage guidance). Both are QA-testable: a tester can open the Dashboard, read gate status from the Now strip without any other action, then click the current-stage card once and verify the next stage's name and requirement appear (not the current stage's own info).
- **Finding 2 — FR-6.1 unmeasurable AC (medium): RESOLVED.** The vague "崩れずに表示される" is gone. FR-6.1's AC now defines a fixed 5-artifact fixture set drawn from tb-lxp covering GFM tables, Mermaid blocks, nested lists, code fences, heading hierarchy, and inline code, against a 5-item pass/fail checklist (table rendering not flattened to plain text; Mermaid renders as a diagram; structural fidelity for headings/lists/code fences; round-trip without content loss or mojibake; read-only↔edit mode switch without crash), judged per-item, with an explicit escalation rule (any single failing item triggers candidate replacement, tied back to feasibility R-2). This is checklist/fixture-level and directly executable by QA in M3.
- **Regression:** No new contradictions found between FR-4.1/FR-4.6/FR-6.1 and the rest of the document or team/project rules (NFR-1 write-boundary exception still scoped to FR-6.2 only; NFR-2/3 measurement conditions from Q4 unchanged; Q2/Q3/Q5 answers still reflected in FR-1.6/FR-2.2/FR-2.5/FR-6.2 unchanged from iteration 1). All required sections are present and intact (Intent Analysis, Functional Requirements FR-1..FR-8, Non-Functional Requirements NFR-1..NFR-7, Constraints, Assumptions, Out of Scope, Open Questions). Coverage remains complete: every FR-group maps to its scope-document F-0x and PRD FR-x.y, and FR-4.6 is traceable to the intent-statement's S-1 north star (no orphan requirement). One cosmetic-only observation, not a testability defect: FR-4.6 is sequenced between FR-4.4 and FR-4.5 in the document (out of numeric order) — does not affect testability or traceability, but the builder may want to resequence for readability in a later pass.
