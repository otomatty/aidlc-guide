# User Stories — AIDLC Guide

> ステージ: user-stories (Inception 2.4) / 作成日: 2026-07-22 / lead: product（mob elaboration 統合版）
> 入力: requirements.md（FR/NFR）+ personas.md + team-practices.md
> 方針（承認済みプラン）: ペルソナ×ジョブ分割・FRトレース（Q1）/ 中粒度（Q2）/ 全 Must、Must内は依存順 M1→M4（Q3）。
> **mob 統合**: design/developer/quality の round-1 指摘を反映（contributions/ 参照）。粒度目安 12〜18 から **22 ストーリー** に拡張（下記 Deviation）。受入基準は Given/When/Then、全 Must。

## Deviation（mob 由来）

プラン時の粒度目安（12〜18）を超え 22 ストーリーとした。理由: mob が (a) reader-core を MCP から分離すべき（PU-01 の「1ライブラリ」隔離・developer）、(b) US-12 が tunnel/LiveShare/async の3-in-1 エピック（developer/design）、(c) 未トレース FR（Stage rail FR-4.2 / SKIP FR-4.5 / 色覚非依存 a11y / ドライバー側共有 FR-7.1 / 性能・クロスOSの owner）を指摘。いずれも INVEST の Small を保つ分割・追加であり、網羅性を優先して受容。

## サマリ

| # | ペルソナ | ジョブ | M | 主FRトレース | 主テスト種別 |
|---|---------|-------|---|-------------|-------------|
| US-09a | 基盤 | reader-core（state/ツリー/監査/解決/監視） | M1 | FR-1.1〜1.5 | Vitest unit + tb-lxp golden |
| US-09b | ドライバー | MCP 5ツールで状態照会 | M1/M2 | FR-2.1〜2.5 | Vitest integration |
| US-15 | 全 | 壊れた/空の記録でも落ちない | M1 | FR-1.6, NFR-6 | tb-lxp golden（モード別） |
| US-23 | 基盤 | docs-bridge（対応表単一所有・設定・整合） | M2 | FR-5.1〜5.3 | data-contract |
| US-04 | 初学者 | 用語を引く | M2 | FR-2.5 | Vitest unit |
| US-01 | 初学者 | 現在地を1画面で把握 | M2 | FR-4.1 | RTL component |
| US-02 | 初学者 | 次ステージと求められること | M2 | FR-4.6, FR-2.3 | RTL component |
| US-03 | 初学者 | ステージの意味を理解 | M2 | FR-4.4, FR-2.2, FR-5.1 | RTL + data-contract |
| US-05 | 初学者 | 全体像・欠落を俯瞰 | M2 | FR-4.3, FR-1.2 | RTL + Vitest |
| US-16 | 初学者 | Stage rail で流れを辿る（SKIP含む） | M2 | FR-4.2, FR-4.5 | RTL component |
| US-18 | 全 | 色覚に依存せず状態を判別 | M2 | FR-4.2(a11y) | RTL + 手動a11y |
| US-06 | ドライバー | 本線を汚さず調べる（btw） | M2 | FR-3.1 | 手動/CLI |
| US-07 | ドライバー | 文脈を引き継いで調べる（fork） | M2 | FR-3.2, FR-3.4 | CLI + help検証 |
| US-08 | ドライバー | ワンショット質問 | M2 | FR-3.3 | CLI |
| US-13 | 全 | 成果物を崩れず読む | M3 | FR-6.1, FR-6.3 | tb-lxp golden + 手動 |
| US-14 | ドライバー | 質問に回答を記入 | M3 | FR-6.2 | byte-golden |
| US-10 | モブ参加者 | ドライバー状態をライブ閲覧 | M4 | FR-7.1, FR-7.2 | integration + 手動 |
| US-11 | モブ参加者 | read-only で安全に見る | M4 | FR-7.3, NFR-1 | server-reject + DOM |
| US-19 | ドライバー | 状態を安全に共有（公開警告） | M4 | FR-7.1, NFR-7 | server bind + 警告検証 |
| US-12 | モブ参加者 | 同期リモート参加（LiveShare/tunnel） | M4 | FR-7.4, FR-8.1 | doc-review |
| US-22 | モブ参加者 | 非同期共有で追う | M4 | FR-8.2 | doc-review + CLI |
| US-20 | 全 | 両OSで性能目標を満たす | 各M | NFR-2, NFR-3, NFR-4 | perf-validation |

全 Must。切り下げ非想定（scope-document）。MVP 境界の正式決定は delivery-planning。

---

## 基盤（reader-core / MCP）

### US-09a — reader-core（Must / M1 / FR-1.1〜1.5）
As a （3サーフェスすべてが依存する）基盤, I want state パース・成果物ツリー走査・監査イベント抽出・インテント解決・**ファイル監視追従**を UI 非依存の純データ層（reader-core）として提供したい, so that MCP・Dashboard・Mob が同じモデルを一方向に消費でき、生成中もモデルが追従する（team.md 構造規約: reader-core は UI/トランスポート非依存）。
- **AC**: *Given* State Version 7 の有効な記録, *When* reader-core を呼ぶ, *Then* phase・stage 状態・scope・depth・完了数（FR-1.1）、ユニット×ステージ×成果物マトリクス（FR-1.2）、直近監査イベント（FR-1.3）、アクティブ/全インテント（FR-1.4）を型付きで返す。*Given* reader-core が state・construction 配下を監視中, *When* 監視対象ファイルが変更される, *Then* モデルが再構築され変更通知（変更種別＋対象）が発火する（**FR-1.5 watch→rebuild→notify を本ストーリーで検証**。時間目標は US-20/NFR-3）。*Given* reader-core, *Then* React/MCP SDK/HTTP を一切 import しない（依存方向の単体検査）。
- **INVEST**: Independent（純データ層）/ Testable（Vitest unit + tb-lxp ゴールデン、パーサはブランチ重視、watch は一時ファイル変更→通知の unit テスト）。最上流の依存元。

### US-09b — MCP 5ツールで状態照会（Must / M1・一部M2 / FR-2.1〜2.5）
As a ドライバー, I want 本線・サイドの Claude Code から MCP 5ツールで状態・解説・次手・成果物・用語を照会したい, so that AI セッションから直接現在地や成果物を引ける。
- **AC**: *Given* アクティブインテント, *When* `aidlc_status`/`aidlc_next_steps`/`aidlc_read_artifact` を呼ぶ, *Then* reader-core の結果を構造化して返す（M1、reader-core のみ依存）。*Given* `aidlc_explain_stage`/`aidlc_glossary`, *Then* docs-bridge 対応表経由で返す（**docs-bridge に依存＝M2 に着地**）。*Given* `read_artifact` に記録外パス — (i) `../` トラバーサル (ii) 記録外への絶対パス (iii) 記録外を指すシンボリックリンク — のいずれか, *When* 呼び出し, *Then* 各ベクタを列挙的に拒否する（正規化後に記録ルート配下でないパスは全拒否。ケースごとにテスト）。
- **INVEST**: 依存: US-09a（全ツール）, docs-bridge（explain/glossary のみ）。**M1/M2 順序修正（developer 指摘）**: status/next_steps/read_artifact は M1、explain/glossary は docs-bridge と同じ M2。

### US-15 — 壊れた/空の記録でも落ちない（Must / M1 / FR-1.6, NFR-6）
As a 全ペルソナ, I want state・成果物の一部破損や「インテントがまだ無い」状態でも全体が落ちず、該当箇所だけ縮退表示してほしい, so that 一部破損や初回起動で現在地確認そのものが不能にならない。
- **AC**: *Given* 5失敗モードそれぞれ専用のフィクスチャ（①未解決 ②複数列挙 ③パース不能 ④部分欠落 ⑤監査読取不能）**各1件**, *When* 処理, *Then* 健全部分は通常表示・該当要素のみ理由付き「解析不可」で局所縮退（モード別に個別検証、"いずれか1件" ではない）。*Given* インテント未生成の空ワークスペース, *Then* 「インテントがありません」＋一覧導線を表示しクラッシュしない（初回/空状態、S-4）。
- **INVEST**: 基盤堅牢性（M1）。多くの表示ストーリーの前提。

### US-23 — docs-bridge（対応表の単一所有・設定・整合）（Must / M2 / FR-5.1, FR-5.2, FR-5.3）※reviewer 指摘の未トレースFR
As a （Dashboard と MCP の両方）, I want slug→docs 該当節の対応表を docs-bridge が単一所有し、Dashboard と MCP が同じ表を引き、docs パスとプロジェクト固有リンクを設定できるようにしたい, so that ステージ解説・用語が全サーフェスで一貫し、docs の場所を環境ごとに指定できる。
- **AC**: *Given* 同一 slug, *When* Dashboard（US-03）と MCP（US-09b explain/glossary）がそれぞれ引く, *Then* **同一の docs 該当節を返す**（cross-consumer 整合、FR-5.1。対応表の所有は docs-bridge のみ、他は参照）。*Given* 設定に docs リポジトリの clone パス, *When* docs-bridge 起動, *Then* そのパスから docs を解決する（FR-5.2）。*Given* 設定に PRD/ADR/team practices のリンク, *When* 表示, *Then* プロジェクト固有リンク欄に反映される（FR-5.3）。
- **INVEST**: Independent（静的対応表 + 設定）。US-03/US-04/US-09b(explain,glossary) の依存元。M2。

## 初学者エンジニア（P1）

### US-04 — 用語を引く（Must / M2 / FR-2.5）
As a 初学者エンジニア, I want Bolt・gate・unit などの用語をその場で引きたい, so that 議論についていける。
- **AC**: *Given* 既知の用語, *When* glossary を引く, *Then* docs 由来の定義が返る。*Given* 未知の用語, *Then*「未定義」を返す。
- **INVEST**: 依存: docs-bridge（**M2**、M1 でない — developer 指摘で修正）。

### US-01 — 現在地を1画面で把握（Must / M2 / FR-4.1）
As a 初学者エンジニア, I want 現在地（フェーズ/ステージ/ゲート状態/完了数）を1画面で見たい, so that state 生テキストを読まずに今どこか分かる。
- **AC**: *Given* アクティブインテント, *When* Dashboard を開く, *Then* Now strip 単体で phase・current stage・gate 状態・完了数が他操作なしに読める（S-1 第一要素、FR-4.1。unit は state に存在しないため 2026-07-25 に AC から除外 — 進行中ユニットは US-05 のマトリクスが担う）。
- **INVEST**: 依存: US-09a。

### US-02 — 次ステージと求められることを知る（Must / M2 / FR-4.6, FR-2.3）
As a 初学者エンジニア, I want 現在ステージから1クリックで「次のステージ名と、そこで自分に求められること」を知りたい, so that 次に何が起きるか身構えられる。
- **AC**: *Given* Now strip が現在ステージを示す, *When* 現在ステージカードを1クリック, *Then* *次の* in-scope ステージ名とゲート/質問要求が表示される（S-1 第二要素、FR-4.6）。
- **INVEST**: 依存: US-01。

### US-03 — ステージの意味を理解（Must / M2 / FR-4.4, FR-2.2, FR-5.1）
As a 初学者エンジニア, I want 各ステージの目的・入出力・担当エージェント・ゲート要求の解説を読みたい, so that 用語に詰まらず役割が分かる。
- **AC（quality 指摘で「平易」を具体化）**: *Given* ステージを選択, *When* 解説カード表示, *Then* 次の**4フィールドが全て存在**する — ①1〜2文の目的 ②入力→出力（消費/生成アーティファクト名）③担当エージェント名 ④ゲートで人間に求められること。かつ ⑤ docs-bridge 対応表の deep-link が実在ファイルに解決する（リンク切れなし）。「平易さ」は用語カード（US-04）へのリンク存在で担保（主観語をACから排除）。
- **INVEST**: 依存: US-01, docs-bridge, US-04。

### US-05 — 全体像・欠落を俯瞰（Must / M2 / FR-4.3, FR-1.2）
As a 初学者エンジニア, I want ユニット×ステージのマトリクスで成果物の有無・件数・verdict を俯瞰したい, so that 593ファイルでも全体像と薄い箇所が見える。
- **AC**: *Given* construction 成果物のある記録, *When* マトリクス表示, *Then* 各セルの件数と verdict（READY/NOT-READY）が表示され、空セルと対象外セルが区別される。
- **INVEST**: 依存: US-09a（FR-1.2 走査）。

### US-16 — Stage rail で流れを辿る（Must / M2 / FR-4.2, FR-4.5）※design 指摘の未トレースFR
As a 初学者エンジニア, I want 実行対象ステージの一列（Stage rail）で流れを辿り、SKIP は理由付きで折りたたんで見たい, so that ワークフロー全体の順序と「なぜ飛ばすか」が分かる。
- **AC**: *Given* Stage rail 表示, *When* 見る, *Then* 実行対象ステージが順に並び、各状態が判別でき（US-18）、クリックで右パネル（解説/成果物）が開く（FR-4.2）。*Given* SKIP ステージ, *Then* 既定折りたたみ・展開でスコープ由来の理由を表示（FR-4.5）。
- **INVEST**: 依存: US-01, US-03。

### US-18 — 色覚に依存せず状態を判別（Must / M2 / FR-4.2 a11y）※design/project.md 必須規約
As a 全ペルソナ（色覚差のある人を含む）, I want ステージ状態（完了/進行中/ゲート待ち/未着手/SKIP）を色だけに頼らず判別したい, so that 色覚に関わらず現在地が読める（WCAG 2.1 AA）。
- **AC**: *Given* 全サーフェス（Dashboard/参加者ビュー/マトリクス）の状態表示, *When* 検査, *Then* 各状態が **色 + 記号（✔◐◔○⊘）+ テキストラベル** の三重で表現される（project.md Code Style 規約）。グレースケール化しても状態が判別できる。
- **INVEST**: 横断・Testable（記号/ラベル要素の存在をコンポーネント検査 + 手動a11yチェック）。

## ドライバー（P2）

### US-06 — 本線を汚さず調べる（Must / M2 / FR-3.1）
As a ドライバー, I want `btw` 一つで読み取り専用サイドセッションを別ターミナルに起動したい, so that 本線の文脈を汚さず調べ物ができる。
- **AC**: *Given* `btw` 実行, *When* 起動, *Then* plan モード（`--permission-mode plan`）で新ターミナルに Claude Code セッションが起動する。*Given* macOS, *Then* Terminal/既定端末を spawn（例: `open -a Terminal` 相当）し、新プロセスが起動したことを検証。*Given* Windows(Git Bash), *Then* `cmd`/`start` 相当で新ウィンドウを spawn し、新プロセス起動を検証（OS 判定は `process.platform`、`path.sep` 決め打ち禁止 — team.md）。各OSで「spawn コマンドが解決し子プロセスが起動する」ことをOS別スモークで pass/fail 判定。
- **INVEST**: Independent。OS別 spawn は US-20（クロスOS）と連動。

### US-07 — 文脈を引き継いで調べる（Must / M2 / FR-3.2, FR-3.4）
As a ドライバー, I want `btw --fork` で本線の文脈を引き継いだ分岐で調べたい, so that 今の作業文脈を踏まえた質問ができる。
- **AC**: *Given* 本線セッション, *When* `btw --fork`, *Then* 最新セッションIDを解決して fork 起動。*Given* `btw --help`, *Then* fork の JSONL フラッシュ制約と `/branch` 代替が明記される。
- **INVEST**: 依存: US-06。

### US-08 — ワンショット質問（Must / M2 / FR-3.3）
As a ドライバー, I want `btw -p "<質問>"` でヘッドレスに一問聞きたい, so that ターミナルを切り替えず即答を得る。
- **AC**: *Given* `btw -p "<Q>"`, *When* 実行, *Then* ヘッドレスで回答が標準出力に返る。
- **INVEST**: 依存: US-06。

## 横断・成果物閲覧

### US-13 — 成果物を崩れず読む（Must / M3 / FR-6.1, FR-6.3）
As a 全ペルソナ, I want 成果物 Markdown（テーブル・Mermaid 混在）を WYSIWYG で崩れず読みたい, so that 生 Markdown を目で追わず内容を理解できる。
- **AC**: *Given* tb-lxp 検証フィクスチャ5成果物, *When* ビューアで開く, *Then* 5項目チェックリスト（表/Mermaid/構造/往復/切替）を全て満たす（FR-6.1 AC。不合格なら候補交代）。
- **INVEST**: リスク（Milkdown 検証、M3冒頭）。依存: US-01。

### US-14 — 質問に回答を記入（Must / M3 / FR-6.2）
As a ドライバー, I want `*-questions.md` の `[Answer]:` 行だけをビューアから記入したい, so that 唯一許された書き込みを安全に行える。
- **AC（quality 指摘で byte-level 化）**: *Given* `*-questions.md`, *When* `[Answer]:` 行を編集し保存, *Then* 保存後ファイルは編集対象行**以外がバイト単位で不変**（golden 比較）で、対象行のみ変わる。*Given* 他ファイル/他行への書き込み試行, *Then* 拒否される（NFR-1/Forbidden）。
- **INVEST**: 依存: US-13。優先: 閲覧の後（scope Q4）。

## モブ参加者（P3）

### US-10 — ドライバー状態をライブ閲覧（Must / M4 / FR-7.1, FR-7.2）
As a モブ参加者, I want LAN 公開された Dashboard の状態変化をライブで追いたい, so that 口頭確認なしにブランチ状態を把握できる。
- **AC（quality 指摘で機能と性能を分離）**: *Given* ドライバーが `dashboard --host` 起動し参加者が接続, *When* ドライバー側でファイルが変わる, *Then* 参加者ビューに**その変更が伝播する（機能）**。伝播の**時間目標2秒（NFR-3）は US-20 / performance-validation で計測**（本ストーリーは伝播の正しさを検証）。
- **INVEST**: 依存: US-01/05, reader-watch。

### US-11 — read-only で安全に見る（Must / M4 / FR-7.3, NFR-1）
As a モブ参加者, I want 参加者ビューが真に read-only であることを保証してほしい, so that 誤ってドライバーの成果物・回答に触れない。
- **AC（quality 指摘で server-side 追加）**: *Given* 参加者ビュー, *When* 表示, *Then* 編集 UI が DOM に存在せず read-only バッジを表示。*Given* 参加者経路からの書き込みリクエスト（UI を迂回しても）, *When* サーバに届く, *Then* **サーバ側で拒否**される（DOM 不在だけに依存しない）。
- **INVEST**: Testable（server 書込拒否 + DOM 検査）。依存: US-10。

### US-19 — 状態を安全に共有（Must / M4 / FR-7.1, NFR-7）※design 指摘のドライバー側
As a ドライバー, I want 自分の状態を LAN 公開するとき、既定は localhost で、`--host` 時は「何を公開するか」の警告を見たい, so that 意図せず社内情報を LAN に晒さない。
- **AC**: *Given* フラグなし起動, *Then* loopback のみバインド。*Given* `--host` 起動, *Then* LAN バインドし、公開対象（レンダリングされた aidlc 成果物/監査内容にユーザー貼付の秘密が含まれ得ること）を名指しした起動時警告を表示（Mandated 整合）。
- **INVEST**: Testable（bind アドレス + 警告文の存在）。依存: US-10。

### US-12 — 同期リモート参加（Must / M4 / FR-7.4, FR-8.1）
As a モブ参加者, I want 同室でなくても Live Share またはトンネル公開でドライバーの画面・状態を同期で追いたい, so that リモートでもモブに参加できる。
- **AC**: *Given* Live Share 運用ガイド（`liveshare.autoShareTerminals` 等）, *When* 手順どおり実施, *Then* ワークスペース＋read-only ターミナルを共有できる。*Given* トンネル手順（cloudflared/Tailscale）, *Then* 認証注意付きで公開できる（ツール本体には組み込まない）。
- **INVEST**: 文書主体（F-08）。依存: US-10。**US-12 分割（design/developer 指摘）**: 非同期は US-22。

### US-22 — 非同期共有で追う（Must / M4 / FR-8.2）※US-12 から分割
As a モブ参加者, I want ドライバーがゲート通過時に push した内容を、checkout せずに閲覧したい, so that 非同期でも最新の成果物を追える。
- **AC**: *Given* 非同期共有規約, *When* ゲート通過, *Then* 自動 `git push` フックが動く。*Given* 参加者側, *When* `git fetch` + `git show origin/<branch>:<path>`, *Then* checkout 不要で成果物を閲覧できる。
- **INVEST**: 文書 + フック。依存: なし（git のみ）。

## 品質特性（NFR オーナー）※design/quality 指摘の owner 欠落

### US-20 — 両OSで性能目標を満たす（Must / 各M / NFR-2, NFR-3, NFR-4）
As a 全ペルソナ, I want Windows(Git Bash 含む)/macOS の両方で、起動→初回表示3秒・変更→反映2秒（tb-lxp 約593ファイル）を満たしてほしい, so that どの環境でも実用速度で使える。
- **AC**: *Given* tb-lxp 記録, *When* 両OSで Dashboard をコールド起動, *Then* 初回描画 ≤3秒（NFR-2）。*When* 単一ファイル変更, *Then* 反映 ≤2秒（NFR-3）。*Given* パス処理・監視・spawn, *Then* 両OSで機能する（NFR-4）。
- **INVEST**: performance-validation で計測（NFR-2/3 の受入はそこ）。横断オーナー。

---

## ストーリー依存グラフ（実装順の骨子・mob 統合後）

```
M1: US-09a（reader-core: parse/tree/audit/resolve/watch）→ US-15（fail-soft/空; reader-core の堅牢性なので 09a に直接アンカー）→ US-09b(status/next/read)（MCP）
M2: US-23（docs-bridge）→ US-04(glossary) / US-09b(explain,glossary) / US-03(解説)
    US-01（Now strip）→ US-02 / US-03 / US-05 / US-16 / US-18
    US-06（btw）→ US-07 / US-08
M3: US-13（WYSIWYG）→ US-14（回答記入）
M4: US-10（Mob live）→ US-11 / US-19 → US-12 / US-22
横断: US-20（性能・クロスOS、performance-validation で計測）
```

全 Must。MVP 境界の正式決定は delivery-planning。

## Review

**Verdict:** READY

**Reviewer:** aidlc-product-lead-agent

**Date:** 2026-07-22

- **Finding 1 — FR-1.5 (reader-watch) orphan: RESOLVED.** US-09a's AC now carries a dedicated Given/When/Then for watch behavior: "Given reader-core が state・construction 配下を監視中, When 監視対象ファイルが変更される, Then モデルが再構築され変更通知（変更種別＋対象）が発火する（FR-1.5 watch→rebuild→notify を本ストーリーで検証。時間目標は US-20/NFR-3）" (line 47). This is QA-testable (fixture: touch a watched file, assert model rebuild + notification with change-type/target payload) and correctly delegates only the *timing* threshold to US-20/NFR-3, keeping the functional watch→rebuild→notify contract here. FR-1.5 is no longer an orphan.
- **Finding 2 — read_artifact rejection vectors: RESOLVED.** US-09b's AC now enumerates exactly the three vectors requested: "(i) `../` トラバーサル (ii) 記録外への絶対パス (iii) 記録外を指すシンボリックリンク" and specifies the mechanism and per-case test obligation: "正規化後に記録ルート配下でないパスは全拒否（ケースごとにテスト）" (line 52). QA can write one test per vector.
- **Finding 3 — US-15 ordering: RESOLVED.** The dependency graph now reads "M1: US-09a（reader-core...）→ US-15（fail-soft/空; reader-core の堅牢性なので 09a に直接アンカー）→ US-09b(status/next/read)（MCP）" (line 170), placing US-15 directly after US-09a and ahead of US-09b, with an explicit rationale ("reader-core の堅牢性なので"). US-09b's own INVEST line no longer lists US-15 as a dependency ("依存: US-09a（全ツール）, docs-bridge（explain/glossary のみ）", line 53), consistent with the corrected anchor.
- **Finding 4 — US-06 cross-platform AC: RESOLVED.** The AC now splits into per-OS Given/When/Then blocks with an observable pass/fail signal: macOS spawns via `open -a Terminal`-equivalent "新プロセスが起動したことを検証", Windows(Git Bash) spawns via `cmd`/`start`-equivalent with the same child-process-started check, explicitly gated on `process.platform` (not `path.sep`, per team.md), and closes with a single concrete test verdict rule: "各OSで「spawn コマンドが解決し子プロセスが起動する」ことをOS別スモークで pass/fail 判定" (line 106). This is concrete and executable per OS, not a vague "works cross-platform" claim.
- **Finding 5 — FR-5.1/5.2/5.3 (docs-bridge) orphan: RESOLVED.** New US-23 ("docs-bridge（対応表の単一所有・設定・整合）", Must, M2, lines 60-63) carries one AC clause per FR: FR-5.1 cross-consumer consistency is tested via "Dashboard（US-03）と MCP（US-09b explain/glossary）がそれぞれ引く, Then 同一の docs 該当節を返す"; FR-5.2 docs-path config via "設定に docs リポジトリの clone パス...そのパスから docs を解決する"; FR-5.3 project links via "設定に PRD/ADR/team practices のリンク...プロジェクト固有リンク欄に反映される". All three are independently testable and the story is correctly marked as the sole owner ("対応表の所有は docs-bridge のみ、他は参照").
- **Regression:** No new orphan FRs — cross-checked every FR-1.x through FR-8.x and NFR-1/2/3/4/6/7 against the summary table and per-story AC text; each resolves to at least one story (NFR-5 remains untraced to a story, same as iteration 1, and is a global architectural constraint rather than a user-facing story — not a new gap). No story traces to a nonexistent FR/NFR — every FR/NFR id cited in stories.md (including FR-4.2(a11y) and FR-2.3 reused across US-02/US-09b) exists in requirements.md. All 22 stories are still tagged Must, consistent with scope-document's no-downgrade decision. Required sections are intact: summary table, Deviation note, per-persona groupings, cross-cutting NFR-owner section, and the dependency graph, all present and mutually consistent (the graph's M1/M2/M3/M4 ordering matches each story's header tag).

