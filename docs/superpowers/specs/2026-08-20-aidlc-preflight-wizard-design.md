# AI-DLC プリフライト・ウィザード設計

日付: 2026-08-20
状態: レビュー待ち
対象: `packages/vscode-extension`, `packages/dashboard`, `packages/api-core`

## 1. 背景と目的

新規ワークスペース（インテント未作成）で Dashboard を開くと、現在は
EmptyState が「Claude Code で `/aidlc` を実行してください」というプローズを
表示するだけで、AI-DLC を始める前に何が起きるのかは何も分からない。

一方、AI-DLC の初期設定情報の大半は LLM なしで決定的に取得できる
（§3）。LLM が必須なのは composer の ARS エントロピー推定とカスタム
グリッド作成のみ。

本機能は Dashboard の空状態を**プリフライト・ウィザード**に置き換える:
作りたいことを記述すると「推定スコープ・実行ステージ・承認ゲート数・
ワークスペーススキャン結果」がライブ表示され、開始ボタンで
`claude "/aidlc compose <記述>"` （サニタイズ済み・内側引用符なし）を新規ターミナルに送出する。
プランの確定と承認ゲートは従来どおり Claude Code セッション側。

## 2. 決定事項（承認済み）

| 論点 | 決定 |
|------|------|
| UX 形態 | Dashboard 空状態のウィザード化（QuickPick 段階は飛ばしパネル直行） |
| 主動線 | **常に `claude "/aidlc compose <記述>"`**（サニタイズ済み・内側引用符なし）。スコープ直指定ボタンは作らない |
| ハンドオフ | ターミナルで `claude` 起動（`runInTerminal` 再利用）。claude CLI 不在時のみクリップボードコピーにフォールバック |
| スコープ選択 UI | 作らない。スコープ情報は「見通し」の参考表示のみ |

## 3. 事前把握できる情報とデータソース

すべて読み取り専用。`.claude/tools/` へのファイル追加・改変はしない
（core 無改変ルール）。動的 2 点はエンジンと同一の関数を bun 子プロセスで
呼ぶため、予測と実挙動がドリフトしない。

| 情報 | ソース | 取得方法 |
|------|--------|----------|
| ワークスペーススキャン（Greenfield/Brownfield、言語、ビルドシステム、有効スコープ一覧） | `aidlc-utility.ts detect` | `bun .claude/tools/aidlc-utility.ts detect --json`（検証済み: `{projectType, languages, frameworks, buildSystem, submodules, scopesDir, scopeGridPath, scopes[]}` を返す） |
| スコープ推定 | `inferScopeFromText`（純関数、export 済み） | `bun -e "import {inferScopeFromText} from '<絶対パス>/.claude/tools/aidlc-utility.ts'; console.log(JSON.stringify(inferScopeFromText(Bun.argv.at(-1))))" -- "<記述>"`（検証済み: `{scope, source: "keyword"\|"freeform", matches[]}` を返す。import に副作用なし） |
| スコープ×ステージ EXECUTE/SKIP 表 | `.claude/tools/data/scope-grid.json` | 直接ファイル read |
| ステージメタ（phase、番号、名前、lead_agent、mode、produces、consumes） | `.claude/tools/data/stage-graph.json` | 直接ファイル read |
| スコープの性格（depth、skeleton、説明） | `.claude/scopes/aidlc-*.md` frontmatter | 直接ファイル read（YAML frontmatter パース） |

**承認ゲート数の導出**: EXECUTE ステージのうち `phase !==
"initialization"` のものを数える（bootstrap 初期化ステージは
`gate: false` で自動進行、他の EXECUTE ステージは 1 ゲート）。per-unit
ステージもゲートはステージ単位で 1 回なのでこの数えかたで正しい。

**プレビュー ≠ 約束**: 表示するのは「composer が nearest_stock として
選びそうなスコープの見通し」。composer はカスタムグリッドを返しうる。
UI 上に明示的な注記を置く（§4）。

## 4. UI 仕様

### 発動条件

- `derive-view-state.ts` の `kind: "empty"`（`no-active-intent`）のとき、
  現在の `EmptyState`（`atoms.tsx`）に代えて `PreflightWizard` を表示。
- 既存ワークフローがあるとき（通常ダッシュボード表示時）は一切出ない。
- hostMode（dashboard-server / LAN 共有）ではウィザードを出さず従来
  EmptyState のまま（§8）。

### 3 区画構成

1. **記述入力**: textarea 1 つ。ラベル「作りたいこと・直したいことを
   書いてください」。プレースホルダに実例（例:「ログインのタイムアウト
   バグを直したい」）。
2. **ライブ・プリフライト**（入力を 400ms デバウンスして更新）:
   - 推定スコープと根拠 — keyword ヒット時「`bugfix` として検出
     （キーワード: fix）」、freeform 時「`feature`（既定）として扱われ
     ます」
   - プラン見通し: 「N / 33 ステージ実行、承認ゲート M 回、depth: X、
     walking skeleton: on/off」
   - フェーズ別ステージ一覧（折りたたみ、既定は閉）: EXECUTE/SKIP、
     ステージ名＋番号（既存 `stage-numbers.ts` の語彙を再利用）、
     リードエージェント、主要 produces
   - ワークスペーススキャン結果 1 行（「Brownfield / TypeScript /
     bun」）
   - 注記（常時表示）:「これは見通しです。実際のプランは composer が
     提案し、approve / edit / reject ゲートであなたが確定します。」
   - ステージ状態の記号・色規約は既存の三重表現ルール（色＋記号＋
     テキスト）に従う。EXECUTE/SKIP はテキストラベル必須
3. **開始ボタン**:「Claude Code で開始」。押下で webview → 拡張ホストへ
   `start-workflow` メッセージ（ペイロードは記述テキストの生文字列のみ）。
   記述が空の間は disabled。

### 状態

- スキャン・スコープカタログ・グリッドはパネル表示時に 1 回取得して
  保持。記述テキスト依存の推定＋プラン見通しだけデバウンス再取得。
- スコープカタログは通常時は描画しない（推定スコープのプラン見通しが
  主役）。使うのは §9 の bun 不在フォールバック表示のみ。
- preflight 取得失敗（bun 不在等）は区画 2 を静的情報のみに縮退し、
  Setup パネル（doctor）への導線を表示。開始ボタンは生かす（§9）。

## 5. API 仕様: `GET /api/preflight`

`packages/api-core/src/handlers/read.ts` の `routeRead` に読み取り専用
ルートを 1 本追加。webview（in-process）と HTTP（dashboard-server）の
両 transport で同一実装。

- `GET /api/preflight` — 静的部分のみ: `{ scan, scopes, cli, inference:
  null, plan: null }`
- `GET /api/preflight?text=<urlencoded>` — **推定専用**: `{ scan: null,
  scopes: [], cli: null, inference, plan }`。デバウンス（400ms）ごとに
  毎回叩かれるため、`buildCatalog` と bun/claude の 2 プローブと
  `detect` 子プロセスは **実行しない** — クライアントが毎回捨てる静的
  部分を無駄に再計算しない（finding 2）。実行するのは推定子プロセス
  （`inferScopeFromText`）とその結果からのプラン導出のみ。`errors` も
  推定系の理由コード（`infer-failed`）だけを持ちうる。

```jsonc
// text 無し（マウント時）: 静的部分のフル、推定系は null。
{
  "scan": {                    // detect --json の子プロセス結果（キー透過）
    "projectType": "Brownfield",
    "languages": "TypeScript",
    "buildSystem": "bun (package.json)"
  },
  "scopes": [                  // カタログ（scopes/*.md frontmatter + grid 集計）
    { "name": "bugfix", "description": "Fix a specific bug",
      "depth": "Minimal", "skeleton": "off",
      "executeCount": 7, "totalCount": 33, "gateCount": 4 }
  ],
  "cli": { "bun": true, "claude": true },
  "inference": null,
  "plan": null,
  "errors": []
}
```

```jsonc
// text 付き: 推定専用。scan/scopes/cli は再送しない。
{
  "scan": null,
  "scopes": [],
  "cli": null,
  "inference": {               // inferScopeFromText の結果
    "scope": "bugfix", "source": "keyword",
    "matches": [{ "scope": "bugfix", "keyword": "fix" }]
  },
  "plan": {                    // 推定スコープのプラン見通し
    "scope": "bugfix", "depth": "Minimal", "skeleton": "off",
    "executeCount": 7, "totalCount": 33, "gateCount": 4,
    "phases": [
      { "phase": "ideation",
        "stages": [
          { "slug": "intent-capture", "number": "1.1",
            "name": "Intent Capture", "decision": "SKIP",
            "leadAgent": "aidlc-product-agent", "gate": false,
            "produces": ["intent-statement.md"] }
        ] }
    ]
  },
  "errors": []
}
```

実装上の規約:

- ローダは api-core 配下に置く（`reader-core` / `dashboard` に置かない —
  既存のコンテンツローダ配置ルールと同じ扱い）。
- 読むパスは `.claude/` 配下の固定 3 種のみ。**`text` パラメータを
  ファイルパスに使う経路は存在しない**（guardPath の新経路なし）。
- bun 子プロセスは `child_process.execFile("bun", [...])` の配列形
  （シェル非経由）、タイムアウト 5s — 既存 `doctor.ts` の PATH プローブ
  と同型。`text` は execFile の引数配列の 1 要素としてそのまま渡す
  （シェル解釈されないためエスケープ不要）。
- 失敗時は部分応答: `scan` / `inference` が取れなければ該当キーを
  `null` にし、`errors: ["bun-not-found"]` 等の理由コードを添える。
  ルート全体を 500 にしない。
- **クライアント契約**: `PreflightWizard` は静的部分（scan/scopes/cli、
  および degraded 判定に使う errors）をマウント時（text 無し）応答から
  だけ読み、保持する。text 付き応答は inference/plan だけを差し替える
  マージで、静的部分やdegraded 判定を上書きしない — 1 回のデバウンス
  取得で推定が失敗しても、既に出ている静的情報が degraded 表示に
  巻き込まれてはならない。

## 6. ハンドオフ仕様

- 拡張ホスト側（`dashboard-panel.ts` の `wireWebview`）に inbound
  `start-workflow` を追加。ペイロードは記述テキストのみ。**コマンド
  組み立てとサニタイズは必ず拡張ホスト側**で行う（webview からコマンド
  文字列を受け取らない）。
- 組み立て: `claude "/aidlc compose <sanitized text>"` を
  `runInTerminal("AI-DLC", workspaceRoot, command)` で送出。
  内側の引用符を不要にするため、サニタイザが以下の文字を全除去する:
  `` " ' ` $ \ % ! ``。これにより PowerShell / bash / cmd のいずれでも
  シェル特別文字の解釈を防ぐ。
- サニタイズは単一関数 `buildComposeCommand(text: string): string | null`
  に集約（vscode-extension 内）。VS Code の既定シェルは環境依存
  （PowerShell / bash / cmd）のため、シェルをまたいで安全な文字集合に
  正規化する:
  - `` " ' ` $ \ `` — bash/PowerShell の引用内展開・エスケープ
  - `%` — cmd の引用内でも効く環境変数展開
  - `!` — bash 対話シェルの履歴展開（引用内でも効く）
  これらを**除去**し、改行・連続空白は半角空白 1 つに畳む。記述は
  プロンプト自然文であり忠実なバイト保存は要件でない — 安全側の
  正規化（除去）を仕様とする。
- claude CLI 不在（doctor の既存プローブで判定）: 開始ボタンを
  「コマンドをコピー」に切り替え、同じ組み立て結果をクリップボードへ。
  トーストで「Claude Code のターミナルに貼り付けてください」。
- 送出後: ターミナルを `show()` し、ウィザードはそのまま（intent が
  生まれれば既存の watcher / push 経路で通常ダッシュボードに切り替わる）。

## 7. 付随修正（同一チェンジ内）

1. **activation 穴**: `package.json` の `activationEvents` に
   `workspaceContains:.claude/skills/aidlc` を追加。現在は
   `workspaceContains:aidlc/` のみで、`aidlc/` ディレクトリが生まれる前の
   ワークスペース（＝本ウィザードの主対象）で拡張が起動しない。
2. **state-missing の非対称**: `derive-view-state.ts` で
   `reason: "state-missing"` も empty 系に寄せ、赤い `AreaError` ではなく
   「インテントはありますが状態ファイルがまだありません。Claude Code の
   `/aidlc` が最初のステージで作成します」という案内＋ウィザードへの
   導線を表示する。

## 8. hostMode の挙動

- `/api/preflight` 自体は読み取り専用なので hostMode でも応答してよい。
- ただし UI は hostMode ではウィザードを出さない（従来 EmptyState）。
  ターミナル起動はローカル拡張ホストでしか意味がなく、LAN 閲覧者に
  開始ボタンを見せると誤解を生むため。判定は既存の transport 種別
  （vscode postMessage か HTTP か）をそのまま使う。

## 9. エッジケース

| 条件 | 挙動 |
|------|------|
| 記述が空 | 開始ボタン disabled。preflight は静的部分のみ表示 |
| bun 不在 | 区画 2 は scopes カタログ（拡張が直接 read できる範囲）のみに縮退＋Setup パネル導線。開始ボタンは生かす（compose 実行は Claude Code 側の bun 前提であり、その不備は doctor の責務） |
| claude CLI 不在 | 開始ボタン→コピーにフォールバック（§6） |
| `detect` / infer の子プロセス失敗・タイムアウト | 部分応答（§5）。UI は取れた部分だけ描画 |
| 記述が超長文 | 8,000 文字で切り、UI に注記（ターミナルの 1 行コマンドとして安全な長さに制限） |
| インテントは在るが state-missing | §7-2 の案内表示（ウィザード本体は no-active-intent のみ） |

## 10. テスト（`bun run check` 組み込み）

- `buildComposeCommand`: 二重引用符・シングルクォート・バッククォート・
  `$`・バックスラッシュ・`%`・`!` の除去、改行・長文の正規化を含む
  否定テスト（注入形が素通りしないこと）。
- `/api/preflight` ハンドラ: 静的のみ / text 付き / 子プロセス失敗の
  部分応答 / 未知クエリ、の分岐。子プロセスはモック。
- gateCount 導出: bugfix=EXECUTE 7 のうち init 3 を除く 4、feature=30、
  の固定値検証（grid が変わればテストが知らせる）。
- `derive-view-state`: `state-missing` の新マッピング。
- ウィザード表示分岐: empty で表示 / 通常時非表示 / hostMode 非表示。

## 11. 実装配置

| パッケージ | 変更 |
|-----------|------|
| `api-core` | `handlers/preflight.ts` 新設（scan 子プロセス、infer 子プロセス、grid/graph/frontmatter read、集計）＋ `read.ts` にルート 1 行 |
| `dashboard` | `PreflightWizard` コンポーネント新設、`derive-view-state.ts` の empty/state-missing 分岐変更、transport に `start-workflow` 送信 |
| `vscode-extension` | `wireWebview` に `start-workflow` 受信＋ `buildComposeCommand` ＋ `runInTerminal` 呼び出し、`activationEvents` 追加、claude CLI プローブの再利用 |

## 12. やらないこと

- compose の approve / edit / reject ゲートを webview 内に再現しない
  （拡張は読み取り専用 — C-T2。誕生・スコープ書込・state 書込はすべて
  Claude Code セッション側）。
- `.claude/tools/` へのファイル追加・改変（core 無改変ルール）。
- スコープ選択 UI・スコープ直指定の開始ボタン（決定: 常に compose）。
- QuickPick / コマンドパレット版（案 B）。将来必要になれば同じ
  `/api/preflight` ＋ `buildComposeCommand` の上に足せる。
- i18n メッセージカタログ導入（既存ルール準拠）。

## 13. 制約整合

- **C-T2 読み取り専用**: 新規 write ルートなし。api-core の Biome
  restricted-imports（write 系 fs 禁止）はそのまま効く。子プロセスは
  read-only CLI のみ。
- **C-T4 クロスプラットフォーム**: パスは `node:path` / `vscode.Uri`、
  子プロセスは execFile 配列形、エスケープはシェル非依存の正規化。
- **単一品質ゲート**: 新テストはすべて `bun run check` 配下。
- **`dashboard` は `reader-core` を import しない**: preflight データは
  api-core 経由でのみ受け取る。
