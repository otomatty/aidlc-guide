# Dashboard インテント表示ピン設計

日付: 2026-08-27
状態: レビュー待ち
対象: `packages/api-core`, `packages/reader-core`, `packages/shared-types`, `packages/dashboard`, `packages/vscode-extension`, `packages/dashboard-server`（ルート配線のみ）

## 1. 背景と目的

Dashboard（VS Code webview と dashboard-server / Mob）は、表示対象レコードを
`active-intent` カーソルで決めている。カーソルを切り替えるには `/aidlc intent`
が必要で、ビューアである本ツールがエンジンの作業対象に結合している。

本変更の目的は、`aidlc/spaces/<space>/intents/` にあるレコードをアプリ内で選んで
表示すること。カーソルは読まない・書かない。MCP / `btw` / `/aidlc` は今どおり
カーソルを使う。

## 2. 決定事項（承認済み）

| 論点 | 決定 |
|------|------|
| サーフェス | Dashboard 全体（webview + dashboard-server / Mob）。MCP は対象外 |
| ピンの置き場 | `GuideService` の可変表示ピン（アプローチ 1） |
| 初期表示 | 前回選択を復元。無ければ lone-intent。それ以外は未選択 |
| 永続化 | VS Code は `workspaceState`。dashboard-server はプロセスメモリのみ |
| カーソル | 表示の入力に使わない。ファイルにも書かない |
| space | 切替しない。現行の space 解決（`active-space` または `default`）内の intent だけ |

## 3. 境界

表示対象の唯一のソースは `GuideService` が持つ表示ピン（intent のディレクトリ名）
である。`recordDir()` はピンが列挙 `all` に含まれるときだけそのレコードパスを返す。

**動かすもの**

- `api-core` の `GuideService`（ピン保持、切替、watch 張り直し、matrix キャッシュ破棄）
- `reader-core` の record 解決（構築時の固定パスではなく、呼出ごとにピンを見る）
- `dashboard` の IntentPicker と空状態
- VS Code `workspaceState` への slug 保存・復元
- VS Code doctor の intent チェック（レコードが 1 件以上あれば準備完了）

**動かさないもの**

- MCP / `btw` / `/aidlc` のカーソル解決
- `aidlc/spaces/*/intents/active-intent` への書き込み
- エンジンの `/aidlc --doctor`
- space 切替 UI
- UI 上の「AIDLC のアクティブ」表示（`IntentList.active` はワイヤに残し、Dashboard は使わない）

構築時 `GuideServiceConfig.recordDir`（テスト用の固定パス）は残す。それが無いときだけ
表示ピンを使う。

## 4. ピンの選挙と起動

純関数（これ以外の入力を見ない）:

```
electSelected(all, persisted) =
  persisted が all に含まれる → persisted
  all.length === 1 → all[0]
  それ以外 → null
```

カーソル（`active`）は見ない。削除済み slug は `all` に含まれないので第一枝が外れ、
残件 1 ならそれに落ち、複数なら未選択になる。

**起動**

- VS Code: `workspaceState` キー `aidlcGuide.selectedIntent` の文字列を
  `persisted` にする。locale の `globalState` とは別（ワークスペースごとに intent 名が違う）。
- dashboard-server: `persisted` は常に `null`。
- `GuideService` は vscode を知らない。`initialSelected?: string | null` と
  `onSelect?: (slug: string | null) => void` だけ受け取る。

ピンが選挙結果と食い違ったら（削除など）、メモリ上のピンを選挙結果に合わせ
`onSelect` を呼ぶ。`onSelect` が失敗してもメモリ上のピンは残す。

**reason の分岐**

| 条件 | `recordDir()` / workflow の reason |
|------|------|
| `all.length === 0` | `no-active-intent`（作成ウィザードを出してよい） |
| `all.length > 0` かつピンなし | `no-selected-intent`（新設。ウィザードは出さない） |
| ピンが `all` に含まれる | そのレコードパス |

`no-selected-intent` を `StandardReason` に追加する。各サーフェスの
`Record<StandardReason, string>` に文言を足す（コンパイラが漏れを止める）。
Dashboard の文言は「インテントを選んでください」。MCP は Dashboard ほど
この reason に出会わないが、語彙を共有するので文言は置く。

## 5. API

### `IntentList`

```
{
  space: string
  active: string | null   // カーソル。reader-core が今どおり埋める。Dashboard は使わない
  all: string[]
  selected: string | null // 表示ピン。reader-core は常に null。api-core が載せる
}
```

`GET /api/intents` は reader の一覧に `selected` を載せて返す。

### `POST /api/select-intent`

リクエスト: `{ "intent": "<dir name>" }`

受理条件: `intent` が文字列で、`all` に含まれる。パス区切り、`..`、空文字は拒否。

| 条件 | 応答 | 副作用 |
|------|------|------|
| 受理 | 200、更新後の `IntentList` | ピン更新 → `onSelect` → watch 張り直し → matrix キャッシュ破棄 → `startMatrixBackground` → `intent-selected` を broadcast |
| 未知・不正 | 400。ピンも watch も不変 | なし |
| `hostMode` | 403。同様 | なし |

ディスク（`aidlc/` 配下）は書かない。これは `[Answer]:` ではない。aidlc への書き込み
ゼロを維持する（NFR-1）。

既存の POST 振り分けに足す: `dashboard-server` の `/api/answer` 分岐と、拡張
`GuideSession.handlePost`（いま `/api/answer` 以外は `UNKNOWN_ROUTE`）。どちらも
同じ `api-core` ハンドラを呼ぶ。

切替 POST は `GuideService` 内で直列化する。並行クリックで watch が二重に付かない。

同一ピンの再選択は 200 で、watch 張り直しは省略してよい。

### Push

`WsMessage` に `{ type: "intent-selected" }` を追加する。ペイロードは持たない。
受信側は既存の `refetchAll` で workflow / matrix / intents を揃える。Mob 参加者が
ドライバーの切替に追従するために push が必要（POST したタブの refetch だけでは足りない）。

### Dashboard の POST 契約

いま Dashboard が発行してよい POST は `POST /api/answer` だけ（S-UI-1）。
許可を「answer（ディスク）と select-intent（メモリピン）」の 2 つに広げる。
select-intent のクライアントは `packages/dashboard/src/services/` の専用モジュール
1 ファイルに閉じ、artifact-viewer の answer モジュールとは混ぜない。

## 6. UI

### IntentPicker

- トリガー表示: `selected`、未選択なら「未選択」。`active` も `workflow.project` も使わない。
- ダイアログの各行はボタン。選ぶと `POST /api/select-intent`。成功で閉じる。失敗は開いたまま短いエラー。送信中は行を無効化。
- 表示中の行: ✔ + 「（表示中）」+ `data-selected` の三重表現（色だけに依存しない）。
- `/aidlc intent` 案内（`INTENT_SWITCH_HINT`）は削除する。
- 自動オープン: `all.length > 0 && selected === null` のとき。

### 空状態

| reason | NowStrip |
|------|------|
| `no-active-intent` | 現行。webview なら PreflightWizard。コピーから CLI 切替案内を削除 |
| `no-selected-intent` | 見出し「インテントを選んでください」。作成ウィザードなし。Picker 自動オープン |
| `state-missing` | 現行（作成案内なし） |

「ワークフローはまだありません」は `no-selected-intent` には使わない。

### Mob（`hostMode`）

行はボタンにしない（いまと同じ閲覧リスト）。注記「表示の切替はドライバー側から」。
サーバも POST を 403 にする。ドライバーは VS Code（hostMode ではない）から切り替える。

## 7. 監視の張り直し

ピン変更時:

1. 前の `unwatch()` を呼ぶ
2. 未選択なら監視しない
3. 選択ありなら新しいレコードで `startWatch()`
4. matrix キャッシュを捨て `startMatrixBackground()` する

古い watch の遅延イベントは世代番号で捨てる。新しいレコードの watch 開始に失敗したら
ピンは更新済みのまま、既存の `live-status` 縮退を出す。

`[Answer]:` と `open-file` の record 基準は、その時点の `recordDir()` を使う。
切替専用の分岐は足さない。

`createReader` は構築時 string 固定ではなく、呼出ごとに `GuideService` の
`recordDir()` を見る（いまカーソルを毎呼出で再解決しているのと同じ形）。

## 8. VS Code doctor

拡張の doctor / setup パネルの intent チェックは「`aidlc/spaces/<space>/intents/` に
レコードディレクトリが 1 件以上あること」とする。`active-intent` ファイルの有無は見ない。
エンジンの `/aidlc --doctor` は変更しない。

## 9. テスト（`bun run check` に含める）

- `electSelected`: persisted 命中 / 孤立 1 件 / 複数で persisted なし / 削除済み slug
- `POST /api/select-intent`: 成功・未知名・hostMode・パストラバーサル
- 成功パスで `active-intent` ファイルが作られも更新されもしないこと（否定テスト）
- 未選択かつ複数レコードで workflow が `no-selected-intent`
- レコード 0 件で workflow が `no-active-intent`（ウィザード分岐が壊れないこと）
- 切替後、古い dir の watch イベントを無視し、新しい dir の変更を push すること
- IntentPicker: 行クリックで POST、表示中の三重表現、`no-selected-intent` で自動オープン、hostMode ではボタンなし
- 拡張: `workspaceState` の保存と復元（locale テストと同じ、コンテキストのスタブ）

MCP / `btw` の既存テストは変えない。カーソル解決の reader-core テスト
（`electActive` / `resolveRecordDir`）も、MCP 用の経路として残す。

## 10. 対象外

- MCP ツールの表示対象をピンに追従させること
- `/aidlc intent` の代替としてのカーソル書き込み
- space ピッカー
- 表示中と AIDLC アクティブが違うときのバッジ
- dashboard-server 再起動をまたぐ永続化
