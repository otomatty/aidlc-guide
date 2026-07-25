# Architecture Decision Records — AIDLC Guide

> ステージ: application-design (Inception 2.6) / 作成日: 2026-07-23
> 入力: requirements.md + stories.md + team-practices.md + application-design-questions.md の回答
> 各 ADR: Context / Decision / Consequences / Alternatives Rejected + 可逆性。inception ルール「トレードオフ分析には最低2案の検討を記録」に従う。

## ADR-01: bun workspaces モノレポ（7パッケージ）— Q1

- **Context**: 「1ライブラリ・3サーフェス」（PRD §4）と team.md 構造規約1（reader-core は UI/トランスポート非依存の一方向依存）を、レビューだけでなく機械的に守りたい。
- **Decision**: bun workspaces で `shared-types / reader-core / docs-bridge / mcp-server / dashboard-server / dashboard / btw` の7パッケージに分割。依存方向は package.json の依存宣言で表現し、逆依存はビルドが物理的に失敗する構造にする。
- **Consequences**: (+) 依存方向がツールで強制される。パッケージ単位のテスト・型検査が明確。(−) 初期セットアップがやや重い。ワークスペース設定は Windows Git Bash + macOS 両方で検証が要る（NFR-4）。
- **Alternatives Rejected**: (B) 単一パッケージ+ディレクトリ分割 — 依存方向が lint 頼みになり、構造規約の担保が弱い。(C) reader-core のみ分離 — dashboard→reader の直接 import を防げない。
- **可逆性**: 中。パッケージ統合は機械的に可能（分割よりも統合が容易）。

## ADR-02: reader-core は単一ファサード + 型付き Result — Q2

- **Context**: パーサ隔離（規約2）と「境界で throw しない」（規約3）を API 形状に落とす必要がある。State Version 変化（C-T3/NFR-6）が最大のリスク。
- **Decision**: `createReader(rootPath)` の単一ファサード。内部は `parse/ tree/ audit/ intents/ watch/` に隔離し、State Version 依存は `parse/` のみに閉じる。全公開メソッドは `ReadResult<T> = {ok}|{unsupported,version}|{error,reason}` を返す。
- **Consequences**: (+) バージョン変化時の差し替えが `parse/` 内で完結。呼出側は 3 分岐を型で強制され、fail-soft（NFR-6）が全サーフェスで一貫。(−) 呼出側は毎回 Result 分岐を書く（ボイラープレート増）。
- **Alternatives Rejected**: (B) モジュール個別 export — 消費者がパーサ内部に直接触れられ、隔離が崩れる。(C) ステートフルなクラス — watch との組合せで状態管理が複雑化し、テストが重くなる。
- **可逆性**: 高（ファサードの背後は自由に再構成できる）。

## ADR-03: ブラウザへのデータ供給は dashboard-server 経由（REST + WebSocket）— Q3

- **Context**: ブラウザ SPA は FS を直接読めない。NFR-2（3秒起動）/NFR-3（2秒反映）と、reader-core をサーバ側に閉じる規約1を同時に満たす必要がある。
- **Decision**: ローカル bun サーバ `dashboard-server` が reader-core を呼び、静的アセット + `GET /api/*`（初期スナップショット）+ `WS /ws`（watch 由来の差分 push）でブラウザに供給する。
- **Consequences**: (+) reader-core はサーバ側のみ（ブラウザに FS 概念を持ち込まない）。Mob モード（FR-7.2 の push）と同一機構で済む。起動時キャッシュ+差分 push で NFR-2/3 に正面から効く。(−) プロセスが1つ増える（ユーザーは `bun run dashboard` を1回叩く）。
- **Alternatives Rejected**: (B) Vite dev サーバのミドルウェア — 開発時前提の構成で、配布形態（ビルド済み配信）と合わない。(C) 静的 JSON 書き出し — リアルタイム追従（NFR-3/FR-7.2）と両立しない。
- **可逆性**: 中。API 契約（component-methods.md）を保てばサーバ実装は差し替え可。

## ADR-04: Mob モードは dashboard-server の `--host` モード（別プロセスにしない）— Q4

- **Context**: FR-7（LAN 公開 + push + read-only 参加者）と NFR-7（既定 loopback・明示フラグ・公開警告）。実装重複を避けたい。
- **Decision**: Mob 専用サーバは作らず、dashboard-server の起動フラグで切り替える。既定 `127.0.0.1`、`--host` で LAN bind + 公開対象を名指しした警告表示（US-19）。`--host` 起動時は `POST /api/answer` をサーバ側で 403（US-11、read-only はサーバで担保）。
- **Consequences**: (+) 1実装で D/M 両モード。WS broadcast も共通。セキュリティ既定が単一箇所（bind 判断の所有 = dashboard-server）。(−) ドライバー自身も `--host` 中は回答記入できない。この運用回避策（口頭合意→ドライバーが本線 or `--host` 停止後に記入）は **C8 運用ガイドの必須収録項目**として components.md C8 に義務化した（Live Share ガイド「モブ中の回答記入」節 — ADR の受容トレードオフが宙に浮かないためのトレース先）。
- **Alternatives Rejected**: (B) Mob 専用サーバ — 実装・ポート・警告の二重管理。(C) Live Share のみ — FR-7.2 の構造化ビュー push を放棄することになる。
- **可逆性**: 高（フラグ分岐の分離は後からでも容易）。

## ADR-05: Milkdown は ArtifactViewer 内に隔離（交代可能性を構造化）

- **Context**: Milkdown が実成果物（テーブル+Mermaid 混在）で崩れるリスクは M3 冒頭検証まで残る（feasibility R-2 / US-13 の5項目チェック）。
- **Decision**: Milkdown 依存を dashboard の `ArtifactViewer` コンポーネント1箇所に閉じ、入力契約（markdown 文字列 → 表示）だけに依存させる。検証不合格時は BlockNote / plain preview へ差し替え。
- **Consequences**: (+) 候補交代の影響範囲が1コンポーネント。テストは「エディタへ渡すデータ契約」を対象にする（team.md）。(−) Milkdown 固有機能への深い統合はしない（浅い統合に留める）。
- **Alternatives Rejected**: (B) アプリ全体を Milkdown 前提で構築（エディタ API・スキーマをアプリ状態に直結）— 統合は深くなるが交代コストが全域に波及し、R-2 のフォールバック方針と矛盾。(C) 最初から自前レンダラ（markdown-it/remark ベースの read-only プレビュー + 独自 Answer 編集）— 交代リスクはゼロになるが、WYSIWYG 要件（FR-6.1、PRD 第一候補 Milkdown）を初手で放棄することになり、検証もせずに候補を却下するのは PRD §11 の「M3 冒頭に実データ検証を置き、不適なら交代」という決定順序に反する。
- **可逆性**: 高（それが目的の設計）。

### ADR-05 追記（2026-07-25 / construction: artifact-viewer code-generation） — 候補交代の実行記録

本 ADR が構造化した「交代可能性」が実際に行使された。**ADR-05 本体は変更しない**（当時の判断は
その時点の情報に対して正しい）。以下は交代の実行記録である。

**計測したこと（M3 冒頭の5項目チェック / FR-6.1 AC）**

`@milkdown/crepe@7.21.3` を実際にインストールし、本レコードの実成果物5件
（`component-dependency.md` / `unit-of-work-dependency.md` / `artifact-viewer` の
`logical-components.md` / `dashboard-ui` の `code-summary.md` / `requirements.md` — GFM テーブル・
Mermaid フェンス・ネストリスト・コードフェンス・見出し階層・インラインコードを網羅）に対し
jsdom で `new Crepe(...) → setReadonly(true) → create()` を実行して計測した。

- 項目1（表の保持）**PASS** — `<table>` 6/2/6件。
- **項目2（Mermaid が図として描画される）FAIL** — mermaid ソース行 `graph TD` が本文テキストとして
  出現し、図ノードは0件（検出された `<svg>` 40件はすべて `milkdown-icon` の UI クローム）。
  Crepe は mermaid フェンスを CodeMirror のコードブロックとして扱う。
- 項目3（構造保持）**PASS** / 項目4（往復欠落なし）**PASS（構造的に該当なし** — 本設計では編集が
  WYSIWYG を往復しない。`getMarkdown()` はバイト同一ではなく 2933→4217 bytes） / 項目5 **PASS**。
- 補足計測（判定の補強材料）: Crepe 単体の lazy ビルドは **2,264.68 kB / gzip 608.64 kB**（118チャンク、
  dist 合計 3.9MB）で、アプリ全体の初期チャンク 230.75 kB の約10倍。jsdom 駆動には3つの
  グローバル polyfill と初回マウント4.3秒を要した。

**決定**

項目2の不合格により FR-6.1 AC の「1項目でも不合格なら候補交代」が発火した。救済（mermaid フェンスを
図に差し替える）にはカスタム ProseMirror NodeView が必要であり、本 ADR の Consequences
「Milkdown 固有機能への深い統合はしない（浅い統合に留める）」に真正面から反するため採らない。

交代先は **`marked` の `lexer()` によるトークン→React 要素マッピング**（read-only レンダラ）。
`marked` は既に mermaid の推移的依存として lockfile にあり（`marked@16.4.2`）、直接依存への昇格で
解決済みパッケージは1件も増えていない。`marked.parse()`（HTML 文字列を返す）は呼ばず `lexer()` のみを
使うため、描画経路に HTML 文字列が存在せず S-AV-3 が構造として成立する
（`dependency-direction.test.ts` がソース走査で `marked()` / `.parse` / `parseInline` を禁止）。

**候補順序の消化状況（PRD §11 は Milkdown → BlockNote → plain preview の3段）**

- 段1 **Milkdown: 実測して不合格**（上記）。
- 段2 **BlockNote: 計測していない。構造的なカテゴリ不一致を理由に飛ばした**（判断であり実測ではない）。
  BlockNote も ProseMirror ベースの WYSIWYG **エディタ**であり、(a) mermaid フェンスを図にするには
  同じくカスタム NodeView が必要で項目2が同じ機構で不合格になる、(b) 編集が一切往復しない read-only 面に
  エディタ級の重量を払う点も同じ。不合格理由が Milkdown 固有のバグではなく**カテゴリのミスマッチ**
  （read-only 表示面に編集器を置いている）であるため、同カテゴリの次候補を計測する価値がないと判断した。
  **したがって本記録は「全候補を評価した」ことを意味しない** — 評価したのは3段のうち1段目のみである。
- 段3 **plain preview: 採らず**。終端の全文 `<pre>` は FR-6.1 の項目1（表が表として描画される）と
  項目3（構造保持）を定義上満たせず、M3 の主要要件がゼロ達成になる。ADR-05 の
  Alternatives Rejected (C)「最初から自前レンダラ」の却下理由は**順序**（検証前に候補を却下しないこと）で
  あり、段1の実データ検証が完了した現時点では拘束しない。

**結果として得られた隔離境界**

交代で変更したのは tech-stack-decisions.md:18 が定める3点ちょうど:
(1) `packages/dashboard/src/viewer/MarkdownSurface.tsx` の実装、
(2) `nfr-requirements/tech-stack-decisions.md` の WYSIWYG 行、
(3) 本追記。
`MermaidBlock`（Props は `{code: string}` のみ）・`AnswerEditor`・`viewer/services/answer.ts`・
`viewer/index.tsx`・呼出側 `DetailPanel` はいずれも WYSIWYG 実装を知らないため無改修。
他 Unit の変更はゼロ。データ契約 `{markdown, editable, onEdit}` も不変。**ADR-05 の目的は達成された。**

**未消化（受入確認として残る）**

交代先の項目2（Mermaid が図として描画される）は**実ブラウザで一度も実行していない** —
`MermaidBlock` のテストは jsdom で mermaid をモックしており、検証済みなのは委譲グルーと
`securityLevel:"strict"` 設定と失敗時フォールバックのみ。Crepe を落とした基準（実測）と
後継を採用した基準（グルーの単体テスト）が非対称であり、FR-6.1 項目2 の受入確認は未完了。
code-summary.md の G-4 に受入確認の責務として記載。

## 横断メモ（aws-platform 観点）

クラウド・インフラ ADR は**意図的に不在**（project.md「クラウド・AWSを一切使用しない」/ feasibility「該当なし（意図的）」）。インフラコストゼロ。infrastructure-design ステージはスコープで SKIP 済みであり、本設計のネットワーク面は ADR-04 の bind 制御のみ。
