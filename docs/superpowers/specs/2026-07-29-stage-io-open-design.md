# ステージ詳細の入力/出力クリックで成果物を開く — 設計

- 日付: 2026-07-29
- 対象: `dashboard` / `api-core` / `vscode-extension`（必要なら `reader-core` / `shared-types`）
- 状態: ブレインストーミング承認済み（Approach A）

## 目的

VS Code 拡張のステージ詳細（`StageCard`）に表示されている「入力」「出力」の箇条書きのうち、**実在する成果物**をクリックすると、対応するファイルを **エディタの横隣（Beside）** で開く。

詳細パネル（Webview）は閉じず、Unit タブで見えている Unit を開く対象の基準にする。ファイルが無い項目は最初からリンクにしない。

## 背景（現状）

- `StageCard` の `List` は `doc.inputs` / `doc.outputs`（`bridge-map.json` の論理名）をプレーンな `<li>` で描画しているだけである。
- 論理名はパスでもファイル名でもない（例: `code-summary`, `requirements`）。実ファイルは概ね `{name}.md`。
- 実体の置き場は一様ではない:
  - **UNIT-SCOPED**: `construction/{unit}/{producerStage}/{name}.md`
  - **SHARED**: `ideation|inception|operation/{stage}/{name}.md` など intent 配下に一意
  - **STAGE-DIR**: `construction/{stage}/{name}.md`（Unit 配下ではない）
  - **MISSING**: この intent にファイルが無い（未着手・スキップ）
- 詳細下部の Unit タブ（`StageArtifacts`）はローカル `useState` のみで、`AppState.selected` には書き戻さない。Stage rail 起点では `selected` に Unit が無い。
- 既存の `open-file` はワークスペース相対の引用解決用で、record 相対の成果物パスや `ViewColumn.Beside` を想定していない。

## 採用方針: Approach A

1. Unit タブの表示中 Unit を `DetailPanel` に持ち上げ、`StageCard` と共有する。
2. 論理名 → record 相対 path の解決を **`GET /api/io-paths`** に寄せ、`path !== null` の項目だけリンク化する。
3. クリックは既存チャネルを拡張し、record 上で解決して **Beside** で開く。

却下した案:

- **すべてクライアント＋matrix のみ** — SHARED / STAGE-DIR の存在判定ができない。「無いものはリンクにしない」を満たせない。
- **タブ変更のたびに名前ごとの個別 resolve** — チャットィ。バッチ1本の方が単純。
- **マトリクスに載る出力だけリンク** — Construction の入力（Inception 成果物）が開けず要件不足。
- **QuickPick / 専用戻るボタン** — Unit はタブ、戻りは Beside 並置で足りる。

## 要件（確定）

| 項目 | 決定 |
|------|------|
| 表示先 | VS Code テキストエディタ |
| 開き方 | `ViewColumn.Beside`。Webview は残す（`retainContextWhenHidden` 済み） |
| Unit の定義 | 詳細パネル下部 Unit タブで今見えている Unit |
| 欠損 | 最初からリンクにしない（プレーンテキスト） |
| ブラウザ Dashboard | ファイルオープンしない（常にテキスト） |
| 戻る専用 UI | 作らない |

## データモデル

`shared-types` に追加する（名前は実装時にパッケージ慣習へ合わせてよい）。

```ts
/** GET /api/io-paths の value。キーは bridge-map の論理名。 */
export interface StageIoPaths {
  stage: string;
  /** 解決に使った Unit。タブ無し / 非 Construction では null。 */
  unit: string | null;
  /** 論理名 → record 相対 POSIX path。無い・曖昧なら null。 */
  inputs: Record<string, string | null>;
  outputs: Record<string, string | null>;
}
```

`StageDoc.inputs` / `outputs` の `string[]` はそのまま残す。リンク可否は `StageIoPaths` が担う（説明文のソースと解決結果を分離する）。

## API

### `GET /api/io-paths?stage=<slug>&unit=<optional>`

- `stage` 必須。未知 slug は既存 stage-doc と同様 `not-found`。
- `unit` 省略可。省略時は UNIT-SCOPED を解決できず、該当名は `null`（SHARED / STAGE-DIR のみ埋まる）。
- 返却の `inputs` / `outputs` のキー集合は、そのステージの bridge-map エントリと一致させる（値が全部 `null` でもキーは出す）。
- 読み取り専用。aidlc ワークスペースへの書き込みなし。

### 解決規則（サーバー）

ファイル名候補は `{logicalName}.md` のみ（拡張子付き論理名は来ない前提。来た場合は正規化して同じ規則）。

active record 配下で `{name}.md` を探す（実装は reader に寄せてよい）。

優先順:

1. **`unit` 指定あり** — `construction/{unit}/` 配下の `{name}.md` だけを候補にする（他 Unit は見ない）。
   - 0件 → 次へ。
   - 1件 → それを採用して終了。
   - 複数件（同じ Unit の別ステージに同名）→ パスのステージセグメントがリクエストの `stage` と一致するものを優先。それでも複数 / 0件なら候補を POSIX パス辞書順で先頭1件。**この段階で採用したら SHARED には落とさない。**
2. **STAGE-DIR**: `construction/{stageSlug}/{name}.md` 形式（`construction/` 直下のステージディレクトリ）で record 内が一意なら採用。
3. **SHARED**: `construction/` 以外（`ideation/` / `inception/` / `operation/` 等）で `{name}.md` が一意なら採用。
4. それ以外（0件、または手順2–3で複数ヒット）→ `null`。

「リンクにしない」ため、**指定 Unit 以外の Unit 配下ファイルを推測で返してはならない**。Unit タブと矛盾するパスを返さないことが第一条件である。

## UI / 状態

### Unit の持ち上げ

- `DetailPanel` が `activeUnit: string | null` を持つ。
- 初期値: 現行 `resolveArtifactCells` の `initialUnit` と同じ（セル選択ならその Unit、stage 選択なら成果物のある先頭 Unit）。成果物セルが無ければ `null`。
- `StageArtifacts` は controlled: `unit` + `onUnitChange`。タブ変更は `activeUnit` を更新するだけ。
- `StageCard` は `activeUnit` と `ioPaths`（下記）を受け取る。

### io-paths の取得

- パネルに `stage`（slug）があるとき `/api/io-paths` を取得する。`activeUnit` が有れば `unit` クエリに付け、無ければ省略（SHARED / STAGE-DIR のみ埋まりうる）。
- `activeUnit` 変更で再取得（または `stage+unit` キーのセッションキャッシュ）。失敗・loading 中は全項目非リンク（`StageDoc` の説明表示は継続）。
- リンク化自体は VS Code webview のみ（`inVsCodeWebview` / 既存 IDE ガードと同系）。ブラウザでは取得してもボタンにしない。

### `StageCard` の List

- `path !== null` かつ IDE オープン可能なときだけリンク（`<button type="button">` または同等）。クリックで open メッセージ。
- それ以外は現状どおりテキストの `<li>`。
- 空配列は現状どおり「（なし）」。

## 拡張ホスト: ファイルを開く

### メッセージ

既存 `open-file` を拡張する（新タイプでもよいが、チャネルは1本に保つ）:

```ts
{ type: "open-file"; path: string; line: number | null; beside?: boolean; base?: "workspace" | "record" }
```

- ステージ I/O からの呼び出し: `beside: true`, `base: "record"`, `line: null`。
- 成果物ビューア内のコード引用（現行）: 従来どおり（`beside` 省略 / `base: "workspace"`）。挙動を変えない。

### ホスト処理

- `base === "record"`: active `recordDir` をルートに `guardPath`（または同等）してから開く。record 外は拒否して警告。
- `beside === true`: `showTextDocument` / `vscode.open` を `ViewColumn.Beside` で行う。Webview のフォーカスを無理に取り戻さない。
- ファイル無しは警告（描画時にリンク化済みなら稀）。

## エラーと劣化

| 状況 | 扱い |
|------|------|
| `/api/io-paths` 失敗・loading | 入力/出力はすべて非リンク |
| 論理名に対応ファイルなし | その項目だけ非リンク |
| Unit タブなし（`unit=null`） | SHARED / STAGE-DIR のみリンク化しうる |
| ブラウザ | 常に非リンク |
| record 解決失敗で open | 警告メッセージ。Webview は維持 |

## テスト

- **解決**: UNIT-SCOPED（指定 Unit のみ）/ SHARED 一意 / STAGE-DIR / 欠損→null / 他 Unit のみに存在→unit 指定時 null。
- **UI**: `activeUnit` 変更でリンク集合が変わる。path 無しはボタンが無い。
- **ホスト**: `base: "record"` + `beside: true` で Beside。workspace 引用の既存テストは回帰しない。
- **非 VS Code**: リンク化しない。

## 主な変更ファイル（想定）

- `packages/dashboard/src/components/DetailPanel.tsx`
- `packages/dashboard/src/components/StageArtifacts.tsx`
- `packages/dashboard/src/components/StageCard.tsx`
- `packages/dashboard/src/services/api.ts` / `docs.ts`（または open ヘルパー）
- `packages/api-core/src/handlers/read.ts`（+ reader ヘルパー）
- `packages/shared-types/src/index.ts`
- `packages/vscode-extension/src/open-file.ts`
- `packages/vscode-extension/src/dashboard-panel.ts`
- 対応テスト

## スコープ外

- bridge-map の論理名や成果物命名の是正
- ブラウザでのファイルオープン
- 詳細パネル内 ArtifactViewer への切替
- エディタ側の「Guide に戻る」ボタン
- aidlc-workflows コアや監査ログ形式の変更

## 実装順序（概略）

1. `StageIoPaths` 型 + `/api/io-paths` 解決（テスト先）
2. 拡張: `open-file` の `base` / `beside`
3. Unit state の持ち上げ + StageCard リンク化 + 取得ワイヤリング
4. 結合テスト / 手動: Unit タブ切替 → リンク変化 → Beside で開く
