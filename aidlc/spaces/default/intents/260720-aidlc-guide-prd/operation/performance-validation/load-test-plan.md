# Load Test Plan — AIDLC Guide

> performance-validation (4.6) / lead: quality / 2026-07-26
> 入力: 各 Unit の `nfr-requirements/performance-requirements.md`（P-RC / P-DS / P-UI / P-AV / P-MM）+ `nfr-design/performance-design.md`（要件→機構）+ `nfr-requirements/scalability-requirements.md` / `nfr-design/scalability-design.md`（SC-*）+ `construction/build-and-test/performance-test-instructions.md`
> 前提: `operation/observability-setup/dashboards.md` は本スコープで SKIP されたステージの成果物であり存在しない。監視基盤由来の指標は使えないため、計測はすべて本ステージで直接実施する。

## 何を「負荷」とみなすか

本ツールは単一ユーザーのローカルプロセスであり、スケール軸は**同時接続数ではなくワークスペースのファイル数**である（questions Q1）。したがって「RPS を上げて限界を探る」試験は行わず、**実データ規模に対する応答時間**を測る。

| 軸 | 想定範囲 | 根拠 |
|----|---------|------|
| ワークスペースのファイル数 | 687（tb-lxp 実測対象） | C-T7 / NFR-2 が名指しするフィクスチャ規模 |
| 同時接続（モブ参加者） | 数名〜十数名 | SC-MM。全クライアントに同一 broadcast を送るため、参加者ごとの追加処理が無い |
| 成果物1件のサイズ | 〜100KB（一般）/ 1MB（plain 切替）/ 10MB（サーバ拒否） | P-AV-5 |

## 測定対象と合否

| ID | 目標 | 終点の定義 |
|----|------|----------|
| **NFR-2** | 起動 → 初回表示 ≤3秒 | Now strip が phase / current stage / depth / gate / 完了数を表示した時点（FR-4.1 の受入基準）。**Unit×Stage マトリクスの到着は終点に含めない** — ADR-03 の段階的初回描画により、それは初回表示の後段だからである |
| **NFR-3** | 変更 → 反映 ≤2秒 | 監視対象ファイルの保存から WS `change` push がクライアントに届くまで |
| P-AV-2 | 成果物オープン 初回 ≤1.5秒 / 2回目 ≤0.8秒 | ビューアが本文を描画した時点 |
| P-AV-3 | Mermaid 図ごと ≤500ms | SVG が DOM に出現した時点。**ライブラリの動的 import を含む初回と、常駐後の2回目を分けて測る**（P-AV-3 は「図ごと」の値なので、常駐後が本来の対象） |
| P-AV-4 | 保存（POST + 再取得 + 再検証）≤1.5秒 | 再取得の応答を得た時点 |
| P-AV-1 | 初期バンドルに mermaid/marked/viewer を含めない | ビルド成果物の走査（build-and-test で実測済み） |
| P-DS-1 | `GET /api/workflow` が state 1枚のパースのみ | 応答に matrix キーが無いこと + 応答時間 |
| P-RC-2a | 起動時の背景マトリクス構築 | `{building:true}` が返らなくなるまでの時間 |

## フィクスチャ

| 項目 | 値 |
|------|----|
| パス | `C:/work/tb-lxp` |
| ファイル数 | `aidlc/` 配下 687 |
| State Version | 7 |
| ピン | git commit `dbf87e7` |

**書き込みを伴う計測（P-AV-4）は tb-lxp では行わない**。team.md の read-only 規約を守るため、687ファイルをスクラッチへ複製し複製側で実施する（questions Q2）。計測後に tb-lxp が汚れていないことを確認する。

## 測定手順

### 1. サーバ側クリティカルパス（cold）

プロセスを自前で spawn し、t=0 を実測する:

1. `spawn` → stdout に ready 行が出るまで
2. 直後に `GET /api/workflow` を1回（**cold**。モジュールロードを含む）
3. `GET /api/matrix` を 10ms 間隔でポーリングし、`{building:true}` でなくなるまで（= 687ファイル走査の完了）

### 2. サーバ側（warm）

同一プロセスに対して `GET /api/workflow` ×20、`/api/matrix` ×10、`/api/artifact` ×10 を発行し、min / p50 / p95 / max を記録する。**平均を取らない** — 平均は最悪値を隠す。

### 3. ブラウザ側（NFR-2 の終点）

実ブラウザで対象を開き、Navigation Timing / Resource Timing から `navigationStart` 相対の時刻を取得する:

- `domContentLoadedEventEnd`
- `/api/workflow` の `responseEnd`（= Now strip がデータを得た時点）
- マトリクス関連リソースの `startTime`（**初回表示より後**にあることの確認）
- 初期アセットの cold 転送コスト（`cache: 'no-store'` で再取得して計測）

### 4. NFR-3（変更 → 反映）

WS を張り、監視対象ファイルへ書き込んでから `{type:"change"}` を受信するまでを 5 回測る。各試行後にファイルを元に戻し、次の試行まで 1.2 秒空ける（watcher の debounce と試行の混線を避けるため）。

### 5. P-AV-2 / P-AV-3（実 UI 経路）

マトリクスのセルを**実際にクリック**し、遅延チャンク取得 → 成果物取得 → 描画までを測る。API を直接叩くのではなく UI 経路で測るのは、P-AV-2 の機構（チャンクと取得の並行発火）が実際に効いているかを含めて見るためである。

mermaid を含む成果物に切り替え、SVG が DOM に出現するまでを測る。**これは同時に MA-6（FR-6.1 チェック項目2）の受入確認になる** — build-and-test から持ち越した項目をここで閉じる。

### 6. P-AV-4（保存）

スクラッチ複製に対して `POST /api/answer` → `GET /api/artifact` の往復を 5 回測り、**対象行以外がバイト不変**であることも同時に確認する。

## 記録の規約

- **cold と warm を必ず分けて記録する**。片方だけの数字は再現しない
- **平均でなく min / p50 / p95 / max**。体感を決めるのは最悪値である
- 測れなかったものは「測れなかった」と書く。推論で埋める場合は推論であると明示する

## 本ステージで測らないもの

| 項目 | 理由 | 扱い |
|------|------|------|
| MA-1 / MA-2（LAN 到達性） | 別端末が必要 | 未検証として matrix に記録 |
| MA-3（参加者 DOM） | 同上 | 同上 |
| MA-4（参加者側の反映時間） | 同上。ただしサーバ側 push レイテンシが同一 broadcast 経由でそのまま適用されることは示せる | 推論として明記し、実測は未了とする |
| MA-7（macOS 経路） | 実機が必要 | 未検証 |
| 10MB 成果物 | サーバが `file-too-large` で拒否するため到達不能 | 対象外 |
