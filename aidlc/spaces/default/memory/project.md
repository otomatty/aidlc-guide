# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

- 複数の Unit が同じ実装挙動（サーバの bind/認可/broadcast 等）に言及する場合、後発 Unit は自分の設計文書の冒頭に「先行 Unit が既に所有する挙動」の表を置き、その挙動を再仕様化しない。後発 Unit が書くのは差分（自分が実装するもの）のみとし、先行 Unit の挙動に対しては要求・検証の責任だけを持つ（実装所有欄で区別する）。 (learned 2026-07-25) <!-- cid:functional-design:c2 -->
- NFR-2/NFR-3 のような横断的な性能予算を Unit ごとに分解するときは、引用先（先行 Unit）の予算表に該当行が存在することを確認してから引用する。行が無ければ先に先行 Unit 側へ行を追加し、その ID を引用する（存在しない ID を根拠に自分の予算を正当化しない）。 (learned 2026-07-25) <!-- cid:functional-design:c3 -->
- 横断的な性能予算（NFR-2/NFR-3 等）を分解する表には必ず「検算」行を置き、各項目の合計が上位予算に収まることを数値で示す。最悪経路（最も重い分岐）でも収まることを明示し、合計が超える場合は配分か目標のどちらを変えたかを記録する。 (learned 2026-07-25) <!-- cid:nfr-requirements:c3 -->
- 実行体を持たない文書 Unit（kind: spec）のセキュリティ要件は「記述義務」として定義する。攻撃面はゼロでも、運用ガイドの記述ミス（誤った公開手順・認証注意の欠落）が実際の情報漏洩につながるため、必須記載事項と検証方法を要件として明記する。 (learned 2026-07-25) <!-- cid:nfr-requirements:c2 -->
- 設計文書（nfr-design 等）は「要件ID → 実現機構」の対応表形式に統一し、機構は具体的なモジュール名・関数名・設定キーまで落とす。抽象的な方針だけの行を残さない（レビューで機械的に照合可能にするため）。要件が非該当の場合も空欄にせず、非該当の根拠と再訪トリガーを書く。 (learned 2026-07-25) <!-- cid:nfr-design:c2 -->
- 実装中に先行 Unit の契約の穴（返せない情報・存在しないエンドポイント）が判明した場合、後発 Unit 側で回避策を組まず、先行 Unit の型・エンドポイントを拡張して解消する。消費側の回避は契約の嘘を固定化し、以降の Unit が同じ穴を各自で埋めることになる。 (learned 2026-07-25) <!-- cid:code-generation:c1 -->
- 設計文書の「要件 → 実現機構」対応表は願望ではなく契約である。実装が別の機構になった場合、未計測の見込み（「直列でも予算内と思われる」等）を根拠にギャップとして申告してはならない。機構を実装するか、設計文書側を正式に改訂して逸脱として記録するかの二択とし、後者の承認は当該設計ステージのゲートに属する。 (learned 2026-07-25) <!-- cid:code-generation:c4 -->
- 文書 Unit（kind: spec）の受入検証は「読む」ではなく「実行する」。掲載するコマンド・スクリプト・復旧手順は、失敗経路（拒否・競合・dirty tree）を含めて実際に走らせ、観測した出力をそのまま載せる。読解だけでは、成功形の出力を出しながら何も達成していない手順を検出できない。 (learned 2026-07-25) <!-- cid:code-generation:c6 -->
- ビルド成果物に対する検証（初期チャンクの汚染チェック等）は、ファイル名のグロブではなく `index.html` 等のエントリポイント定義から実際に参照されているファイルを解決してから走査する。ハッシュ付きの出力は遅延チャンクも同じ命名規則を持つため、グロブ走査は同名の別チャンクを拾って誤検出する。 (learned 2026-07-25) <!-- cid:build-and-test:c3 -->
- 品質ゲートの定義は単一の置き場（`package.json` の `check` スクリプト）に保ち、呼び出し側（git フック・CI workflow・手順書）はそれを呼ぶだけにしてチェック項目を列挙しない。呼び出し側が独自に列挙すると、ゲート内容の変更時に更新漏れが起き、場所によって通る基準が違う状態になる。両者が食い違った場合はローカルコマンドを真実とする。 (learned 2026-07-25) <!-- cid:ci-pipeline:c2 -->
- フック・ゲート・「〜が存在しないこと」を主張する検証は、肯定側だけでなく**否定側を先に**確認する（わざと失敗させて実際に止まることを見る）。肯定側だけの確認では、常に成功を返す実装や空振りのアサーションと区別がつかない。検証後は作業ツリーを元の状態に戻したことも確認する。 (learned 2026-07-25) <!-- cid:ci-pipeline:c5 -->
## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

- read-only と宣言したフィクスチャ（tb-lxp 等）に対して書き込みを伴う計測が必要になった場合は、フィクスチャを複製して複製側で実施する。計測後にフィクスチャが汚れていないことを `git status` と mtime の両方で確認し、確認結果を成果物に記録する。フィクスチャを直接書き換えると、ピン留めによる決定性という前提そのものが壊れる。 (learned 2026-07-25) <!-- cid:performance-validation:c3 -->
- 性能計測は平均値を出さず min / p50 / p95 / max で記録する。体感を決めるのは最悪値であり、平均は最悪値を隠す。あわせて cold（プロセス起動直後・キャッシュ無し）と warm を必ず分けて記録する — 片方だけの数字は再現しない。 (learned 2026-07-25) <!-- cid:performance-validation:c4 -->
- UI を経由する性能要件は API の直叩きではなく実 UI の操作経路で計測する。API だけを測ると、設計が要求した機構（遅延チャンクと取得の並行発火など）が実際に効いているかを含めた検証にならず、機構が壊れていても数値だけが良く見える。 (learned 2026-07-25) <!-- cid:performance-validation:c5 -->
## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

- UI のステージ状態表現（完了/進行中/ゲート待ち/未着手/SKIP）は色のみに依存させず、全サーフェス（Dashboard・参加者ビュー・マトリクス）で色 + 記号（✔◐◔○⊘）+ テキストラベルの三重表現に固定する。WCAG 2.1 AA・色覚非依存の担保。 (learned 2026-07-21) <!-- cid:rough-mockups:c2 -->
- S-1 到達性の第二要素（現在ステージから次ステージ名＋求められることへの1クリック導線）は、ステージ自身の解説（US-03）とは別の独立コンポーネント（NextStepCallout）として実装し、区画もデータ源（reader-core の next-stage 解決）も分離する。「カードを開く＝自ステージ解説」と混同させない。 (learned 2026-07-22) <!-- cid:refined-mockups:c1 -->
- 安全性に関わる不変条件（読み取り専用の書込境界・plan モード必須・パス containment 等）は、規約の記述だけに頼らず「単一の enforcement point（1関数/1モジュール）＋ 型または lint による構造的禁止」で担保する。例: guardPath を通らない経路を作らない、write 系 fs import を Biome restricted-imports で禁止し例外ファイルのみ許可、必須フラグを定数化して全生成関数が連結する。 (learned 2026-07-25) <!-- cid:nfr-design:c3 -->
## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

- PRD v0.1 (docs/prd/PRD.md) はヘッダ上「レビュー待ち」だが、本プロジェクトでは承認済みベースラインとして扱う。PRD変更が必要になった場合は各ステージの承認ゲートで扱う。 (learned 2026-07-20) <!-- cid:intent-capture:c1 -->
- DECIDED: 第一サーフェスは VS Code / Cursor 拡張（packages/vscode-extension）。Dashboard UI は Webview に載せ、api-core を拡張ホスト（Node）で in-process 実行する。ブラウザ経由の dashboard-server は Mob LAN / 拡張未導入参加者向け副経路 (learned 2026-07-26) <!-- cid:extension-first-surface -->
- DECIDED: 拡張ホストは VS Code 同梱 Node を使用する。C-T1「出荷ランタイム bun のみ」は CLI 副経路（mcp-server / btw / dashboard-server）に適用し、拡張は IDE ランタイム例外とする (learned 2026-07-26) <!-- cid:extension-runtime -->
- ペルソナは全員均等に扱い実装順はマイルストーン順（M1→M4）とする。意思決定で迷った場合のタイブレークは北極星指標 S-1（初学者が1分以内に現在地を説明できる）。 (learned 2026-07-20) <!-- cid:intent-capture:c2 -->
- 本プロジェクト（AIDLC Guide）はローカル専用ツールでクラウド・AWSを一切使用しない。以降のステージでAWS定型質問（利用サービス・アカウント・リージョン等）は不適用として省略してよい。AWSプラットフォーム観点は「インフラ不要・コストゼロ」の確認のみ記載する。 (learned 2026-07-20) <!-- cid:feasibility:c1 -->
- AIDLC Guide のスコープは M1〜M4 全機能（F-01〜F-08）を Must とし、機能の切り下げは想定しない。当初 F-07(Mobモード)/F-08(運用ガイド) を Should（切り下げ候補）としたが、「M4完了まで価値は不可分」（3ペルソナ均等）と矛盾するため全Must化で解消。スコープ縮小が必要になった場合は scope-document.md を基点に承認ゲートで正式に再判断する。 (learned 2026-07-21) <!-- cid:scope-definition:c1 -->
- テストフレームワーク等の dev-time devDependency（例: Vitest）は C-T1「ランタイムは bun のみ」に抵触しないと扱う。C-T1 が縛るのは出荷される本ツールのランタイムであり、開発・テスト時のツールチェーンは対象外（テスト実行自体は bun 上でも可）。将来の依存追加判断の基準とする。 (learned 2026-07-21) <!-- cid:practices-discovery:c1 -->
- org.md の Deployment（deploy-on-merge / staging / prod / CD）はローカル専用ツールの本プロジェクトに不適用とし local-only に再定義する。「リリース」= main への squash-merge または git タグで、環境・CD なし。デプロイ先のスモークテストの代わりに performance-validation の NFR-2/NFR-3（3秒起動 / 2秒反映、tb-lxp フィクスチャ）で検証する。 (learned 2026-07-21) <!-- cid:practices-discovery:c2 -->
- 定性的な北極星 S-1（初学者が1分以内に現在地を説明できる）は、テスト可能な到達性基準に落とし込む: (1) Now strip 単体で phase/stage/unit/gate/完了数が他操作なしに読める、(2) 現在ステージカードを1クリックで『次のステージ名 + そこで人間に求められること』が表示される。実測時間はモブ後アンケートで別途測定し、受入基準は到達性で判定する（requirements.md FR-4.1/FR-4.6）。 (learned 2026-07-21) <!-- cid:requirements-analysis:c1 -->
- NFR-2（起動→初回表示3秒 @ tb-lxp 593ファイル）の達成機構は「段階的初回描画」とする: `GET /api/workflow` は aidlc-state.md 1枚のパース + next-step 解決のみで応答し（Now strip / Stage rail を即描画）、593ファイル全走査（Unit×Stage マトリクス・監査抽出）は初回応答後の背景構築とし完了を WS `matrix-ready` で push する。初回表示のクリティカルパスに全走査を含めない（application-design ADR-03 / services.md）。 (learned 2026-07-23) <!-- cid:application-design:c1 -->
## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

- NEVER add cloud/AWS service dependencies or account-management features — (affirmed 2026-07-21)
this is a local-only tool (出所: intent-statement 初期スコープの手がかり / (affirmed 2026-07-21)
project.md 決定事項「クラウド・AWSを一切使用しない」) (affirmed 2026-07-21)
- NEVER write to aidlc-workflows artifacts, state files, or audit logs from (affirmed 2026-07-21)
this tool, other than the `[Answer]:` exception above (出所: C-T2 / NFR-1) (affirmed 2026-07-21)
- NEVER modify aidlc-workflows core (engine, stage definitions, audit log (affirmed 2026-07-21)
format) as part of this project (出所: constraint-register スコープ制約) (affirmed 2026-07-21)
- NEVER introduce a runtime other than bun, or add a database (出所: C-T1; (affirmed 2026-07-21)
confirmed Q6 — dev-time tooling such as Vitest is not a shipped runtime and (affirmed 2026-07-21)
does not violate this rule, see evidence.md) (affirmed 2026-07-21)
- NEVER assume `--fork-session` JSONL reflects the mainline conversation up (affirmed 2026-07-21)
to the current moment — it is only current as of the last flush; must be (affirmed 2026-07-21)
documented as a known limitation, not silently relied upon (出所: C-T5 / (affirmed 2026-07-21)
FR-3.4) (affirmed 2026-07-21)
## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

- ALWAYS treat `aidlc/spaces/<active-space>/` and any application repo as (affirmed 2026-07-21)
**read-only**, except writing `[Answer]:` lines into `*-questions.md` files (affirmed 2026-07-21)
(出所: C-T2 / NFR-1 — 読み取り専用の原則) (affirmed 2026-07-21)
- ALWAYS run on `bun` only as the runtime — no database, no additional (affirmed 2026-07-21)
runtime/process manager (出所: C-T1 / NFR-5) (affirmed 2026-07-21)
- ALWAYS detect the target workspace's State Version before parsing; show an (affirmed 2026-07-21)
explicit "unsupported / cannot parse" state for anything other than the (affirmed 2026-07-21)
current directory structure (出所: C-T3 / NFR-6) (affirmed 2026-07-21)
- ALWAYS support both Windows (including Git Bash) and macOS code paths — (affirmed 2026-07-21)
no OS-specific assumptions in path handling or process spawn (出所: C-T4 / (affirmed 2026-07-21)
NFR-4) (affirmed 2026-07-21)
- ALWAYS default the Mob-mode server to bind loopback (`127.0.0.1`), not (affirmed 2026-07-21)
`0.0.0.0`; LAN exposure requires an explicit `--host` flag, and the (affirmed 2026-07-21)
`--host` path must print a startup warning naming what is being exposed (affirmed 2026-07-21)
(rendered aidlc artifacts/audit content may contain user-pasted secrets — (affirmed 2026-07-21)
LAN exposure is a data-disclosure event, not just a port-open event) (affirmed 2026-07-21)
(出所: C-T6 / NFR-7; devsecops-agent contribution) (affirmed 2026-07-21)
- ALWAYS meet the measured performance targets against the tb-lxp fixture (affirmed 2026-07-21)
(~593 files): startup→first render ≤3s, change→reflect ≤2s (出所: C-T7 / (affirmed 2026-07-21)
NFR-2, NFR-3) (affirmed 2026-07-21)
- ALWAYS commit and pin the bun lockfile (`bun.lock`/`bun.lockb`) as the (affirmed 2026-07-21)
source of truth (出所: devsecops-agent contribution, supply-chain hygiene; (affirmed 2026-07-21)
confirmed Q6) (affirmed 2026-07-21)
- ALWAYS run `bun audit` (or `bun pm audit`) in the local quality gate; (affirmed 2026-07-21)
a known vulnerability in a direct dependency fails the gate the same way a (affirmed 2026-07-21)
lint failure does (出所: devsecops-agent contribution; confirmed Q6) (affirmed 2026-07-21)
## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
