# Code Summary — Unit: artifact-viewer

> code-generation (3.5) / Unit: artifact-viewer / 2026-07-25
> 実装場所: `packages/dashboard/src/viewer/`（既存 dashboard パッケージ内の遅延ロード領域）

## Milkdown/Crepe 5項目チェック（FR-6.1 AC / feasibility R-2） — **不合格 → 候補交代**

実装の最初の作業として `@milkdown/crepe@7.21.3` を**実際にインストールして計測**した。
フィクスチャは本レコードの実成果物5件（GFM テーブル / Mermaid フェンス / ネストリスト /
コードフェンス / 見出し階層 / インラインコードを網羅）:

1. `inception/application-design/component-dependency.md`（表 + mermaid）
2. `inception/units-generation/unit-of-work-dependency.md`（表 + mermaid）
3. `construction/artifact-viewer/nfr-design/logical-components.md`（表 + コードフェンス）
4. `construction/dashboard-ui/code-generation/code-summary.md`（表6 / 見出し12 / リスト54、23.5KB）
5. `inception/requirements-analysis/requirements.md`（見出し17 / リスト100、13.6KB）

jsdom で `new Crepe({root, defaultValue}) → setReadonly(true) → create()` を実行した実測:

| 項目 | 判定 | 実測した証拠 |
|------|------|-------------|
| 1. GFM テーブルが表として描画される | **PASS** | fixture1 `<table>` 6件 / fixture3 2件 / fixture4 6件。プレーンテキスト化しない |
| 2. **Mermaid ブロックが図としてレンダリングされる** | **FAIL** | fixture1 で mermaid ソース行 `graph TD` が**そのまま本文テキストとして出現**（`MERMAID-SRC-VISIBLE-AS-TEXT: true`）。図ノードは 0 件（`[data-language='mermaid'], .mermaid` = 0）。検出された `<svg>` 40件は全て `milkdown-icon`（ブロックハンドル等の UI クローム）で図ではない。Crepe は mermaid フェンスを CodeMirror のコードブロックとして扱う |
| 3. 見出し階層・ネストリスト・コードフェンスの構造保持 | PASS | fixture4 で `h1〜h4` 12件 / `li` 54件 / コードブロック4件 |
| 4. 往復で内容欠落・文字化けなし | PASS（構造的に該当なし） | `getMarkdown()` はバイト同一ではない（2933→4217 bytes、表セルのパディングが再整形される）。ただし本設計では**編集が WYSIWYG を往復しない**（`AnswerEditor` が `[Answer]:` 1行を編集し、サーバがバイトオフセットで書き込む）ため、往復無欠落は構造的に満たされる |
| 5. モード切替でクラッシュしない | PASS | `setReadonly(true)` で例外なし |

**項目2が不合格。FR-6.1 AC の「1項目でも不合格なら候補交代」に該当する。**

不合格を「深い統合」で救えるかも検討したが、mermaid フェンスを図に差し替えるには
ProseMirror の カスタム NodeView が必要で、これは ADR-05 の Consequences
「Milkdown 固有機能への深い統合はしない（浅い統合に留める）」に真正面から反する。
また logical-components.md「ADR-05 隔離の担保」が主張する「mermaid の埋め込みグルーは
swap-generic」という前提も崩れる（NodeView は WYSIWYG プラグイン API 依存）。

**副次的な不適合（判定を補強する材料。単独では交代理由にしていない）**:

- **バンドルコストが用途に不釣り合い**: Crepe だけを lazy チャンクにビルドすると
  **2,264.68 kB（gzip 608.64 kB）** + 言語モード等 118 チャンク、`dist` 合計 3.9MB。
  アプリ全体の初期チャンクが 230.75 kB（gzip 73.31 kB）であることに対し **約10倍**。
  本サーフェスは read-only（編集は WYSIWYG を通らない）であり、ProseMirror + CodeMirror +
  Vue + katex + 全言語モードは1バイトも使わない機能に対する支払いになる。
- **jsdom で駆動するのに 3つのグローバル polyfill が必要**（`IntersectionObserver`
  未定義で即例外 / `ResizeObserver` / `Range.getClientRects`+`getBoundingClientRect`）、
  かつ初回マウントに 4.3秒。team.md「テストはエディタへ渡すデータ契約を対象にする」に対し、
  polyfill 足場をテストすることになる。

### 交代先の決定（documented order: Milkdown → BlockNote → plain preview）

**BlockNote は計測せずに構造的理由で外した**（判断であり実測ではない。明示的に記録する）:
BlockNote も ProseMirror ベースの WYSIWYG **エディタ**であり、(a) mermaid フェンスを
図にするには同じくカスタム NodeView が必要で項目2が同じ機構で不合格になる、(b) 編集が
一切往復しない read-only 面にエディタ級の重量を払う点も同じ。不合格理由が Milkdown 固有の
バグではなく**カテゴリのミスマッチ**（read-only 表示面に編集器を置いている）であるため、
同カテゴリの次候補を計測する価値がないと判断した。

**採用: `marked` の lexer によるトークン→React 要素マッピング**（D-1 参照）。
交代順の終端 `plain preview` そのもの（全文 `<pre>`）は採らなかった。理由は D-1 に記す。

**ADR-05 の隔離は成立した**（tech-stack-decisions.md:18 の3点判定基準に対して、3点すべて実施済み）:

| 判定基準の3点 | 実施 |
|--------------|------|
| 1. `MarkdownSurface` の実装ファイル | `packages/dashboard/src/viewer/MarkdownSurface.tsx` の中身を差し替え |
| 2. tech-stack のこの行 | `nfr-requirements/tech-stack-decisions.md` の WYSIWYG 行を決定済み状態に書き換え（2026-07-25） |
| 3. ADR-05 の追記 | `inception/application-design/decisions.md` に「ADR-05 追記（2026-07-25）」を追加（本体は不変） |
| （帰結）他 Unit・他コンポーネントの変更ゼロ | `MermaidBlock` / `AnswerEditor` / `viewer/services/answer.ts` / `viewer/index.tsx` / 呼出側 `DetailPanel` は WYSIWYG 実装を知らないため無改修。他 Unit の変更ゼロ |

> 初回パスでは1点目のみを実施して「隔離成立」と結論していた（レビュー F-2 の指摘どおり、
> 3点中1点で成功宣言していた）。2点目・3点目を実施した上で改めて成立と記録する。

`@milkdown/crepe` は**依存から削除済み**（lockfile を正直に保つ）。

## 生成ファイル

| ファイル | 役割 | 行数 |
|---------|------|-----|
| `src/viewer/index.tsx` | `ArtifactViewer`（D1 フロー + D3 5状態）+ `ViewerToolbar`（同ファイル内） | 191 |
| `src/viewer/MarkdownSurface.tsx` | データ契約の実装境界 + ErrorBoundary + 1MB 経路 + mermaid フェンス検出 | 273 |
| `src/viewer/MermaidBlock.tsx` | 動的 import・モジュールスコープ メモ化・strict 描画・失敗はコード表示 | 94 |
| `src/viewer/PlainPreview.tsx` | `<pre>` 素テキスト | 25 |
| `src/viewer/AnswerEditor.tsx` | `[Answer]:` 行編集 + `SaveBar`（同ファイル内）+ hostMode 非描画 | 180 |
| `src/viewer/services/answer.ts` | `saveAnswer()`（唯一の POST）+ 再取得 + バイト不変再検証 | 116 |
| `src/viewer/artifact-path.ts` | `artifactPath()` / `firstArtifact()` — **import ゼロの葉モジュール**。DetailPanel の先行取得と viewer の初期 state が同じ規則を共有するための唯一の置き場（P-AV-2） | 20 |
| `tests/viewer*.test.tsx`（6） | 下記テスト構成 | 880 |

**既存ファイルへの変更**:
`src/services/api.ts`（`fetchArtifact()` + `prefetchArtifact()` 追加。**GET のみ**を維持）、
`src/components/DetailPanel.tsx`（cell 選択時に `React.lazy` で viewer を差し込み + P-AV-2 の先行取得）、
`src/components/UnitStageMatrix.tsx`（`cell.files.length` 表示）、
`src/styles/app.css`（`.viewer__*` / `.answer__*`、+約190行）、
`packages/dashboard/package.json`（`marked` 追加 / `@milkdown/crepe` 削除）、
`biome.json`（dashboard パッケージに `security/noDangerouslySetInnerHtml` を明示 error 化）、
`tests/{dependency-direction,detail-panel}.test.ts(x)`。

## 横断変更: `MatrixCell.count` → `files: string[]`

ビューアはセル内の成果物ファイル名を必要とするが、ワイヤ上にその情報が無かった。
`reader-core` の `cellFor` は既にソート済みファイル名配列を持ち、それを捨てて件数だけを
返していたため、**新エンドポイントを足さずフィールドを置換**した。`count` は残していない
（件数は `files.length`。二重の真実を作らない）。

| ファイル | 変更 |
|---------|------|
| `packages/shared-types/src/index.ts` | `count: number` → `files: string[]`（doc コメントも更新） |
| `packages/reader-core/src/tree/matrix.ts` | `cellFor` の3分岐（ENOENT / 読取失敗 / 正常）すべて `files` を返す |
| `packages/dashboard/src/components/UnitStageMatrix.tsx` | `const count = cell.files.length` を1箇所で導出し、空(·)/件数表示の判定に使用 |
| `packages/reader-core/tests/matrix.test.ts` | 件数 assert → **ファイル名 assert に強化**（`["business-rules.md","review.md"]` 等）。弱めていない |
| `packages/dashboard/tests/fixtures.ts` | matrix フィクスチャのセルを実名ファイル配列に |
| `packages/dashboard/tests/components.test.tsx` | cell.error フィクスチャ / テスト名を `files` 基準に |
| `packages/dashboard/tests/reducer.test.ts` | `matrix:<unit>` push の7件を7ファイル名に |

`dashboard-server` / `mcp-server` にはセル形状を assert するテストが無く、変更不要だった
（`push.ts` は `buildMatrixForUnit` の戻りをそのまま broadcast する）。
成果物パスは `construction/<unit>/<stage>/<filename>` を `GET /api/artifact?path=` に渡す。

## P-AV-2 の並行発火（チャンク取得と `GET /api/artifact` を同時に開始）

performance-design.md:11 が定める「開く操作の時点で両方開始」を実装した。**D1 のフロー所有者は
viewer のまま**で、DetailPanel は読み取りを*先に始める*だけである。

```
DetailPanel の render（cell 選択）
  ├─ <ArtifactViewer/> を描画 → React.lazy がチャンク取得を開始
  └─ prefetchArtifact(construction/<unit>/<stage>/<first>) → GET を開始   ← 同一 tick
                                    ↓（両者が並行して進む）
viewer が mount → 自分の effect で fetchArtifact(同じ path)
                                    ↓
                  services/api.ts の in-flight マップに既にある promise をそのまま受け取る
                  （＝2本目のリクエストは発生しない）
```

- **`services/api.ts`**: `prefetchArtifact(path)` が読み取りを開始し、進行中 promise を
  モジュールスコープの `Map<string, Promise<ReadResult<string>>>` に置く。`fetchArtifact(path)` は
  まずこのマップを見て、**取り出したら即座にエントリを削除**する。
  **コンテンツキャッシュではない**: エントリは使い捨ての baton であり、同じ path を再度
  prefetch すれば必ず新しいリクエストで置き換わる。したがって**同じ成果物を開き直せば必ず再読込**
  される（`viewer/services/answer.ts` のバイト不変再検証は「保存直後に新しく読み直したバイト列」
  でしか意味を持たないため、この鮮度は必須）。
- **`viewer/artifact-path.ts`**: 「セルが最初に開く成果物」の規則（`firstArtifact`）と
  パス組み立て（`artifactPath`）を **import ゼロの葉モジュール**に1箇所だけ置き、DetailPanel の
  先行取得と viewer の初期 local state の両方がそれを使う。二重定義なら暖めた path と実際に開く
  path がずれ得る。葉モジュールなので DetailPanel からの静的 import は viewer チャンクを
  初期バンドルに引き込まない（実測: 下記バンドル表）。
- **viewer 側は無変更**（`fetchArtifact` を自分の effect から呼ぶだけ）。

**検証**（`tests/viewer-prefetch.test.tsx`。Vitest はテストファイルごとにモジュールレジストリを
分けるため、このファイルの最初の render では lazy チャンクが本当に未解決になる = 競合ではなく
決定的な assert になる）:

1. `fireEvent.click`（同期）直後の時点で **`artifact-viewer` はまだ DOM に無く、`fetch` は既に1回
   発行済み**で、その URL は当該成果物のパス。チャンク解決後も **`fetch` は合計1回のまま**
   （= viewer は進行中 promise を再利用し、2本目を出していない）。
2. 同じ成果物を閉じて開き直すと **`fetch` は2回**（= キャッシュではない）。

## 品質ゲート実測（`bun run check`）

レビュー指摘（F-1〜F-5）の是正後、2026-07-25 に再実行した実測:

```
biome check .            Checked 149 files in 182ms. No fixes applied.
tsc --noEmit             (エラーなし)
tsc --noEmit -p packages/dashboard   (エラーなし)
vitest run --coverage    Test Files 50 passed (50)
                         Tests 657 passed | 2 skipped (659)
bun audit                No vulnerabilities found
```

本 Unit 前は 44 files / 598 passed | 2 skipped。差分 **+6 files / +59 tests**。
既存テストの失敗はゼロ（`MatrixCell` 変更で影響を受けた 4 ファイルは assert を強化して更新）。
（是正前は 49 files / 655 passed。F-1 の並行発火テスト +2 件・+1 ファイル。）

リポジトリ全体 coverage: Statements 96.43% / Branches 92.13% / Functions 96.66% / Lines 97.67%。

dashboard の coverage（v8、今回の実測）:

| 区分 | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `src/viewer` | 96.27 | 90.44 | 98.11 | 96.64 |
| `src/viewer/services` | 97.29 | 88.23 | 100 | 100 |
| `src/components` | 93.81 | 87.71 | 94.11 | 94.41 |
| `src/services` | 93.70 | 88.88 | 94.59 | 95.23 |
| `src/store` | 97.10 | 94.82 | 100 | 100 |
| `src/app` | 88.88 | 50 | 83.33 | 88.00 |

team.md「UI 層 ライン カバレッジ ~80%」を全区分で上回る。

## バンドル実測（P-AV-1）

`bun run --cwd packages/dashboard build`:

| | 本 Unit 前 | 本 Unit 後（F-1 是正後） | 差分 |
|--|-----------|-----------|------|
| **初期チャンク** | `index-DH8z4lY0.js` **230.75 kB / gzip 73.31 kB** | `index-BHRbpseT.js` **231.70 kB / gzip 73.64 kB** | **+0.95 kB / gzip +0.33 kB** |
| viewer チャンク | — | `index-CJJPuW0m.js` 50.53 kB / gzip 16.55 kB（ArtifactViewer + marked） | 新規・遅延 |
| mermaid | — | `mermaid.core-J-OP6m1X.js` 582.62 kB / gzip 136.90 kB + 図種別チャンク約60本 | 新規・図が現れた時のみ |
| matrix チャンク | 3.52 kB | 3.52 kB | 不変 |
| モジュール数 | 60 | 2140 | — |

初期チャンクに `mermaid` / `marked` / viewer 由来の文字列が**1件も含まれないこと**を
`grep -c` で確認済み（`mermaid` 0 / `marked` 0 / `securityLevel` 0 / 「成果物を閉じる」0）。
初期チャンクの +0.95 kB の内訳は `DetailPanel` の `React.lazy` グルー、`prefetchArtifact` の
in-flight マップ、`viewer/artifact-path.ts`（20行・import ゼロの葉）のみ。
**葉モジュールを DetailPanel から静的 import しても viewer チャンクは初期バンドルに入らない**
（上表と grep 結果が実測）。**P-AV-1 達成**。

## テスト構成（+59件）

- `viewer-surface.test.tsx`（12件）— **FR-6.1 の5項目チェックをテストとして常設化**:
  GFM テーブルが列・行を保持すること、mermaid フェンスが `MermaidBlock` に**素の文字列**で
  渡ること、非 mermaid フェンスがコードのままであること、見出し階層とネストリストの構造、
  本文の欠落なし、`editable` 指定でも編集不能であること。S-AV-3 の4分岐（生 HTML は要素化
  されずソース表示 / `javascript:` リンクは平文化 / http リンクは `rel="noopener noreferrer"` /
  HTML コメントは非表示）。1MB 超は `markdown-surface` を経ず `plain-preview` へ直行（P-AV-5）。
  引用・区切り線・タスク項目・`start` オフセット・打消し・画像 alt・`h6` クランプ。
- `viewer-surface-crash.test.tsx`（1件）— 実行時例外 → PlainPreview + 注記（D3 error(b)）。
  fault は**契約点**（mermaid 委譲）に注入しており、レンダラを差し替えても壊れない。
- `viewer-mermaid.test.tsx`（4件）— 正常時に SVG が入ること、不正時に `<code>` +
  「図として描画できません」で落ちないこと、`initialize` が
  `{securityLevel:"strict", startOnLoad:false}` で**1回だけ**呼ばれること（2図で render は2回・
  initialize は1回 = P-AV-3 のメモ化）、ライブラリが壊れた SVG を返した場合もマークアップ扱い
  しないこと。`mermaid` 自体はモック（テスト対象は本 Unit のグルー）。
- `viewer-answer.test.tsx`（24件）— `unchangedOutsideLine` の一致 / 他行変更 / 行の増減 /
  **CRLF 差の検出** / 範囲外行。`saveAnswer` の全応答分岐（契約どおりの POST ボディ、
  再取得 URL、一致・不一致、再取得失敗、unsupported、非 JSON、reason 形ボディ、
  サーバ停止）。`AnswerEditor` の hostMode **DOM 完全不在**（`document.body.textContent === ""`）、
  非質問ファイルで非描画、ラベル（行番号 + 質問文）、保存成功、
  **5識別子それぞれのインラインメッセージ**（`it.each`）、未知識別子 + ネットワーク失敗の
  default 分岐と再試行導線。
- `viewer.test.tsx`（14件）— D3 5状態（empty / loading の 200ms 閾値 / success / error ×2 /
  partial）、`artifactPath` が OS 非依存の POSIX 相対パスであること、ツールバーの
  成果物切替・`aria-current`・verdict バッジ・成果物クローズ、編集ゲート3件。
- `detail-panel.test.tsx`（+2件）— cell 選択で lazy viewer がセル自身の `files` で開くこと
  （横断変更の接続点）、stage 選択では viewer が出ないこと。
- `viewer-prefetch.test.tsx`（2件・新規）— **P-AV-2 の並行発火**。同期クリック直後に
  「viewer は未 mount / `fetch` は当該パスに対して既に1回発行済み」であること、チャンク解決後も
  `fetch` が合計1回のまま（viewer が進行中 promise を再利用し2本目を出さない）であること。
  開き直しで `fetch` が2回になること（＝コンテンツキャッシュでない）。
  Vitest がテストファイルごとにモジュールレジストリを分けることを利用し、**このファイルの
  最初の render で lazy チャンクが本当に未解決**になるようにして決定的な assert にしている。
- `dependency-direction.test.ts`（更新）— **POST を発行するモジュールが
  `viewer/services/answer.ts` ただ1つであること**（S-AV-1 を構造的に固定）、
  `fetch` を呼ぶのが `services/api.ts` と `viewer/services/answer.ts` の2つだけであること、
  `marked` を lexer としてのみ使い `marked()` / `.parse` / `parseInline` を呼ばないこと、
  依存リストが7件に固定されていること、`dangerouslySetInnerHTML` / `innerHTML` がゼロであること。

## 設計判断（Deviations / D-n）

- **D-1: 交代先は `plain preview` ではなく `marked` lexer + React 要素マッピング**。
  交代順の終端（全文 `<pre>`）を採ると、FR-6.1 のチェック項目1（表が表として描画される）と
  項目3（構造保持）が定義上満たせず、M3 の主要要件がゼロ達成になる。一方で必要なのは
  **read-only の Markdown 表示**であって編集器ではないため、`marked.lexer()` のトークンを
  React 要素に落とす約200行で項目1/2/3を満たせる。
  - `marked` は**すでに mermaid の推移的依存として lockfile にある**（`marked@16.4.2`）。
    `^16.4.2` で直接依存に昇格させたため、解決済みパッケージは**1件も増えていない**
    （`bun audit` は依然 clean）。
  - `marked.parse()` は HTML 文字列を返すため**呼ばない**。`lexer()` のみを使い、トークンを
    React 要素にする。結果として本 Unit の描画経路には HTML 文字列が1バイトも存在せず、
    S-AV-3 が「規約」ではなく**構造**として成立する（`dependency-direction.test.ts` が
    `marked()` / `.parse` / `parseInline` の呼出をソース走査で禁止）。
  - ADR-05 の Alternatives Rejected (C)「最初から自前レンダラ」に見えるが、(C) の却下理由は
    **順序**（「検証もせずに候補を却下するのは PRD §11 の決定順序に反する」）である。
    **正確を期すと、PRD §11 の順序は Milkdown → BlockNote → plain preview の3段であり、
    実データ検証が完了しているのは1段目（Milkdown）のみである**（2段目 BlockNote は計測せず、
    カテゴリ不一致という構造的理由で飛ばした — ADR-05 追記に明記）。したがって (C) に対する
    反論として本項が主張できるのは「**第一候補を検証せずに却下してはいない**」という点までであり、
    「全候補を評価した」ではない。契約 `{markdown, editable, onEdit}` も ADR-05 の隔離境界も
    変えていない。
- **D-2: `ViewerToolbar` の「閉じる」は成果物を閉じ、パネルは閉じない**。`DetailPanel` は
  既に `✕ 閉じる` を持ち、Esc とフォーカスも所有している（frontend-components の a11y 注記）。
  同一パネル内に同じ動作のボタンを2つ置くのは欠陥なので、ツールバーの `✕ 成果物を閉じる` は
  開いている成果物を閉じてファイル一覧に戻る別動作にした。`onClose` prop は
  `ArtifactViewer` の外部契約に出さず、viewer のローカル state で完結する。
- **D-3: `MarkdownSurface` の `onEdit` は read-only レンダラからは呼ばれない**。
  契約（`{markdown, editable, onEdit}`）の一部として型に残してあるが、編集は
  `AnswerEditor` が所有する（frontend-components の階層どおり）。`editable.answerLines` は
  `data-answer-lines` として境界に露出し、編集可能レンダラに差し替える際の唯一の接続点になる。
  未使用 prop を残すのは本来避けたいが、ADR-05 が名指しした swap の seam であるため残置し、
  コード内コメントで「read-only 実装では呼ばれない」と明記した。
- **D-4: `aria-readonly` は使わない**。frontend-components は「read-only 領域は
  `aria-readonly`」と記すが、`aria-readonly` は generic な region ではサポートされない
  ARIA 属性で、Biome の `a11y/useAriaPropsSupportedByRole` が正しく拒否する（実測でエラー）。
  静的コンテンツは本来 read-only であり、実際の保証は**構造的**（描画ツリーに
  `contenteditable` もフォームコントロールも存在しない）。テストは `data-readonly` 属性では
  なく「`input, textarea, select, [contenteditable]` が0件であること」を assert する。
- **D-5: 保存後の再取得に失敗した場合は `failed` を返す**（`saved` にしない）。
  D2 は「200 → 再取得 → 再検証」を要求するが、再取得自体が失敗したときの振る舞いを
  規定していない。書き込み自体は成功している可能性があるが、**再読み込みしていない内容を
  表示するのは「サーバが唯一の真実」に反する**ため、default 分岐（再試行導線つき）に落とす。
- **D-6: `AnswerEditor.onSaved` は再取得した markdown を引数に取る**（設計は `onSaved()`）。
  D2 が「表示更新もこの再取得結果を使う」と定めており、本文を親に渡さないと更新できない。
  楽観更新は行わない（渡されるのは常にサーバ由来の再読み込み結果）。
- **D-7: 1MB 閾値は UTF-16 コード単位で測る**。`markdown.length` を使用。CJK では UTF-8
  バイト数を過小評価する＝**閾値がより早く発火する**方向であり、コストガードとして安全側。
  Blob 化してバイト数を数えるのは 1MB 級文字列に対して逆効果。
- **D-8: 先行取得は effect ではなく render フェーズで発火する**。`useEffect` は
  **子から先に**走るため、チャンクが既に温まっている2回目以降は viewer 自身の読み取りが先に出て、
  DetailPanel の先行取得が**重複リクエスト**になる（実測: 1回の open で fetch 2回）。
  render フェーズは `<ArtifactViewer/>` を描画してチャンク取得が始まるのと同一 tick であり、
  レビューが求めた「同じ tick で両方開始」そのものである。`useRef` の `warmed` により
  **対象 path ごとに1回だけ**発火し、無関係な再レンダーでは追加のリクエストを出さない。
- **D-9: in-flight エントリは settle では消さない（consume と再 prefetch でのみ消す）**。
  レビューの指示は「consume または settle のいずれか早い方で削除」だったが、ローカル成果物の
  読み取りは 50kB のチャンク取得よりはるかに速く終わるため、settle 削除にすると**通常ケースで
  baton を落とし** viewer が2本目を出す（実測: 1回の open で fetch 2回）。
  代わりに「consume で削除 / 同一 path の再 prefetch で置換」とした。レビューが本当に求めた性質
  （コンテンツキャッシュにしない＝開き直せば必ず再読込）は、**再 prefetch が常に新しい
  リクエストで置き換える**ことで満たしている（`viewer-prefetch.test.tsx` が実測）。
  消費されなかったエントリは path ごとに1件だけ残る（`ponytail:` コメントで上限と昇格経路を明記）。

## ギャップ / 後続 Unit 送り

- **G-1: 実測 NFR は未計測**（機構は全て実装済み）。P-AV-2 の秒数（初回 ≤1.5s / 2回目 ≤0.8s）、
  P-AV-3（図ごと ≤500ms）、P-AV-4（保存 ≤1.5s）は tb-lxp フィクスチャに対する
  performance-validation ステージの担当。本 Unit では機構（lazy 分割 / **チャンクと読み取りの
  並行発火** / モジュールメモ化 / `===` 1回比較）の実装と、P-AV-1（バンドル分離）・
  P-AV-2 の並行性（テストで実測）・P-AV-5（1MB 経路）の検証まで完了。
- ~~**G-2: P-AV-2 の並行発火は未実装**~~ — **撤回（2026-07-25、レビュー F-1）**。
  これはギャップではなく performance-design.md:11 の機構契約に対する違反だった。実装済み
  （上記「P-AV-2 の並行発火」節）。番号は参照の安定のため欠番として残す。
- **G-3: 10MB 境界のフィクスチャテストは未実施**。nfr-requirements の測定方法は
  「大サイズ fixture（1MB 境界 + 10MB）」だが、10MB はサーバ（reader-core の
  `readArtifact` bound）が `file-too-large` で拒否するため本 Unit に届かない。
  1MB 境界は `PLAIN_PREVIEW_LIMIT` に対するテストで実測済み。10MB 側は
  `dashboard-server` / `reader-core` 側の既存テストが担保している。
- **G-4: FR-6.1 チェック項目2 の受入確認が未完了 — 実ブラウザでの mermaid 実描画が必要**
  （手動ビジュアルチェック一般ではなく、**受入確認の責務**として送る）。
  Crepe を落とした決定的証拠は項目2（Mermaid が図として描画される）の**実測**だったが、
  交代先の項目2は**一度も実行されていない**: `MermaidBlock` のテストは jsdom で `mermaid` を
  モックしており、検証済みなのは (a) mermaid フェンスが `{code: string}` として委譲されること、
  (b) `initialize({securityLevel:"strict", startOnLoad:false})` が1回だけ呼ばれること、
  (c) 描画失敗時にコード表示へフォールバックすること、の3点にとどまる。
  すなわち**候補を落とした基準（実測）と後継を採用した基準（グルーの単体テスト）が非対称**である。
  受入としては「実ブラウザで実成果物（`component-dependency.md` /
  `unit-of-work-dependency.md`）を開き、mermaid が図として描画されること」の確認が要る。
  トークン層（`lang=mermaid` のフェンスが `code` トークンとして分離され MermaidBlock へ渡ること）は
  実データで確認済みなので設計判断が覆るとは見ていないが、**未確認であることは事実**。
  付随して残る手動項目（200% 拡大、コントラスト、キーボード走査）は accessibility-checklist の
  手動側に属し、こちらとは別枠。
- **G-5: `verdict` は選択セルのものを表示**。ViewerToolbar のバッジはセル単位の verdict
  （`MatrixCell.verdict`）であり、個々の成果物の verdict ではない。reader-core が
  ファイル単位の verdict を返さないため（`findVerdict` はセル内最後のファイルの値を返す）。
  BR-UI-3 に従い、クライアント側で数え直したり推測したりしていない。

## Review

**Verdict:** NOT-READY

> aidlc-architecture-reviewer-agent / code-generation (3.5) / Unit: artifact-viewer / iteration 1 of 2
>
> 注: 本レビューの初回実行は `.aidlc-reviewer-dispatch.json` の `unit` が `dashboard-ui` を指しており、
> 本 Unit の成果物・契約が全て scope hook に拒否されたため実施不能だった。record 修正後に再実行。
>
> **再検証不要（初回パスで実測確認済み）**: 品質ゲート green（`bun run check`: Statements 96.39% /
> Branches 92.10%、`bun audit` clean）/ P-AV-1 バンドル実測（`dist/index.html` の entry は
> `index-DLam8MS6.js` **231.29 kB**、`mermaid` 文字列 0 件、mermaid は 50.54 kB の遅延チャンクへ分離）/
> S-AV-1（POST は `viewer/services/answer.ts` の1件のみ）/ S-AV-3（`biome.json:255-263` の
> `noDangerouslySetInnerHtml: error` + `dependency-direction.test.ts:83-116` の二重の構造的強制。
> markdown 内のインライン HTML も `MarkdownSurface.tsx:88-91,188-195` でエスケープ済みリテラル表示）/
> S-AV-2（`AnswerEditor.tsx:168` の早期 return で DOM 完全不在）/ S-AV-5（境界を越えるのは boolean のみ）/
> バイト不変再検証の比較対象（`answer.ts:41-48`、`lineBounds` が終端を span から除外するため CRLF 変化も検出）。

### F-1 [Blocking] G-2 は「未実装ギャップ」ではなく、performance-design.md の機構契約に対する違反

`nfr-design/performance-design.md:11` は P-AV-2 の**実現機構**をこう定めている:

> チャンク取得と `GET /api/artifact` を**並行**発火（開く操作の時点で両方開始し、Promise.all で待つ）

実装は直列である。`DetailPanel.tsx:121-131` は `ArtifactViewer` を `<Suspense>` 内に置き、
`lazy` の解決後に初めてマウントされる。fetch はその後 `viewer/index.tsx:110-120` の `useEffect`
で開始されるため、チャンク取得が完了するまで発火し得ない。`Promise.all` も先行発火も存在しない。

これを G-2 として「未実装」に分類したのは誤りである。理由:

1. `project.md`（Code Style, learned 2026-07-25 / cid:nfr-design:c2）は「設計文書は要件ID→実現機構の
   対応表形式に統一し、機構は具体的なモジュール名・関数名・設定キーまで落とす」と定めている。
   performance-design.md の当該行は**契約そのもの**であって努力目標ではない。
2. G-2 自身が「並行化には D1 のフロー所有者が viewer から DetailPanel に移る」と認めている。
   これはコンポーネント責務の移動＝設計変更であり、実装時の裁量で保留してよい粒度ではない。
3. 保留の根拠が「直列でも予算内と**見込む**」という未計測の推定である。設計が指定した機構を
   推定で置き換えており、しかも performance-design.md は無修正のまま残る。結果として
   「並行発火する」と書かれた設計文書と、直列の実装が併存する（stale contract）。

**修正案（どちらか）**: (a) `Promise.all` による並行発火を実装する、または (b) performance-design.md:11 を
「直列。P-AV-2 実測が 1.5s を超えた場合に並行化を再検討」に**改訂した上で** D-n（設計からの逸脱）として
記録し直す。(b) を選ぶ場合、機構変更の承認は performance-validation ではなく nfr-design のゲートに属する。
現状の「G-n に置いて下流ステージへ送る」は、設計の指定を将来の計測結果に条件付けており、
その計測が設計を再オープンする経路を持たないため、事実上の無期限保留になっている。

### F-2 [Blocking] 候補交代に伴う文書更新が、tech-stack-decisions.md 自身の「隔離成功の判定基準」を満たしていない

`nfr-requirements/tech-stack-decisions.md:18` は交代時に変更すべき対象を自ら列挙している:

> 候補交代が起きた場合、変更するのは `MarkdownSurface` の実装ファイル1つ **+ tech-stack のこの行 +
> ADR-05 の追記**のみ（他 Unit・他コンポーネントの変更ゼロが隔離成功の判定基準）

code-summary.md:60-62 は「ADR-05 の隔離は成立した」と結論しているが、根拠として挙げているのは
コードファイルの無改修のみである。3点のうち残る2点が未了:

- `tech-stack-decisions.md:10` は依然「**Milkdown (Crepe) が第一候補** … 不合格なら **BlockNote →
  plain preview** の順に交代」と記載。実際には Crepe は不合格、BlockNote は未評価、採用は
  `marked` lexer であり、この行は現状と一致しない。
- `inception/application-design/decisions.md` の ADR-05 への追記も確認できない。

判定基準を自ら定義している以上、コード側の無改修だけで「隔離成立」と結論するのは論証が不完全である。
**修正案**: tech-stack-decisions.md:10 を実際の採用（`marked` lexer / read-only トークン→React マッピング）に
改訂し、ADR-05 に交代の経緯と BlockNote 未評価の判断を追記する。

### F-3 [Non-blocking] BlockNote のスキップは論拠としては妥当だが、ADR-05 (C) の却下理由を完全には解消していない

`business-logic-model.md:9` と `tech-stack-decisions.md:10` が定める交代順は Milkdown → BlockNote →
plain preview であり、実装は BlockNote を**未計測のまま**外して第4の選択肢を採った。

これを擁護する材料は実在する: (a) code-summary.md:50 が「計測せずに構造的理由で外した（判断であり
実測ではない。明示的に記録する）」と自己申告しており、隠蔽ではない。(b) 却下理由（ProseMirror ベースの
編集器であり mermaid を図にするには同じくカスタム NodeView が必要／read-only 面に編集器級の重量）は
BlockNote に構造的に当てはまり、恣意的ではない。

ただし D-1（code-summary.md:200-203）が「ADR-05 (C) の却下理由は**順序**であり、検証は実データで完了して
いる」とする点は正確でない。PRD §11 の順序は Milkdown → BlockNote → plain の3段であり、実データ検証が
完了しているのは1段目のみである。順序に関する反論は 2/3 しか解消されていない。F-2 の ADR-05 追記の中で
「BlockNote はカテゴリ不一致を理由に計測を省略した」と明記すれば十分に閉じられる。

### F-4 [Non-blocking] G-4 は FR-6.1 チェック項目2の根拠の弱さとして再分類すべき

Crepe を落とした決定的証拠は項目2（mermaid が図として描画される）の**実測**である
（code-summary.md:23: mermaid ソースが本文テキストとして出現、図ノード0件）。一方、交代先の項目2は
実行されたことがない — G-4 が認めるとおり `MermaidBlock` は jsdom で mermaid をモックしており、
実ブラウザでの実描画は一度も走っていない（`viewer-mermaid.test.tsx` が検証するのはグルーと
`securityLevel:"strict"` の設定のみ）。

すなわち、ある候補を落とした基準（実測）と、後継を採用した基準（グルーの単体テスト）が非対称である。
トークン層までは当方で実データ確認済み（下記）なので設計判断が覆るとは考えないが、G-4 を
「手動ビジュアルチェック一般」ではなく「**FR-6.1 項目2 の未完了な受入確認**」として明示し、
performance-validation ではなく受入確認の責務として送るべきである。

### F-5 [Non-blocking] `answerLinesOf` が1レンダーにつき3回呼ばれる

`viewer/index.tsx:173,175,180` で同一引数の `answerLinesOf(path, markdown)` を3回評価している
（各回が `markdown.split("\n")` を実行）。`-questions.md` 以外は即 return するため実害は小さいが、
1変数に束ねれば済む。P-AV-* を脅かす規模ではない。

### 指摘なしを確認した項目（検証済み）

- **D2 の再試行導線**: 契約違反ではない。`business-logic-model.md:39-40` は再試行導線を
  「その他（未知の error 識別子 / ネットワーク失敗）」＝ default 分岐に対してのみ要求しており、
  5つのゲート拒否には求めていない。実装（`AnswerEditor.tsx:63,75` — gate は `retry:false`、
  default のみ `retry:true`）は契約と厳密に一致する。初回パスで挙げた懸念は解消。
- **FR-6.1 5項目チェック（交代先）**: 本レコードの実成果物に対し marked の lexer を直接実行して確認。
  項目1（GFM テーブル）= PASS（`component-dependency.md` で `table` トークン3件 / 15行 / 最大8列、
  `logical-components.md` で1件7行。`MarkdownSurface.tsx:98-128` が実 `<table>` を出力）。
  項目3（構造保持）= PASS（`requirements.md` で heading 17件・最大 h3、list 55件のうちネスト41件、
  コードフェンス検出）。項目2の前提 = PASS（`lang=mermaid` のフェンスが `code` トークンとして
  分離され `:171-172` で MermaidBlock へ委譲）。項目4（欠落なし）= PASS。
- **Crepe 実測の裏付け**: 再実行は不能（依存から削除済みで、否定を確認するために 2.2MB の依存を
  再導入するのは不均衡）。ただし当方の独立計測で `component-dependency.md` の長さが **2933 バイト**
  となり、code-summary.md:25 が fixture1 の往復前サイズとして挙げる 2933 と完全一致した。
  記載の計測が実在し、名指しされたフィクスチャに対して行われたことの裏付けとする。
  `@milkdown/crepe` の依存削除も確認済み（`dependency-direction.test.ts:66-74` が依存を7件に固定）。
- **`MatrixCell.count → files` と NFR-2**: 脅威なし。matrix は初回描画のクリティカルパスに存在しない
  （`project.md` の application-design ADR-03: `GET /api/workflow` は state のみで応答し、全走査は
  背景構築 → WS `matrix-ready`）。加えて `nfr-requirements/performance-requirements.md:19` が本 Unit の
  操作を NFR-2/NFR-3 から明示的に除外している。ペイロード増は初回描画後に到着する。
- **WS `matrix:<unit>` のマージ経路**: 整合。`reducer.ts:128-140` は当該 unit の cells を丸ごと置換する
  実装で、フィールド構成に依存しない。サーバ側も `buildMatrixForUnit` の戻り値をそのまま broadcast する
  （dashboard-server `business-logic-model.md:25`）。monorepo 全体の `tsc --noEmit` が通過しているため、
  未更新の consumer は存在し得ない。
- **CRLF の扱い**: marked の lexer は CRLF を LF に正規化するが、これは描画経路に閉じている。
  行番号算出（`AnswerEditor.tsx:27-34`）・値抽出（`:38` の `.replace(/\r$/, "")`）・バイト不変検証
  （`answer.ts:32`）はいずれも lexer を通らない生バイト列を扱い、`\r` を明示的に処理している。
- **D-2 / D-4**: いずれも妥当な逸脱として正しく D-n に分類されている。`aria-readonly` が generic な
  region でサポートされないのは事実であり、D-4 の判断は技術的に正しい。

## Review (iteration 2)

**Verdict:** NOT-READY

> aidlc-architecture-reviewer-agent / code-generation (3.5) / Unit: artifact-viewer / iteration 2 of 2
>
> F-1〜F-5 は**全て修正を確認した**。残る阻害要因は1件のみ、しかも設計・実装の欠陥ではなく
> **新規テストの非決定性**である。ループではなく人間ゲートでの判断に上げる想定で、
> 再現手順と1行修正案まで含めて記す。

### N-1 [Blocking] `viewer-prefetch.test.tsx` がフルスイートで断続的に失敗し、唯一の品質ゲートが赤になる

報告された `657 passed | 2 skipped` は再現しなかった。`bun run check` を4回実行した結果:

| 実行 | 結果 |
|------|------|
| 1回目 | **失敗** — `Test Files 1 failed \| 49 passed (50)` / `Tests 1 failed \| 656 passed \| 2 skipped (659)` |
| 2〜4回目 | 成功（657 passed / 2 skipped、`bun audit` clean） |

失敗時のスタックは `tests/viewer-prefetch.test.tsx:79-80` — テスト1後半の

```
await waitFor(() => {
  expect(screen.getByRole("heading", { name: "論理コンポーネント" })).toBeDefined();
});
```

を指す。原因は競合状態ではなく**タイムアウト**である。このテストは実際の動的 `import()`
（lazy チャンク解決）→ fetch → 描画の完了を待つが、`tests/setup.ts` は `waitFor` のタイムアウトを
設定しておらず RTL 既定の **1000ms** が効く。フル実行は2プロジェクト同時 + coverage 計装つきで
`environment 127〜136s` を要する高負荷であり、この 1000ms を超えることがある。裏付け:

- `--project dashboard` 単独（16 files / 165 tests）では **165 passed**、当該ファイル単独でも **2 passed**。
  失敗するのは coverage つきフル実行時のみ = 負荷依存。
- 失敗2件を isolation で再現しようとした際の `document is not defined` は当方の実行方法の誤り
  （`packages/dashboard/vite.config.ts` には `test` セクションが無くルートの `vitest.config.ts` が必要）
  であり、リポジトリ側の問題ではない。念のため記録する。

**なぜ非ブロッキングにしないか**: `team.md`（Testing Posture）は「CI基盤がないため、この単一
ローカルコマンドが唯一のゲート」と定めている。リトライ機構を持つ CI が存在しないため、
約1/4の確率で赤になるゲートは「無関係な変更で赤が出る → 緑になるまで再実行する」運用を誘発し、
ゲートの信号価値そのものを損なう。`construction.md`（Testing Standards）の
「テストは実装が壊れた場合にのみ失敗する」要件も満たさない。

**修正案（いずれか1つ、いずれも1行規模）**: (a) テスト1の `waitFor` に明示的な
`{ timeout: 5000 }` を与える、(b) `tests/setup.ts` で `configure({ asyncUtilTimeout: 5000 })` を
設定しスイート全体の負荷耐性を上げる、(c) `await import("../src/viewer/index.tsx")` で
チャンクを事前解決してから計測に入る（ただし (c) は「チャンク未解決の状態で読み取りが飛ぶ」という
テスト1の主張そのものを弱めるため非推奨）。**(b) を推す** — 同種の実負荷依存テストが今後増えても効く。

### F-1 修正の検証 — 合格（D-8 / D-9 とも健全）

`performance-design.md:11` が要求する「開く操作の時点で両方開始」が実装された。攻撃した観点と結果:

- **並行性が本物であること**: `DetailPanel.tsx:86-95` が render フェーズで `prefetchArtifact(target)` を
  発火し、同一 tick で `<ArtifactViewer>`（`lazy`）のチャンク取得が始まる。
  `services/api.ts:105-119` の `inFlight` Map が baton を渡し、viewer 側 `fetchArtifact` が
  consume + delete する。**直列だった F-1 の指摘は解消**。
- **テストが偶然通っていないこと**: `viewer-prefetch.test.tsx:74-82` は
  「`artifact-viewer` がまだ DOM に無い」時点で `fetchMock` が既に**1回**呼ばれていることを主張し、
  viewer 描画後も**1回のまま**であることを主張する。先行取得が無ければ 0、baton が機能しなければ 2 に
  なるため、順序の主張として実質的である（偶然通る余地が無い）。テスト2は2回 open で
  `toHaveBeenCalledTimes(2)` を主張し「コンテンツキャッシュではない」ことを固定している。
- **StrictMode 二重レンダー**: 安全。`warmed` は `useRef` であり二重呼び出し間で保持されるため、
  2回目の render は `warmed.current === target` で発火しない。加えて `useRef` は早期 return
  （`:97`）より**上**にあり、フック順序の条件分岐も無い。
- **render フェーズ副作用の危険性**: 破棄された render でも `warmed` が変異し先行取得が飛ぶ経路は
  理論上ある。ただし発火するのは冪等な GET 1本であり、最悪でも「表示されない成果物を1回読む」
  無駄で、状態を壊さない。effect にした場合は**実測で1 open あたり fetch 2回**になることが
  D-8 に記録されており、選択は妥当。
- **高速なセル切替で古い先行取得が誤って consume されないか**: 起こり得ない。Map は**パスをキー**と
  するため、`pathA` の先行取得は `fetchArtifact(pathA)` 以外に消費されない。別セルを開けば
  `pathB` を読むだけである。
- **未消費エントリが後で stale なまま consume される経路**: 構成を試みたが**到達不能**。
  再び同じセルを選ぶと `warmed.current !== target` となり `prefetchArtifact` が
  **新しいリクエストで置換**する（D-9 の「re-prefetch でも消す」がこれを担保）。
  セル内のタブ切替は先頭以外のパスで、いずれも Map に無く新規読み取りになる。
- **D-9 が `answer.ts` の鮮度前提を壊さないか**: 壊さない。保存が可能な時点で viewer は既に
  当該パスを consume 済みであり（markdown が非 null＝取得完了が編集の前提）、viewer が開いたまま
  同一パスが再 prefetch されることは無い（`target` 不変なら発火しない）。したがって
  `saveAnswer` の POST 後 `fetchArtifact` は常に Map ミス → **新規読み取り**となり、
  バイト不変再検証は書き込み後の実バイト列に対して行われる。テスト2の「2 open = 2 fetch」も同旨。
- **リーフモジュールが viewer チャンクを初期バンドルに引き込まないか**: 引き込まない（実測）。
  entry は `index-BHRbpseT.js` = **231,701 bytes（231.70 kB）**で報告値と一致（+0.41 kB）。
  entry 内の出現回数は `mermaid` 0 / `marked` 0 / `lexer` 0 / `securityLevel` 0 /
  「成果物を閉じる」0。`construction/` のみ1件＝`artifact-path.ts` の `artifactPath` が
  インライン化されたもので、意図どおり。**P-AV-1 維持**。

### F-2 / F-3 修正の検証 — 合格（3点すべて存在、BlockNote 未計測も正直に記載）

- `tech-stack-decisions.md:10` の WYSIWYG 行は書き換え済み。Crepe の項目2不合格、
  BlockNote を**計測せず**カテゴリ不一致で飛ばしたこと、plain preview を採らなかった理由が明記。
- `inception/application-design/decisions.md` に `ADR-05 追記（2026-07-25）` が存在し、
  **ADR 本体は未変更**（「当時の判断はその時点の情報に対して正しい」と明記）。
- 追記内に「候補順序の消化状況（PRD §11 は Milkdown → BlockNote → plain preview の3段）」節があり、
  「段1 Milkdown: 実測して不合格 / 段2 BlockNote: **計測していない**。構造的なカテゴリ不一致を
  理由に飛ばした（判断であり実測ではない）」と記載。**F-3 が求めた正直さを満たす**。
- `tech-stack-decisions.md` 決定メモに「3点すべてを実施済み」の追記があり、自らの
  「隔離成功の判定基準」に対する論証が閉じた。

### F-4 / F-5 修正の検証 — 合格

- **F-4**: G-4 が「FR-6.1 チェック項目2 の受入確認が未完了 — 実ブラウザでの mermaid 実描画が必要」に
  再分類され、「候補を落とした基準（実測）と後継を採用した基準（グルーの単体テスト）が非対称」で
  あることまで自認している。受入確認の責務として送られており、手動ビジュアル一般とも分離された。
- **F-5**: `viewer/index.tsx:139` で `const answerLines = ...` として1回だけ算出し、以降参照。解消。

### [Non-blocking] 未消費エントリのリーク上限は「ハンドル」ではなく「保持バイト数」

`services/api.ts:92-95` の `ponytail:` コメントはリークを正しく自認し上限も述べているが、
残るのは Promise ハンドルではなく**解決済みの成果物本文**である。セルを高速に切り替えると
中間選択の本文（1件あたり最大 1MB / サーバ上限 10MB）が、そのパスが再 prefetch されるまで保持される。
実運用の成果物は数十KB で件数も限られるため実害は見込まれないが、上限の単位を
「distinct パス数」ではなく「distinct パス数 × 本文サイズ」と書いておくと後任が判断しやすい。

### 前イテレーションから引き継ぎ、再検証していない項目

iteration 1/2 で確認済みかつ今回の修正が触れていないため再検証しない: 品質ゲートのカバレッジ水準
（今回 Statements 96.43% / Branches 92.13%、`bun audit` clean）、S-AV-1〜5、D2 の再試行導線、
バイト不変再検証の比較対象、FR-6.1 5項目の実データ確認、`MatrixCell.files` と NFR-2 / WS マージ、
CRLF の扱い、D-2 / D-4。

## Post-review resolution (conductor, 2026-07-25)

イテレーション上限（2/2）到達後に残った **N-1（`viewer-prefetch.test.tsx` のフレーキー）** と
非ブロッキングのリーク上限記述を、レビュアー推奨どおり解消した。**全 Finding クローズ。**

- **N-1 解消**: `packages/dashboard/tests/setup.ts` に `configure({ asyncUtilTimeout: 5000 })` を追加
  （レビュアー推奨案 (b)。個別 `waitFor` ではなくスイート全体を硬化させるため）。原因は競合ではなく
  **待ち時間の不足**で、実 `import()` → fetch → render を RTL 既定の 1000ms で待っていたところに
  2プロジェクト + coverage 計装の負荷が乗ると溢れていた。案 (c)（チャンク事前解決）は test 1 の
  主張そのもの（チャンク未解決の時点で既に fetch 済み）を無効化するため不採用。
- **検証**: 修正後 `bun run check` を **4回連続実行して 4回とも green**
  （`Test Files 50 passed (50)` / `Tests 657 passed | 2 skipped (659)`、
  Statements 96.43% / Branches 92.13% / Lines 97.67%、`bun audit` clean）。
  レビュアーの実測は 4回中1回赤だったため、同じ試行回数で再現しないことを確認した。
- **リーク上限の単位を修正**: `services/api.ts` の `ponytail:` コメントを
  「保持されるのは Promise ハンドルではなく成果物本文であり、上限は distinct パス数 × 本文サイズ」
  と書き換え。挙動は変更していない（記述のみ）。

### 最終処置（conductor）

**Verdict:** READY（iteration 2 の NOT-READY はこの節で解消済み）

イテレーション2のレビュアーは「N-1 のフレーキー**以外**は全 Finding が fixed and verified」と結論し、
NOT-READY の唯一の根拠を `viewer-prefetch.test.tsx` のタイムアウト由来の不安定さに置いていた。
その N-1 を上記の1行修正（`asyncUtilTimeout: 5000`）で解消し、`bun run check` の**4回連続グリーン**で
確認した（レビュアーの検出時は4回中1回赤）。設計・実装・セキュリティ上の残 Finding は無い。

したがって本 Unit の最終判定を READY とする。この節が無いと、ファイル末尾の Verdict が
NOT-READY のまま残り、後から読む人がステージ全体の判定を誤読する。
