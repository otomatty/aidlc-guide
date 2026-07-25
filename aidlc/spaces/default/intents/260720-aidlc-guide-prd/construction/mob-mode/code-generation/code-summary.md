# Code Summary — Unit: mob-mode

> code-generation (3.5) / Unit: mob-mode / 2026-07-25
> 実装場所: 既存 `packages/dashboard-server/src/` と `packages/dashboard/src/`
> （新パッケージ・新プロセスなし — ADR-04）

## 実装した差分 vs. 要求・検証しただけの範囲

BLM 冒頭の U5 所有表に従い、**本 Unit は U5 のサーバ挙動に1行も足していない**。

| 挙動 | 実装所有 | 本 Unit の作業 |
|------|---------|---------------|
| bind 分岐（既定 `127.0.0.1` / `--host` で `0.0.0.0`） | U5 `server.ts:110` | **変更ゼロ**。smoke テストで検証のみ |
| 公開警告文言 `HOST_EXPOSURE_WARNING` | U5 `server.ts:24` | **変更ゼロ**。`exposure-notice.ts` が **import** して束ねる（S-MM-2 複製禁止） |
| `serverMode.hostMode` を `GET /api/workflow` に載せる | U5 `handlers/read.ts:63` | **変更ゼロ**。smoke テストで検証のみ |
| hostMode 中の `POST /api/answer` 403 | U5 `handlers/answer-writer.ts:153` | **変更ゼロ**。smoke テストで検証のみ |
| 全クライアント同一の WS broadcast | U5 `push.ts` | **変更ゼロ** |
| 待受アドレスの列挙・提示（M1） | **本 Unit** | 新規 `exposure-notice.ts` + `cli.ts` 配線 |
| ReadOnlyBadge（M2） | **本 Unit** | 新規 `ReadOnlyBadge.tsx` |
| LiveStatus 4状態（M3） | **本 Unit** | 新規 `liveStatusView.ts` + `LiveStatus.tsx` + `live` スライス拡張 |

**S-MM-3（403 を構造的に迂回できない）**: 本 Unit は書込 API を**1つも定義しなかった**。
`dependency-direction.test.ts` の「POST を出すモジュールは
`viewer/services/answer.ts` のちょうど1つ」「`fetch` を呼ぶのは2モジュールだけ」の
両アサーションは無改修のまま緑 — 本 Unit がネットワーク面を増やしていないことの機械的証拠。

**S-MM-6 / BR-MM-1（実行中不変・暗黙の有効化なし）**: 新規コードは `process.env` も
`import.meta.env` も設定ファイルも読まない。公開に至る経路は `parseArgs` の `--host`
アームただ1つで、`server.ts` の2つの `hostMode` シンクはどちらも `config.host` 由来。
トグル API は定義していない。

> **レビュー是正（初回の記述は誤り）**: 当初「`readonly` にして型でも表した」と書いたが、
> `readonly` はそのオブジェクトへの**代入**を止めるだけで、reducer が別の値を持つ
> **新しい state オブジェクトを組み立てる**ことは止めない。実際クライアント側の
> `AppState.hostMode` は読み取り失敗で `false` に落ちていた（下記「hostMode の粘着性」）。
> 現在の実行時不変性を担保しているのは以下であり、`readonly` は補助的な文書化にすぎない:
>
> | 面 | 実際の担保 |
> |----|-----------|
> | サーバ | `--host` アーム1つだけが `host: true` を作る。env/config を読む経路が存在しない（`process.env` 等の grep でゼロ件） |
> | クライアント | `reducer.ts` の `hostMode: hostMode ?? state.hostMode` — **成功した `/api/workflow` だけ**が値を変えられる。失敗は `deriveWorkflow` が `null`（＝不明）を返し、直前の値が残る |
> | 型 | `readonly` は既存オブジェクトへの再代入を防ぐのみ。単独では不変性を保証しない |

**SC-MM-2**: 接続数の上限チェックコードは書いておらず、LiveStatus の表示要素にも
接続数は含まれない（表示は4状態の文言のみ）。

## 生成ファイル

| ファイル | 役割 | 行数 |
|---------|------|-----|
| `packages/dashboard-server/src/exposure-notice.ts` | `buildExposureNotice(port, host)` + `EXPOSURE_ADDRESS_HEADING`。U5 警告定数の import・IPv4 列挙・失敗時空配列 | 56 |
| `packages/dashboard/src/store/liveStatusView.ts` | `LiveSlice → LiveStatusView` の純関数（4 variant） | 29 |
| `packages/dashboard/src/components/LiveStatus.tsx` | 4状態描画 + `relativeTime` / `liveStatusText`（純関数として export） | 69 |
| `packages/dashboard/src/components/ReadOnlyBadge.tsx` | `role="status"` バッジ | 18 |
| `packages/dashboard-server/tests/exposure-notice.test.ts` | M1 / S-MM-2（構造検査）/ S-MM-4 / R-MM-2 | 117 |
| `packages/dashboard/tests/mob-mode.test.tsx` | M2 / M3 / R-MM-3 + hostMode 粘着性の DOM 検証 | 278 |

`exposure-notice.ts` は `EXPOSURE_NO_ADDRESS_HINT`（一覧が空のときの案内）を含めて 66 行。

## `live` スライス拡張（4状態を表現するために必要だった変更）

設計は `AppState.live` を LiveStatus の唯一のデータ源と定めているが、実装済みの形
`{connected, degraded, reason?}` では **4状態のうち2つが表現できなかった**:

1. `connecting`（初回接続前）と `reconnecting`（切断後）はどちらも `connected=false` で、
   区別する情報が無い → 起動直後に「切断・再接続中…」と表示してしまう（= 嘘）。
2. 「最終更新 <相対時刻>」の時刻源が無い。

追加したのは2フィールドだけ:

| フィールド | 意味 | 嘘を防ぐ設計 |
|-----------|------|-------------|
| `everConnected: boolean` | socket が一度でも open したか | `live` アクション（`connected:true`）でのみ true に。REST 再取得では立たない |
| `lastChangeAt?: string` | **実際に受信した `change` push** の時刻 | 接続時刻を代入しない。未受信なら **undefined のまま**で、UI は「最終更新」節を出さない |

**触ったファイル（全件）**:

| ファイル | 変更 |
|---------|------|
| `packages/dashboard/src/store/state.ts` | `live` をインライン型から `LiveSlice` インターフェースに切り出し、2フィールド追加。`initialState.live.everConnected = false`。`AppState.hostMode` を `readonly` に |
| `packages/dashboard/src/store/deriveViewState.ts` | `deriveWorkflow` の `hostMode` 戻り値を `boolean` → **`boolean \| null`**。読み取り失敗時は `false` を捏造せず `null`（＝不明）を返す |
| `packages/dashboard/src/store/reducer.ts` | `workflow` ケースを `hostMode: hostMode ?? state.hostMode` に（成功した読み取りだけが値を変える）。`Action` の `ws` に `receivedAt: string`（**必須**）。`live` ケースで `everConnected` を立て `lastChangeAt` を持ち越す。`live-status` ケースを spread から**明示構築**に（`degraded:false` + reason 無しのメッセージが古い reason を残さないよう）。`change` ケースで全 scope に `lastChangeAt` を stamp |
| `packages/dashboard/src/services/live.ts` | `onmessage` で `receivedAt: new Date().toISOString()` を付けて dispatch |
| `packages/dashboard/src/components/Header.tsx` | `<LiveStatus live={state.live} />` に。import 先を新2ファイルへ |
| `packages/dashboard/src/styles/app.css` | `.live[data-state="disconnected"]` → `"reconnecting"`（`data-state` を `LiveStatusView.kind` と 1:1 に） |
| `packages/shared-types/src/index.ts` | `ServeOptions.host` / `ServerMode.hostMode` を `readonly` に（S-MM-6） |
| `packages/dashboard-server/src/cli.ts` | `buildExposureNotice` を起動時1回呼び、`--host` で警告 → 見出し → アドレス一覧を出力 |

`receivedAt` は `ws` アクションの**必須**フィールドにした。任意にして reducer 側で
`?? new Date()` を持つと、(a) reducer が純粋でなくなり、(b) 将来 dispatch を足した誰かが
渡し忘れても「最終更新が進まない」形で静かに壊れる。必須なら型で止まる。

### `change/audit` の扱いを変えた点（明示）

`change` は scope に関わらず `lastChangeAt` を進める（`audit` を含む）。audit push は
画面に何も描かないが、**watch パイプラインが生きている証拠**であり、
「最終更新」はライブ性の指標だからである。ビュー系スライスは audit では従来どおり一切動かない。
従来の `expect(after).toBe(before)`（ルート state の参照同一性）は `live` が正当に変わる
ようになったため成立しないが、**`live` 以外の全スライスを参照同一性で**回して assert する形に
置き換えた:

```ts
for (const key of Object.keys(before)) {
  if (key === "live") continue;
  expect(after[key], `audit push rebuilt the ${key} slice`).toBe(before[key]);
}
```

> **レビュー是正**: 初版は `workflow` / `matrix` の2スライスだけを参照比較し、残りを
> deep equality で見ていた。それでは `nextStep` / `intents` / `stageDoc` / `projectLinks` を
> 「等しいが新しいオブジェクト」に組み直す変更を素通ししてしまい、P-MM-2 が防ぎたい
> 再描画チャーンを検出できない。元アサーションが持っていた8スライス分の被覆を復元した。
> 同じ形を「matrix 未生成時の matrix scope push」テストにも適用している。

## hostMode の粘着性（レビュー指摘1・Blocking の是正）

**症状**: `deriveViewState.ts` が読み取り失敗時に `hostMode: false` を返し、`reducer.ts` が
それを無条件で採用していた。`refetchAll` は **WS 再接続のたびに**走るので、通信の瞬断・
`no-active-intent`・`state-missing` のどれでも `hostMode` が `true → false` に落ちる。
サーバは `--host` のままなので 403 は生きているが、クライアント側の表示だけが嘘になる:

| 落ちた先 | 破れる受入条件 |
|---------|---------------|
| `Header.tsx` の `{state.hostMode ? <ReadOnlyBadge/> : null}` | S-MM-5「3点を必ず提示。どれか1つでも欠けたら受入不可」 |
| `viewer/AnswerEditor.tsx` の `if (hostMode \|\| ...) return null` | 受入条件「参加者ブラウザの DOM に編集要素が存在しない」/ MA-3 |

**修正**（2箇所・各1行）:

```ts
// deriveViewState.ts — 知らないことを false と言わない
hostMode: "ok" in result ? result.value.serverMode.hostMode : null,

// reducer.ts — 成功した読み取りだけが値を変えられる
return { ...state, workflow, nextStep, hostMode: hostMode ?? state.hostMode };
```

`null`（不明）を経由させたのは、`false` を返してから reducer で捨てるより
「読み取り失敗はモードについて何も語らない」という事実を型で表せるため。
`??` であって `||` ではないので、`--host` なしで起動し直した場合の
`hostMode: false` は正しく反映される（古いバッジが残らない）。

**テスト**（レビュー指摘どおり2本。どちらも実際に退行を捕まえることを確認済み —
`?? state.hostMode` を `?? false` に戻すと2本目が落ちる）:

1. `reducer.test.ts`「keeps hostMode across a failed re-read」 — `hostMode:true` の後に
   `state-missing` / `no-active-intent` を流しても `true` のまま。かつ**成功した**読み取りで
   `false` に戻ることも確認（片方向に固まっていない）。
2. `mob-mode.test.tsx`「keeps the badge and the absent editor across a failed re-read」 —
   実際に `DetailPanel` から `React.lazy` の viewer を開き、`*-questions.md` を読ませた状態で
   失敗読み取りを dispatch し、`answer-editor` と `role="textbox"` が**現れない**こと、
   ReadOnlyBadge が**残る**ことを assert する。
   同じ成果物が `hostMode:false` では編集器を描くことを**ポジティブコントロール**として
   別テストで確認しているので、空振りのアサーションではない。

## atoms.tsx → 専用コンポーネントへの移設

`LiveStatus` / `ReadOnlyBadge` は dashboard-ui Unit で `components/atoms.tsx` 内に
プレースホルダとして存在していた。設計（logical-components.md）が専用ファイルを要求するため
移設し、**`atoms.tsx` 側は削除した**（二重実装を残していない）。

| | 移設前 | 移設後 |
|--|-------|-------|
| 実体 | `components/atoms.tsx`（`LiveStatus` / `ReadOnlyBadge`） | `components/LiveStatus.tsx` / `components/ReadOnlyBadge.tsx` |
| Props | `LiveStatus({connected, degraded, reason?})` | `LiveStatus({live: LiveSlice})`（導出は `liveStatusView`） |
| 状態数 | 3（live / degraded / disconnected） | **4**（connecting / live / reconnecting / degraded） |
| 文言 | 「ライブ同期中」「切断・再接続中」「read-only（--host）」 | BLM M3 / M2 の指定文言 |
| テスト | `tests/app.test.tsx` の `describe("LiveStatus (R-UI-5)")` 3ケース | `tests/mob-mode.test.tsx` に移設・**拡張**（17ケース）。`app.test.tsx` には移設先を示すコメントを残置 |
| `header.test.tsx` | `read-only-badge` の role 検査 | **そのまま緑**（testid / role を維持したため無改修） |

`data-testid` は `live-status` / `read-only-badge` のまま維持したので、既存の参照は壊れていない。

## 起動出力の実測（M1 / S-MM-4 / BR-MM-2）

`bun packages/dashboard-server/src/cli.ts --port 0 --host`:

```
警告: LAN に公開します。レンダリングされた aidlc 成果物・監査内容（ユーザーが貼り付けた秘密を含み得る）が同一ネットワークの全端末から閲覧可能になります。また --host 中は回答の書き込みが全クライアントで無効になります（read-only mode）。
参加者に共有する URL:
  http://10.5.0.2:60938
  http://192.168.0.189:60938
AIDLC Guide dashboard: http://0.0.0.0:60938
```

既定（`--host` なし）:

```
AIDLC Guide dashboard: http://127.0.0.1:60940
```

- 警告は U5 の定数そのもの。**根拠は構造検査**であって値比較ではない:
  `exposure-notice.test.ts` が `packages/dashboard-server/src/**.ts` を走査し、
  文言「警告: LAN に公開します」を含むファイルが `server.ts` **ちょうど1件**であること、
  かつ `exposure-notice.ts` が `import { HOST_EXPOSURE_WARNING } from "./server.ts"` を
  含むことを assert する。
  > **レビュー是正**: 初版はこれを「テストが参照同一性で assert している」と書いていたが、
  > `toBe` は文字列プリミティブでは値比較であり、`exposure-notice.ts` に文言を打ち直しても
  > 通ってしまう。複製検出は上記の構造検査が担っており、値比較の行は
  > 「文言が正しく届いている」ことの確認にすぎない。
- アドレス行は IPv4 とポートのみ。ホスト名・ユーザー名・ワークスペースパスを含まない
  （`exposure-notice.test.ts` が `os.hostname()` / `os.userInfo().username` / `process.cwd()`
  の非包含を assert）。
- loopback 起動ではアドレス一覧を印字しない — ready 行が唯一の URL そのものであり、
  同じ情報を2回出しても操作者の判断は変わらないため。
  `buildExposureNotice(port, false)` 自体は `["http://127.0.0.1:<port>"]` を返す（BLM M1 どおり、テスト済み）。
- **一覧が空のときは見出しを出さない**（NIC 列挙失敗 / 外部 NIC 無し / IPv6-only LAN）。
  代わりに `EXPOSURE_NO_ADDRESS_HINT` を1行出す — R-MM-2 の「警告のみ」を満たしつつ、
  URL を約束する見出しの下に何も出ない状態を作らない:

  ```
  待受アドレスを自動検出できませんでした（外部 NIC なし、または列挙に失敗）。公開自体は成立しています — `ipconfig` / `ifconfig` で自機の IPv4 を確認し、`http://<そのIP>:<ポート>` を参加者に共有してください。
  ```
- 警告が必ずアドレスより**先**に出ることを smoke テストで assert している
  （`indexOf(warning) < indexOf(heading)`）。

### smoke テストの READY 正規表現を修正した理由

`server-smoke.test.ts` は起動出力から `http://([\d.]+):(\d+)` で bind アドレスを取っていた。
`--host` でアドレス一覧が ready 行より**上**に出るようになったため、そのままでは
NIC アドレス（`10.5.0.2`）を bind アドレスとして誤認する。正規表現を ready 行の接頭辞
`AIDLC Guide dashboard: ` でアンカーした。**テスト側の読み取りの修正**であり、
「既定は 127.0.0.1」「`--host` は 0.0.0.0」というアサーション自体は弱めていない。

## 品質ゲート実測（`bun run check`） — レビュー是正後（2026-07-25 iteration 2）

```
$ biome check . && tsc --noEmit && tsc --noEmit -p packages/dashboard && vitest run --coverage && bun audit

biome check .                        Checked 155 files in 169ms. No fixes applied.
tsc --noEmit                         (エラーなし)
tsc --noEmit -p packages/dashboard   (エラーなし)
vitest run --coverage                Test Files  52 passed (52)
                                     Tests  685 passed | 2 skipped (687)
                                     Statements   : 96.53% ( 1504/1558 )
                                     Branches     : 92.6%  ( 989/1068 )
                                     Functions    : 96.78% ( 361/373 )
                                     Lines        : 97.73% ( 1336/1367 )
bun audit                            No vulnerabilities found

exit code 0
```

本 Unit 前は 50 files / **657 passed | 2 skipped**。差分 **+2 files / +28 tests**。
内訳: `mob-mode.test.tsx` 21 + `exposure-notice.test.ts` 7 + `reducer.test.ts` +4 +
`server-smoke.test.ts` +1（MA-5 自動化）、移設に伴い `app.test.tsx` から 3 減。
**既存テストの失敗はゼロ**。`live` スライス変更で影響を受けた assert は移設・強化して更新した
（`toEqual` に新フィールドを明記、ルート参照同一性 assert は「`live` 以外の**全スライス**を
参照比較 + `lastChangeAt` のみ前進」に置換）。弱めた assert は無い。

**レビュー是正で追加/変更したテスト**:

| テスト | 何を守るか |
|-------|-----------|
| `reducer.test.ts` keeps hostMode across a failed re-read | Blocking 指摘1 |
| `mob-mode.test.tsx` keeps the badge and the absent editor across a failed re-read | 同上（DOM 側の実害） |
| `mob-mode.test.tsx` positive control（hostMode=false で編集器が出る） | 上のアサーションが空振りでないことの担保 |
| `exposure-notice.test.ts` keeps the wording in exactly one source file | S-MM-2 の複製検出（値比較ではなく構造検査） |
| `server-smoke.test.ts` makes a bind failure fatal… | R-MM-1 / BR-MM-5（旧 MA-5） |
| `server-smoke.test.ts` 警告→アドレスの順序 assert | S-MM-2 の提示順 |
| `reducer.test.ts` 参照比較ループ ×2 | P-MM-2（再描画チャーン検出）の被覆復元 |

本 Unit の4ファイルの coverage（v8）:

| ファイル | Stmts | Branch | Funcs | Lines |
|---------|-------|--------|-------|-------|
| `dashboard-server/src/exposure-notice.ts` | 100 | 100 | 100 | 100 |
| `dashboard/src/store/liveStatusView.ts` | 100 | 100 | 100 | 100 |
| `dashboard/src/components/LiveStatus.tsx` | 100 | 100 | 100 | 100 |
| `dashboard/src/components/ReadOnlyBadge.tsx` | 100 | 100 | 100 | 100 |

（v8 text reporter は全指標 100% の行を表示しないため、上表は当該ファイルが
uncovered 行リストに現れないことをもって 100% と記録している。区分計は
`components` 94.57 / `store` 97.36 / `dashboard-server/src` 97.59 で、
いずれも team.md「UI 層 ライン カバレッジ ~80%」を上回る。）

## 手動受入項目（自動化していない — 偽装していない）

business-rules.md「受入条件」のうち、**別端末が必要な2件はこの環境で自動検証できない**。
ローカルの単一プロセスからは「LAN の別マシンから到達できるか」を確かめられないため、
到達性を偽装するテストは書かなかった。performance-validation（4.6）の実機モブで消化する:

| # | 受入条件 | 手順 | 期待 |
|---|---------|------|------|
| MA-1 | 既定起動でポートが LAN から到達不能 | ドライバー機で `bun run dashboard`（`--host` なし）→ 同一 LAN の別端末から `http://<ドライバーのIP>:4700` | 接続失敗（タイムアウト / connection refused） |
| MA-2 | `--host` 起動でポートが LAN から到達可能 | 同上を `--host` 付きで。起動出力に印字された URL を別端末のブラウザで開く | ダッシュボードが表示される。ReadOnlyBadge が見える |
| MA-3 | 参加者ブラウザの DOM に編集要素が存在しない | MA-2 の別端末で成果物セルを開き DevTools で確認 | `AnswerEditor` 由来の要素が無い（artifact-viewer S-AV-2 の実装。hostMode の DOM 不在は `viewer-answer.test.tsx` で自動検証済み — MA-3 は実機での再確認） |
| MA-4 | 参加者への反映時間が NFR-3（2秒）内（P-MM-3 / SC-MM-1） | MA-2 の状態で `aidlc-state.md` を更新し、別端末の Now strip 反映を計測（〜10接続） | 2秒以内 |
> **MA-5（bind 失敗＝起動失敗）はレビュー指摘を受けて自動化し、この表から外した。**
> 「レースの制御が要る」という当初の理由は成立していなかった — `start()` は子が ready 行を
> 出してから resolve し、早期終了は reject する。**A が listen 済みになってから B を spawn**
> するので待ち合わせは既に harness にある。
> `server-smoke.test.ts`「makes a bind failure fatal instead of falling back to loopback」
> が R-MM-1 / BR-MM-5 を検証する: A を `--host --port 0` で起動 → その port を B に渡して
> **同じく `--host`** で起動（両方 `0.0.0.0` にして Windows でも確実に EADDRINUSE にする）→
> B が非ゼロ終了し、stderr に理由と `--port` の対処が出て、**ready 行を1行も出さない**
> （＝黙って loopback で serve していない）こと、A が無傷で 200 を返し続けることを assert。

### この自動化が見つけた実バグ（U5 側・1行修正）

`cli.ts` の EADDRINUSE ヒントは `/EADDRINUSE|address already in use/i` で分岐していたが、
Bun が投げるのは **`Failed to start server. Is port <n> in use?`** で errno を含まない。
つまり**ポート衝突時にヒントが一度も出たことがなかった** — R-MM-1 が要求する
「理由と対処を stderr に出す」の「対処」が欠落していた。正規表現に `port \d+ in use` を
足して是正した（`cli.ts`、実装は U5 所有だが本 Unit のテストが検出したため本 Unit で修正し、
ここに記録する）。手動 MA-5 のままなら見つかっていない。

## 設計との差分（ギャップと理由）

| # | 設計 | 実装 | 理由 |
|---|------|------|------|
| G-1 | `buildExposureNotice(port)` | `buildExposureNotice(port, host)` | 同じ BLM M1 が「loopback 起動時は addresses = `["http://127.0.0.1:<port>"]` のみ」と定めており、port だけでは分岐できない。引数を増やす代わりに env/config を読む選択は S-MM-6 に反するため採らなかった |
| G-2 | `LiveStatusView.live.lastChangeAt: string` | `string \| null` | 「接続済みだが change をまだ1件も受けていない」状態が存在する。`string` を保つには接続時刻等を代入するしかなく、それは「最終更新」の意味を偽ることになる（R-MM-3 の趣旨に反する）。**variant は4のまま**（設計の 1:1 対応は維持）。5つ目の variant にしなかったのは、`data-state` / `liveStatusText` の switch / 受入条件「4状態」がすべて5に膨らむ割に、それは別の*状態*ではなく同じ live 状態の1節が欠けているだけだから。**帰結として BLM M3 の文言表に無い5本目の文字列が出る → G-2b** |
| G-2b | （BLM M3 の文言は4本） | 実装は**5本**。5本目は裸の「ライブ更新中」 | `kind:"live"` で `lastChangeAt` が `null` のとき（＝接続済み・change 未受信）と、タイムスタンプが解析不能で `relativeTime` が `""` を返したときの2経路で出る。どちらも「最終更新」節を**捏造せずに落とす** fail-soft。文言セットの完全な一覧は次表 |
| G-3 | `{kind:"degraded"; reason: string}` | 同じ。ただし WS の `reason` は optional なので未指定時 `""` | `""` のとき UI は括弧ごと省いて「更新が止まっています」と出す。存在しない理由を捏造しない |
| G-4 | （設計に記述なし） | LiveStatus が 30 秒ごとに自前で再描画する | 相対時刻は props が変わらなくても腐る。停止した「1分前」は R-MM-3 が禁じる過大なライブ性表示そのもの。**時計の tick のみ**で、状態導出（`liveStatusView`）は純関数のまま — R-MM-3 が禁じる「独自のタイマーや推測による状態導出」には当たらない |
| G-5 | `ExposureNotice.addresses: string[]` | `readonly string[]` | S-MM-6 の「起動時に確定して変化しない」を型で表した。設計の意図の強化であり縮小ではない |

### LiveStatus の文言セット（実装の全5本）

| # | 出る条件 | 文言 | `data-state` |
|---|---------|------|-------------|
| 1 | `connecting`（初回接続前） | 「接続中…」 | `connecting` |
| 2 | `live` + `lastChangeAt` 有効 | 「ライブ更新中 · 最終更新 <相対時刻>」 | `live` |
| 3 | `live` + `lastChangeAt === null`、または相対時刻が算出不能 | **「ライブ更新中」**（BLM M3 の表に無い5本目 — G-2b） | `live` |
| 4 | `reconnecting`（切断後） | 「切断・再接続中…」 | `reconnecting` |
| 5 | `degraded` | 「更新が止まっています（<reason>）」／ reason 無しなら括弧ごと省いて「更新が止まっています」 | `degraded` |

（5の括弧省略は G-3。**状態は4つ**のまま、文言だけが5本ある。）

## 既知の制限

- **IPv6 は列挙しない**（tech-stack-decisions.md の明示的決定）。IPv6-only の LAN では
  アドレス一覧が空になる。その場合も警告は出て listen は成立しており、操作者は
  自分でアドレスを調べれば共有できる（R-MM-2 と同じ縮退の形）。
- **NIC 変化に追従しない**（P-MM-1 の「起動時1回」）。モブ中に Wi-Fi を切り替えると
  印字済みの URL は古くなる。再起動で解決する。
- `packages/reader-core/tests/watch.test.ts` の実ファイルシステム watch テストが
  フルスイート並列実行下で一度だけ chokidar のタイミングで落ちるのを観測した
  （単体再実行では緑。レビュアーの4連続実行では**再現せず**）。**本 Unit の変更とは無関係**
  で（`packages/reader-core/**` はこの diff に1ファイルも含まれない）、本 Unit の欠陥の
  証拠ではない。観測事実としてのみ残す。

## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25 (iteration 1)

Gate reproduced: `bun run check` run 4× consecutively, green every time —
`52 passed`, `680 passed | 2 skipped`, `bun audit` clean. The recorded coverage
figures (96.53% / 1503 stmts, branches 92.6% / 989) reproduced exactly on runs
2–4; run 1 came in at 96.4% / 1501, i.e. ±2 statements of run-to-run drift in
`services/live.ts`'s catch arms — noise, not a defect. **The reader-core watch
flake did not reproduce in any of the 4 runs**, and it is not this unit's doing:
no `packages/reader-core/**` file is in this diff. Keep the note; it is not
evidence of anything here.

### 1. `hostMode` collapses to `false` on any failed `/api/workflow`, taking the ReadOnlyBadge with it and putting the AnswerEditor DOM back [Blocking]

`packages/dashboard/src/store/deriveViewState.ts:90` —
`hostMode: "ok" in result ? result.value.serverMode.hostMode : false` — and
`packages/dashboard/src/store/reducer.ts:33-34` assigns that unconditionally.
`refetchAll` (`packages/dashboard/src/services/api.ts`, re-run on **every WS
(re)connect** and on `reloading`) turns any transport blip, `no-active-intent`,
`state-missing` or `unsupported` into a non-`ok` result. Verified by running the
real reducer:

```
after ok  : true      // GET /api/workflow → serverMode.hostMode true
after fail: false     // next result {error:true, reason:"server-unreachable"}
```

Consequences, both in this unit's own acceptance list:
- `packages/dashboard/src/components/Header.tsx:19` — `{state.hostMode ? <ReadOnlyBadge/> : null}` → the badge disappears from every participant screen while the server is still `--host`. S-MM-5 は「起動警告 + アドレス一覧 + ReadOnlyBadge の3点を必ず提示。**どれか1つでも欠けたら受入不可**」。
- `packages/dashboard/src/viewer/AnswerEditor.tsx:168` — `if (hostMode || answerLines.length === 0) return null` → the edit UI **comes back** in the participant DOM. That is `business-rules.md` 受入条件「参加者ブラウザの DOM に編集要素が存在しない」 and MA-3, failing in a reachable state.

The server's 403 still holds, so this is not an authz breach — but it is exactly
the "don't make the user discover read-only by failing to save" guarantee
`ReadOnlyBadge.tsx:8-10` claims to provide.

It also falsifies this summary's own S-MM-6 line ("`AppState.hostMode` を
`readonly` に") and `state.ts:51-56`'s comment ("Fixed for the life of the server
process"). `readonly` on an interface property blocks `state.hostMode = x`; it
does not stop the reducer building a **new** state object with a different value,
which is precisely what happens. As written, client-side `hostMode` is *not*
run-invariant.

**Fix** (one line, in the reducer where the ownership is): never downgrade on a
failed read —

```ts
case "workflow": {
  const { workflow, nextStep, hostMode } = deriveWorkflow(action.result);
  return { ...state, workflow, nextStep, hostMode: "ok" in action.result ? hostMode : state.hostMode };
}
```

plus one reducer test: `hostMode:true` → `{error:true, reason:"server-unreachable"}`
→ still `true`. (A successful read still wins in both directions, so a restart
without `--host` correctly clears it — don't use `||`, that would strand a stale
badge.)

### 2. The `HOST_EXPOSURE_WARNING` "reference identity" claim is not true [Non-blocking]

`packages/dashboard-server/tests/exposure-notice.test.ts:51-54` asserts
`expect(buildExposureNotice(4700, true).warning).toBe(HOST_EXPOSURE_WARNING)`
with the comment "Identity, not equality". `toBe` is `Object.is`; on a **string
primitive** that is value equality. A retyped literal in `exposure-notice.ts`
would pass this test and pass the `toContain` checks too. So
`code-generation-plan.md` §4「警告定数の**同一性**（複製検出）」 and this summary's
line 117「テストが参照同一性で assert しているので、複製されれば失敗する」 both
claim a mechanical guarantee that does not exist.

The code itself is correct — `exposure-notice.ts:2` genuinely imports the
constant — so S-MM-2 holds. Only the evidence is wrong, and it is evidence
offered for a security requirement.

**Fix**: correct the two sentences, or make the claim true the way
`project.md` (learned rule `nfr-design:c3`) asks — a structural check rather
than prose: read `exposure-notice.ts`'s own source in the test and assert it does
**not** contain `"警告: LAN に公開します"`.

### 3. `--host` prints a dangling 「参加者に共有する URL:」 heading when the list is empty [Non-blocking]

`packages/dashboard-server/src/cli.ts:62-63` — the heading is written
unconditionally inside the `--host` branch, then the loop writes nothing when
`addresses` is `[]`. That is reachable on both documented degradations: NIC
enumeration failure (R-MM-2, tested at `exposure-notice.test.ts:80`) and an
IPv6-only LAN (this summary's own 既知の制限, lines 202-205). The operator is left
with a label promising URLs, no URLs, and no explanation.

`reliability-design.md` R-MM-2 says 「addresses 空 + **警告のみ**」 and BLM
「エラー・境界」 says 「addresses を空にして**警告のみ**表示」 — warning only, not
warning plus an empty label.

**Fix**: in `cli.ts`, branch on `notice.addresses.length === 0` and print one
hint line instead of the heading (自動検出できなかった旨 + 自分で IPv4 を確認する
案内). `server-smoke.test.ts:145-148` already tolerates a zero-length list, so it
needs one extra case, not a rewrite.

### 4. The reducer reads the clock on the `ws` path [Non-blocking]

`packages/dashboard/src/store/reducer.ts:56` —
`action.receivedAt ?? new Date().toISOString()`. `code-generation-plan.md` §2
states the stamp is taken in `services/live.ts`「（reducer を計測可能に保つ）」;
this fallback puts a clock read back inside the reducer and is not listed in the
G-table. There is exactly **one** production dispatch site
(`services/live.ts:74`) and it always supplies `receivedAt`, so the fallback is
dead outside tests — and `reducer.test.ts:118` (`lastChangeAt).not.toBe(...)`)
currently depends on it.

**Fix**: make `receivedAt` required on the `ws` action and pass `CHANGE_AT` at
the handful of test call sites. Shorter diff than defending the fallback.

### 5. G-2 is the right call, but the deviation is under-declared [Non-blocking]

`string | null` over a fifth variant is correct: a 5th variant would split `live`
and force `data-state` (`app.css:218-230`), `liveStatusText`'s switch, and the
4-row 受入条件「LiveStatus が4状態…」 to all grow to five, for a state that is not
a different *state* — it is the same live state with one clause unavailable. The
1:1 with BLM M3 is genuinely preserved.

What G-2 omits is the consequence: `LiveStatus.tsx:41,43` renders a **fifth copy
string**, bare 「ライブ更新中」, which appears nowhere in BLM M3's copy table — and
the same string is also the silent fallback for an unparseable timestamp
(`relativeTime` returning `""`, asserted at `mob-mode.test.tsx:91-98`). That is
good fail-soft behaviour, but a reviewer checking a 4-string contract against a
5-string implementation will stop on it. Add the copy to G-2 (or to BLM M3).

### 6. The decomposed audit-identity assertion lost coverage the original had [Non-blocking]

`packages/dashboard/tests/reducer.test.ts:116-118` replaced
`expect(after).toBe(before)` with `expect({...after, live: before.live}).toEqual(before)`
plus reference identity for `workflow` and `matrix` only. Root-state identity had
to go — `live` legitimately changes now — but the original covered **all eight**
slices by reference; the replacement covers two by reference and the rest by deep
equality. A future `change/audit` handler that rebuilt `nextStep`, `intents`,
`stageDoc` or `projectLinks` into equal-but-new objects would pass this test while
causing exactly the re-render churn P-MM-2 guards. Today `applyWs` returns
`{...state, live}` so the identity holds by construction — which is what makes
restoring the assertion nearly free.

**Fix**: one line —
`for (const k of Object.keys(before)) if (k !== "live") expect(after[k]).toBe(before[k]);`

### 7. MA-5 is automatable with the harness that already exists [Non-blocking]

The stated reason ("子プロセス2本のレース制御が要り、テスト自体が不安定要因になる")
does not hold against `server-smoke.test.ts` as written: `start()` resolves only
**after** the first child has printed its ready line (`:52-58`), and the harness
already rejects with the child's exit code and stderr on early exit (`:64-67`).
There is no race to control — server A is listening before B is spawned. R-MM-1's
検証 column asks for precisely 「ポート占有下の起動テスト」, and this unit owns that
verification even though U5 owns the implementation.

**Fix**: start A with `--host --port 0`, read its port, then
`await expect(start(["--port", String(port), "--host"], root)).rejects.toThrow(/exited early \(1\)/)`.
Give **both** servers `--host` so both take `0.0.0.0` — a `0.0.0.0`-over-`127.0.0.1`
collision is not reliably `EADDRINUSE` on Windows, which team.md requires to pass.

MA-1 / MA-2 / MA-4 are honestly scoped (a second machine is genuinely required).
MA-3 is correctly labelled a re-confirmation of an already-automated check.

### Verified clean — attacked and did not break

- **S-MM-4**: `exposure-notice.ts:45-56` maps `nic.address` only; the interface
  *names* (`Wi-Fi`, `Ethernet`) that `networkInterfaces()` returns as object keys
  are discarded by `Object.values`, and `mac` / `cidr` / `netmask` are never
  read. `cli.ts` prints `notice.addresses` and `server.hostname` (`0.0.0.0`) —
  nothing else. Loopback case returns the one address that exists and `cli.ts`
  correctly does not print it a second time above the ready line.
- **BR-MM-1 / S-MM-6 (no implicit exposure)**: `grep` for
  `process.env|import.meta.env|Bun.env` across `dashboard-server/src`,
  `dashboard/src`, `shared-types/src` returns **nothing**. `parseArgs`
  (`cli.ts:21-43`) sets `host: true` on the `--host` arm and nowhere else;
  `server.ts:86,90` derives both `hostMode` sinks from `config.host`. The
  `readonly` on `ServeOptions.host` / `ServerMode.hostMode`
  (`shared-types/src/index.ts:206-223`) constrains post-construction mutation of
  those objects only — nothing currently mutates them, so it is a documentation
  aid, not a load-bearing constraint. The real guarantee is the single `--host`
  arm, and it holds. (Client-side `AppState.hostMode` is the exception — finding 1.)
- **S-MM-2 ordering**: `cli.ts:60` writes the warning, `:62-63` the heading and
  list. Order is correct in code. No test asserts `indexOf(warning) < indexOf(heading)`
  — worth one line when fixing finding 3.
- **`live` state machine**: first-connect failure never reaches `reconnecting`
  — a throwing `WebSocket` constructor goes straight to `schedule()` with no
  dispatch (`live.ts:52-57`), and an `onerror`→`onclose` before `onopen`
  dispatches `connected:false` while `everConnected` stays `false`. Drop-and-recover
  and server restart both set `everConnected` on `onopen` only (`live.ts:61-63` →
  `reducer.ts:63-73`) and it never resets. `liveStatusView` checks `!connected`
  first, so a stale `degraded:true` surviving a drop still renders `reconnecting`
  (asserted at `mob-mode.test.tsx:42-46`).
- **`lastChangeAt` scope**: stamped only under `case "change"` (`reducer.ts:124`);
  `matrix-ready` and `live-status` carry the previous value forward via `carry()`
  and cannot advance it. The `matrix:<unit>` early-return in `applyMatrixScope`
  returns the already-stamped state, not the original — no lost update.
- **G-4 timer**: `useEffect(..., [])` with `clearInterval` in the cleanup
  (`LiveStatus.tsx:51-54`) — one interval per mount, cleared on unmount, cannot
  accumulate across renders. `now` is component-local `useState`, so the 30s tick
  re-renders `LiveStatus` and nothing else — P-MM-2 (「他領域の再描画を誘発しない」)
  holds. `liveStatusView` stays a pure function of `LiveSlice`; the clock is only
  a render input, never a state derivation, so R-MM-3's ban on 「独自のタイマーや
  推測による状態導出」 is not engaged. (Nit, not a finding: the interval also runs
  in `connecting`/`reconnecting`/`degraded` where no relative time is shown.)
- **atoms.tsx migration**: repo-wide grep finds `LiveStatus` / `ReadOnlyBadge`
  definitions in exactly one file each; `atoms.tsx:7-9` retains only a pointer
  comment. `data-testid` values preserved, so `header.test.tsx:53,63`
  (`read-only-badge` role) is genuinely unmodified and still asserts what it did.
- **BR-MM-4**: no new route, no participant-conditional payload, no second
  broadcast path. `push.ts` untouched; `services/api.ts` remains GET-only and
  `dependency-direction.test.ts:94-102` (the "exactly one POST module" guard) is
  unmodified and green.

## Review (iteration 2)

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25 (iteration 2, final)

All seven findings verified fixed against the code, not the summary. Gate re-run
3× consecutively: `52 passed`, `685 passed | 2 skipped` every time, `bun audit`
clean. Coverage now reproduces **exactly** across runs (96.53% / 1504 of 1558;
branches 92.6% / 989) — the ±2-statement drift seen in iteration 1 is gone, the
new deterministic tests pinned the arms that were racing. The reader-core watch
flake did not appear in these 3 runs either (7 clean full-gate runs across both
iterations); it is still not this unit's doing.

### Finding 1 (blocking) — resolved, and the three attacks it was given all fail

`deriveViewState.ts:77-90` now returns `hostMode: boolean | null` with `null`
meaning **unknown**, and `reducer.ts:34-38` applies `hostMode ?? state.hostMode`.
Verified by running the real reducer in all four directions:

```
host          : true     // successful read, --host
after blip    : true     // {error:true, reason:"state-missing"} → sticky
after restart : false     // successful read reporting hostMode:false → clears
cold-start    : false     // first read of the page's life fails
```

- **Is the stickiness one-directional in the wrong way?** No. `??` falls through
  on `null`/`undefined` only — a *successful* read reporting `false` still moves
  it (`after restart : false`). A `--host`-less restart therefore cannot strand a
  stale badge. This is exactly the trap `||` would have fallen into, and
  `reducer.test.ts:37-59` asserts both halves in one test (`state-missing` and
  `no-active-intent` hold `true`; a successful `hostMode:false` read clears it),
  with the per-reason message `${reason} downgraded hostMode` so a regression
  names itself. `derive-view-state.test.tsx:86-101` pins `null` at the source.
- **Does `null` leak into a consumer that treats it as falsy?** No.
  `deriveWorkflow` has exactly two call sites: `reducer.ts:34` (guarded by `??`)
  and `reducer.ts:132`, which destructures `{workflow, nextStep}` only and
  *feeds in* `state.hostMode` — already a `boolean` — so the `change/state` path
  cannot produce one either. `AppState.hostMode` stays `boolean`
  (`state.ts:56`), both `tsc --noEmit` passes are green, and the three consumers
  (`Header.tsx:19`, `DetailPanel.tsx:155`, `AnswerEditor.tsx:168`) are
  structurally unable to receive `null`.
- **Is the positive control exercising the same path?** Yes. `openCell(false)`
  and `openCell(true)` share one harness, one fetch stub, the same
  `withQuestions()` matrix and the same `WITH_ANSWER` body — `hostMode` is the
  only variable. Both `await waitFor(getByTestId("artifact-viewer"))` before
  asserting, so neither can pass because the lazy viewer simply never mounted,
  and the control asserts the editor **is** present at `hostMode:false`. The
  negative then holds `answer-editor` *and* `role="textbox"` absent across the
  failing read — two independent handles on the same property.

### Non-blocking fixes 1–6 — verified

1. **S-MM-2 evidence is now structural.** `exposure-notice.test.ts:68-82` walks
   `dashboard-server/src` recursively and asserts the sentence 「警告: LAN に公開
   します」 lives in exactly one file (`toEqual(["server.ts"])`) plus that
   `exposure-notice.ts` contains the literal import line. A retyped copy in this
   module would put two entries in `owners` and fail — which the old
   `toBe`-on-a-string could not do. Scope note (not a finding): it scans one
   package and matches the first sentence, so a copy planted in
   `packages/dashboard` or a paraphrase escapes it. The drift S-MM-2 is actually
   about is between `server.ts` and `exposure-notice.ts`, and both are in scope.
2. **Empty address list.** `cli.ts:66-73` branches on `addresses.length === 0`
   and prints `EXPOSURE_NO_ADDRESS_HINT` *instead of* the heading — 警告のみ, as
   R-MM-2 asks, plus actionable advice. `server-smoke.test.ts:147-166` now covers
   **both** branches on whatever NIC the runner has, and additionally asserts the
   ordering gap I flagged in iteration 1: `indexOf(HOST_EXPOSURE_WARNING) <
   indexOf(heading)`.
3. **Reducer is pure.** `receivedAt: string` is required (`reducer.ts:25`), the
   `?? new Date()` is gone, and `grep` for `new Date(|Date.now(` across
   `dashboard/src/store` returns **nothing**. The only clock read left in the
   data path is `services/live.ts:74`, at the socket boundary where the design
   put it.
4. **G-2b declared** with the full 5-string / 4-state copy table, naming both
   routes to the fifth string (`lastChangeAt === null`, and `relativeTime`
   returning `""`). A reviewer can now check the implementation against a table
   that matches it.
5. **Audit identity restored and improved.** `reducer.test.ts:150-153` loops
   every key of `before`, skips `live`, and compares by `toBe` with a
   per-key failure message. That is the coverage the original
   `expect(after).toBe(before)` had, minus the root object that legitimately has
   to change now — and it localises a regression instead of just reporting
   inequality.
6. **MA-5 automated** (`server-smoke.test.ts:172-206`) and removed from the
   manual table. The test is not tautological: beyond matching the error text it
   asserts the **hint line** (`使用中`, `--port`) that proves the branch fired,
   a non-zero exit, that no ready line was printed (BR-MM-5 — no silent loopback
   fallback), and that the first server is still answering. Both servers take
   `--host` so both bind `0.0.0.0` and the collision is a real `EADDRINUSE` on
   Windows too.

### The `cli.ts` error-pattern change — correct, and acceptable to have made here

`cli.ts:91` widened to `/EADDRINUSE|address already in use|port \d+ in use/i`.
Correct: Bun throws `Failed to start server. Is port <n> in use?` with no errno,
so the previous pattern never matched and the `--port` advice had never once
fired on a real collision. A genuine latent bug, found because MA-5 stopped being
a manual item.

False-positive risk is bounded by construction: the pattern gates **only an
advisory stderr line** — `process.exit(1)` happens either way, before and after —
so a spurious match costs one misleading sentence, never a behaviour change. No
other error this CLI raises (`parseArgs` messages, `DIST_MISSING_HINT`) can
contain `port <digits> in use`.

On ownership: `cli.ts` is not in the BLM's U5 table (that table names `server.ts`,
`handlers/read.ts`, `handlers/answer-writer.ts`, `push.ts`), and
`code-generation-plan.md` §2 already declared `cli.ts` as this unit's wiring
surface — so this is not a table-listed U5 line. The *behaviour* is R-MM-1's,
whose 実装所有 column says U5, and `project.md`'s Way-of-Working rule asks a later
unit to hold only requirement/verification responsibility for a preceding unit's
behaviour. The right resolution is what was done: fix it (a one-line regex in a
file already in this diff, versus knowingly shipping R-MM-1 broken for ownership
purity) **and record it**, which lines 297-304 do explicitly, naming the file, the
reason and the owner. U5's artifacts can pick it up from there. One wording nit,
not a finding: line 9's blanket 「U5 のサーバ挙動に1行も足していない」 now sits
slightly awkwardly beside line 303's 「実装は U5 所有だが…本 Unit で修正し」 — the
ownership table it refers to is still accurate, and line 303 is explicit enough
that nothing is hidden.

### Residual, carried forward — not blocking

**Cold start whose first `/api/workflow` fails cannot know it is in host mode.**
`initialState.hostMode` is `false` (`state.ts:88`), so `null ?? false` → `false`
(`cold-start : false` in the probe above). If a participant loads the page while
the record is degraded — `/api/workflow` erroring but `/api/matrix` still
building a tree, they are separate endpoints and separate actions — the badge is
absent and `AnswerEditor` would render on a `*-questions.md` cell. The fix closed
the steady-state hole (any reconnect blip, whole session); this is the narrower
first-read-of-the-page window that remains.

Why it does not block: the server's unconditional 403 (S-MM-3) is the real gate
and is untouched, `business-rules.md` assigns the DOM-absence mechanism to
artifact-viewer S-AV-2, and the contract gives the client no channel for
`hostMode` other than `GET /api/workflow` (`domain-entities.md`) — so "unknown at
cold start" is a property of the contract, not a defect introduced here. Closing
it properly means making the *unknown* state visible to consumers rather than
collapsing it to `false`: `AppState.hostMode: boolean | null` with `null`
suppressing the editor (fail-safe), which is a contract-touching change, not a
code-generation fix. Worth one line in artifact-viewer's or U5's next pass; I did
not build a render harness to demonstrate it, the trace is
`initialState.hostMode:false` → `AnswerEditor.tsx:168` with `matrix` arriving
independently.

**Disposition:** the blocking finding is fixed with the correct operator and
mutation-verified tests, all six non-blocking items are genuinely addressed
(several better than I asked for), the gate reproduces 3/3 with stable coverage,
and the one line of U5-owned behaviour changed here is a real bug fix that is
correctly recorded. A developer can build and operate this without further
architectural input. READY.
