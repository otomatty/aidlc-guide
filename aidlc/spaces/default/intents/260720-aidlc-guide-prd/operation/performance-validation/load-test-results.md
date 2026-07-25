# Load Test Results — AIDLC Guide

> performance-validation (4.6) / 実行日: 2026-07-26 / 実行環境: Windows 11、bun 1.3.6、loopback
> 入力: `load-test-plan.md` の手順 / 対象: tb-lxp（`C:/work/tb-lxp`、`aidlc/` 配下 687ファイル、State Version 7、commit `dbf87e7`）
> 本書は**実行して観測した値**である。測れなかったものは測れなかったと書く。

## 結論

| ID | 目標 | 実測 | 判定 | 余裕 |
|----|------|------|------|------|
| **NFR-2** | 起動 → 初回表示 ≤3秒 | **cold 総計 約0.78秒** / warm 約0.13秒 | ✅ | 約3.8倍 |
| **NFR-3** | 変更 → 反映 ≤2秒 | **p50 329ms / max 392ms**（n=5） | ✅ | 約5倍 |
| P-AV-2 | 初回 ≤1.5秒 / 2回目 ≤0.8秒 | **初回 629ms** | ✅ | 約2.4倍 |
| P-AV-3 | 図ごと ≤500ms | **常駐後 246ms**（初回はライブラリ import 込みで1015ms） | ✅ | 約2倍 |
| P-AV-4 | 保存 ≤1.5秒 | **p50 29ms / max 41ms**（n=5） | ✅ | 約37倍 |
| P-DS-1 | workflow は state 1枚のみ | 応答に matrix キー無し / warm p50 2.6ms | ✅ | — |
| P-RC-2a | 起動時の背景構築 | spawn から **685ms** で完了（687ファイル走査） | ✅ | — |

**全数値目標が目標を下回った。** 最も余裕が小さいのは P-AV-3（約2倍）で、最も大きいのは P-AV-4（約37倍）。

## 1. サーバ側クリティカルパス（cold — プロセス spawn から）

自前で spawn し t=0 を実測した:

```
spawn -> listening:                 262ms
first GET /api/workflow (cold):     385.1ms   (t=648ms from spawn)
matrix background build ready:      t=685ms from spawn（ポーリング開始から37ms、3回目のポーリングで ready）
```

**ADR-03（段階的初回描画）が設計どおり効いている**ことの直接的な証拠がここにある: 687ファイルの全走査は spawn から 685ms で完了しているが、**それを待たずに** `GET /api/workflow` が 648ms 時点で応答している。初回表示は state 1枚のパースだけに依存し、全走査はその後段にある。

### warm（同一プロセスへの反復）

| エンドポイント | n | min | p50 | p95 | max |
|--------------|---|-----|-----|-----|-----|
| `GET /api/workflow` | 20 | 2.0ms | **2.6ms** | 3.6ms | 3.6ms |
| `GET /api/matrix` | 10 | 0.2ms | **0.3ms** | 0.4ms | 0.4ms |
| `GET /api/artifact` | 10 | 2.8ms | **4.4ms** | 5.8ms | 5.8ms |
| `GET /api/intents` | 1 | — | 1.5ms | — | — |

`/api/matrix` の warm が 0.3ms なのは、背景構築の結果を保持して返しているだけだからである（走査をやり直していない = P-RC-2b の設計どおり）。

## 2. ブラウザ側（NFR-2 の終点）

実ブラウザで取得した Navigation / Resource Timing（すべて `navigationStart` からの相対 ms）:

```
navResponseEnd            56
domInteractive            79
domContentLoadedEnd       83
loadEventEnd              84
/api/workflow responseEnd 94    ← Now strip がデータを得た時点
```

初期アセットの cold 転送コスト（`cache:'no-store'` で再取得して計測）:

| リソース | サイズ | 転送 |
|---------|-------|------|
| `index-xAm3UF0w.js`（初期チャンク） | 227.4 kB | 23ms |
| `index-CsbJQmik.css` | 10.8 kB | 4ms |
| `index.html` | 0.4 kB | 7ms |

### マトリクスが初回表示の後段にあることの実測

| リソース | start | end |
|---------|-------|-----|
| `/api/workflow` | 82 | **94** |
| `UnitStageMatrix-*.js`（遅延チャンク） | 823 | 823 |
| `/api/matrix` | 973 | **1298** |
| `/api/intents` | 976 | 1312 |

`/api/matrix` の完了（1298ms）は Now strip がデータを得た時点（94ms）より**1.2秒あと**である。ADR-03 の意図どおり、マトリクスは初回表示のクリティカルパスに入っていない。

### NFR-2 の合成

| 経路 | 内訳 | 合計 |
|------|------|------|
| **cold（サーバ起動込み）** | spawn→listening 262ms + workflow cold 385ms + ブラウザ側 navigation→workflow 94ms + アセット転送 34ms（並行するため単純加算は過大評価） | **約0.78秒**（上限見積り） |
| **warm（サーバ稼働中・キャッシュあり）** | navigation→workflow responseEnd 94ms + 描画 | **約0.13秒** |

いずれも 3秒に対して**大きな余裕**がある。cold の合成は各段を単純加算した上限見積りであり、実際にはアセット転送と API 呼び出しが重なるためこれより短い。

### 観測された追加の挙動（欠陥ではない）

1589〜1688ms に `workflow` / `matrix` / `intents` の**2巡目**が発生している。これは WS 接続確立時の `refetchAll`（R-UI-4: サーバがクライアント状態を持たないため、再接続時は全再取得が唯一の整合手段）であり、設計どおりである。初回表示はその前に完了している。

## 3. NFR-3（変更 → 反映）

WS を張り、`aidlc-state.md` への書き込みから `{type:"change", scope:"state"}` の受信までを5回測定:

| 試行 | 0 | 1 | 2 | 3 | 4 |
|------|---|---|---|---|---|
| ms | 335 | 329 | 329 | 392 | 317 |

```
n=5  ok=5  min=317ms  p50=329ms  max=392ms
```

**目標 2000ms に対して最悪値 392ms**（約5倍の余裕）。ばらつきが小さい（317〜392ms）のは chokidar の debounce が支配的だからで、ファイル数（687）にはほとんど依存していない。

## 4. P-AV-2（成果物オープン）— 実 UI 経路

マトリクスのセルを実際にクリックして測定:

```
viewer mounted:      371ms
content rendered:    629ms
```

同時に取得されたリソース: `index-CGBSdQNm.js`（ビューア遅延チャンク、6ms）、`/api/artifact?path=...business-rules.md`（22ms）。

**目標 1500ms に対して 629ms**。チャンク取得（6ms）と成果物取得（22ms）はどちらも極小で、大半は React の遅延ロード解決と描画である。

## 5. P-AV-3 / MA-6（Mermaid）

**MA-6（FR-6.1 チェック項目2 — mermaid が図として描画されること）をここで閉じた。**

mermaid フェンスを含む `domain-entities.md` に切り替えて測定:

| 測定 | 値 |
|------|----|
| 初回（mermaid ライブラリの動的 import 込み） | 1015ms |
| **常駐後（P-AV-3 の対象）** | **246ms** |

描画結果の実測:

```
svgCount:        1
svg id:          "mermaid-1"
svg 子ノード数:   143（g / path / rect / text）
svg 寸法:        512 × 257 px
rawFenceLeaked:  false   ← "graph TD" 等が本文テキストとして漏れていない
tables:          16      ← GFM テーブルが本物の <table> として描画（チェック項目1）
pres:            0       ← plain preview へのフォールバックが起きていない
```

これは **Milkdown を落としたときと同じ種類の証拠**である。Milkdown は「mermaid ソースが本文テキストとして出現し、図ノード0件」で不合格とした。後継の `marked.lexer()` 経路は図ノード143件・生ソース漏れなしで合格した。build-and-test 時点で「候補を落とした基準（実測）と後継を採用した基準（jsdom モック越しの単体テスト）が非対称」と自認していた点が、これで解消された。

## 6. P-AV-4（保存）

**tb-lxp には書き込まず**、687ファイルをスクラッチへ複製して実施（questions Q2 / team.md の read-only 規約）。

```
status=200  line25="[Answer]: B (probe 0)"  otherLinesUnchanged=true
P-AV-4 save round-trip (POST + re-read) n=5: min=25ms  p50=29ms  max=41ms
```

**目標 1500ms に対して最悪値 41ms**。同時に、`[Answer]:` 行以外が**バイト不変**であることを全行比較で確認した（`otherLinesUnchanged=true`）。

## 7. 公開範囲の実挙動（NFR-7 の付随確認）

`--host` 起動の実出力:

```
警告: LAN に公開します。レンダリングされた aidlc 成果物・監査内容（ユーザーが貼り付けた秘密を
含み得る）が同一ネットワークの全端末から閲覧可能になります。また --host 中は回答の書き込みが
全クライアントで無効になります（read-only mode）。
参加者に共有する URL:
  http://10.5.0.2:4808
  http://192.168.0.189:4808
AIDLC Guide dashboard: http://0.0.0.0:4808
```

- 警告が**アドレス一覧より前**にある（S-MM-2）
- アドレスは IPv4 と port のみ。ホスト名・ユーザー名・パスを含まない（S-MM-4）
- `--host` 中の `POST /api/answer` → **403**（BR-MM-3）

## フィクスチャの健全性

計測後に tb-lxp の状態を確認した:

```
$ git -C /c/work/tb-lxp status --porcelain
 M aidlc/spaces/default/intents/260719-tb-lxp-mvp/audit/saedgewell-8b04e1c836c8.md
 M tsconfig.app.json
```

**この2件は本計測より前から未コミットだった**（mtime 23:59 / 23:45 に対し、本計測の開始は 00:15 以降）。いずれも tb-lxp 自身のワークフロー実行に由来し、本ツールが書いたものではない（本ツールの唯一の書込経路は `POST /api/answer` で、tb-lxp に対しては一度も発行していない）。

NFR-3 の計測で意図的に書き換えた `aidlc-state.md` は**復元済みで clean**（`git status` に現れない）。読み取り専用の原則（NFR-1）は計測全体を通じて破っていない。

## 未計測（偽装しない）

| ID | 内容 | 理由 |
|----|------|------|
| MA-1 / MA-2 | LAN からの到達性（既定で不達 / `--host` で到達） | 別端末が必要 |
| MA-3 | 参加者ブラウザの DOM に編集要素が0件 | 別端末が必要（jsdom では検証済み） |
| MA-4 | 参加者側の反映時間 | 別端末が必要。**推論**としては、参加者は同一 broadcast を受けるため上記 NFR-3 の 317〜392ms がそのまま適用される（BR-MM-4: 参加者専用経路を作らない）。ただしこれは推論であって実測ではない |
| MA-7 | btw の macOS 経路 | 実機が必要 |
| — | symlink containment ベクタ | 本環境に symlink 作成権限が無い |
| — | 1MB / 10MB 成果物の実描画 | 1MB 境界は単体テストで検証済み。10MB はサーバが拒否するため到達不能 |

## 計測環境の限界

- **loopback 上の計測**である。LAN 越しの参加者にはネットワーク遅延が加算されるが、本ツールの目標（NFR-2/3）はドライバー側の体感を定義したものであり、参加者側の目標は MA-4 として別立てになっている
- **1台のマシン・1回の測定セット**である。他のハードウェアでは絶対値が変わる。ただし目標に対する余裕（最小でも約2倍）は、ハードウェア差で覆るには大きい
- ファイルシステムキャッシュの状態は cold/warm として分離したが、OS レベルのキャッシュを完全に落としてはいない（cold は「プロセス起動直後の初回アクセス」の意味）
