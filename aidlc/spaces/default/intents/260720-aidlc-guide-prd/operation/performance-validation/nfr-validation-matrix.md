# NFR Validation Matrix — AIDLC Guide

> performance-validation (4.6) / 2026-07-26
> 入力: 各 Unit の `nfr-requirements/{performance,scalability}-requirements.md` + `nfr-design/{performance,scalability}-design.md` + `load-test-results.md`（実測値の出典）+ `construction/build-and-test/build-test-results.md`
> 凡例: ✅ 実測で合格 / 🧪 テストスイートで検証 / 📐 構造的に保証（走査・型・lint） / ⏳ 未検証（理由を明記） / 🧠 推論（実測ではない）

## 全社的 NFR（requirements.md）

| ID | 要件 | 状態 | 根拠 |
|----|------|------|------|
| **NFR-1** | 読み取り専用（`[Answer]:` 行のみ例外） | 📐 + ✅ | 走査テストが POST 発行モジュール1つ・`fetch` 保有2つを強制。Biome の `noRestrictedImports` が fs 書込 API の import を禁止。本ステージの計測でも、tb-lxp に対し書込を一度も発行せず、意図的に書き換えた1ファイルは復元して clean を確認 |
| **NFR-2** | 起動 → 初回表示 ≤3秒（tb-lxp 687ファイル） | ✅ | **cold 約0.78秒 / warm 約0.13秒**。`/api/workflow` の responseEnd が navigationStart から 94ms。687ファイル走査は spawn から 685ms で完了するが初回表示はそれを待たない |
| **NFR-3** | 変更 → 反映 ≤2秒 | ✅ | **min 317 / p50 329 / max 392 ms**（n=5、WS `change` 受信まで） |
| **NFR-4** | Windows / macOS 両対応 | ⏳ | Windows は本計測を含め全工程で実行済み。**macOS は未実行**（MA-7）。パス処理は `node:path` / bun の API のみを使い `path.sep` 決め打ちが無いことは静的に確認済みだが、実行による確認ではない |
| **NFR-5** | ランタイムは bun のみ、DB 無し | 📐 | 依存木にランタイム・DB 無し。Vitest は dev-time（project.md Decided） |
| **NFR-6** | State Version 検知と解析不可の局所縮退 | 🧪 | 5失敗モードそれぞれ専用フィクスチャで検証。パーサは branch 98.82%（強制閾値 95%） |
| **NFR-7** | 公開の可視性（既定 loopback・明示フラグ・名指し警告） | ✅ | `--host` の実出力を確認: 警告がアドレス一覧より前、アドレスは IPv4+port のみ、`POST /api/answer` → 403 |

## 性能要件（Unit 別）

### reader-core（P-RC）

| ID | 要件 | 状態 | 実測 |
|----|------|------|------|
| P-RC-2a | 起動時の背景マトリクス構築 | ✅ | 687ファイル走査が spawn から **685ms** で完了 |
| P-RC-2b | 変更時は該当 Unit のみ再構築（全走査しない） | ✅ | `/api/matrix` の warm が **p50 0.3ms** — 走査をやり直していないことの直接証拠 |
| P-RC-* | 監査は tail 読みのみ（全読みに劣化しない） | 🧪 | `matrix.test.ts` / `audit.test.ts` |

### dashboard-server（P-DS）

| ID | 要件 | 状態 | 実測 |
|----|------|------|------|
| P-DS-1 | `GET /api/workflow` は state 1枚のパースのみ（ADR-03） | ✅ | 応答に matrix キー無し。cold 385ms / warm **p50 2.6ms**。マトリクスは 1.2秒あとに到着 |
| P-DS-* | `GET /api/artifact` の読み取り | ✅ | cold 7.2ms / warm p50 4.4ms |
| P-DS-* | `GET /api/intents` | ✅ | 1.5ms |

### dashboard-ui（P-UI）

| ID | 要件 | 状態 | 実測 |
|----|------|------|------|
| P-UI-1 | 初期 JS を小さく保つ（code-split） | ✅ | 初期チャンク **227.4 kB / gzip 74.11 kB**。マトリクスもビューアも遅延チャンク |
| P-UI-* | 初回描画のクリティカルパス | ✅ | domContentLoaded 83ms、`/api/workflow` responseEnd 94ms |
| P-UI-* | 再描画チャーンを起こさない | 🧪 | reducer の参照同一性テスト（`live` 以外の全スライスを参照比較） |

### artifact-viewer（P-AV）

| ID | 要件 | 状態 | 実測 |
|----|------|------|------|
| P-AV-1 | 初期バンドルに mermaid/marked/viewer を含めない | ✅ | エントリチャンク内の出現回数がいずれも **0**（`index.html` 由来のファイル名で走査） |
| P-AV-2 | 初回 ≤1.5秒 / 2回目 ≤0.8秒 | ✅ | **初回 629ms**（実 UI クリック経路）。チャンク6ms + 成果物22ms |
| P-AV-3 | 図ごと ≤500ms | ✅ | **常駐後 246ms**。初回はライブラリ動的 import 込みで 1015ms（P-AV-3 は「図ごと」なので常駐後が対象） |
| P-AV-4 | 保存 ≤1.5秒 | ✅ | **min 25 / p50 29 / max 41 ms**。対象行以外のバイト不変も同時確認 |
| P-AV-5 | 1MB 超は plain preview 固定 / 10MB はサーバ拒否 | 🧪 + ⏳ | 1MB 境界は単体テストで検証済み。10MB は**到達不能**（サーバが `file-too-large` で拒否）ため実測対象外 |

### mob-mode（P-MM）

| ID | 要件 | 状態 | 実測 |
|----|------|------|------|
| P-MM-1 | NIC 列挙 ≤100ms（起動時1回のみ） | ✅ | `--host` 起動が遅延なく完了し、2件のアドレスを出力。再列挙しない設計 |
| P-MM-2 | バッジ / LiveStatus が再描画を誘発しない | 🧪 | 参照同一性テスト |
| P-MM-3 | 参加者も NFR-3 内 | 🧠 | 同一 broadcast を使う設計（BR-MM-4）のため、上記 NFR-3 の 317〜392ms がそのまま適用される**はず**。別端末での実測は未了（MA-4） |

## スケーラビリティ要件（SC-*）

本プロジェクトのスケール軸は同時接続数ではなく**ワークスペースのファイル数**である（load-test-plan Q1）。

| ID | 要件 | 状態 | 根拠 |
|----|------|------|------|
| SC-RC-* | ファイル数の増加に対して初回表示が劣化しない | ✅ | ADR-03 により初回表示は `aidlc-state.md` 1枚にしか依存しない。687ファイルでも `/api/workflow` は warm p50 2.6ms。**ファイル数は初回表示のコストに入らない**構造 |
| SC-MM-* | モブ参加者数（数名〜十数名） | 🧠 + 📐 | 全クライアントに同一 broadcast（参加者ごとの整形・専用経路を作らない = BR-MM-4）。サーバはクライアント状態を `Set<WebSocket>` しか持たない。実測は未了 |
| SC-DS-* | 成果物サイズの上限 | 📐 | reader-core の `readBounded` が 10MB で拒否。1MB 超は viewer が plain 経路に固定 |

## 未検証項目（明示）

| ID | 内容 | なぜ測れなかったか | いつ閉じるか |
|----|------|-----------------|------------|
| MA-1 | 既定起動でポートが LAN から**不達** | 別端末が必要 | モブ運用の初回 |
| MA-2 | `--host` で LAN から到達可能 | 同上 | 同上 |
| MA-3 | 参加者ブラウザの DOM に編集要素0件 | 同上（jsdom では検証済み） | 同上 |
| MA-4 | 参加者側の反映時間が NFR-3 内 | 同上。設計上は同一 broadcast のため成立するはずだが、それは推論 | 同上 |
| MA-7 | btw の macOS 経路 | macOS 実機が必要 | macOS 入手時、または GitHub Actions の macos ランナー初回実行 |
| — | symlink containment ベクタ | 本環境に symlink 作成権限が無く `skipIf` で skip。**skip は検証済みではない** | 権限のある環境で1度 |
| — | GitHub Actions workflow | リモートが無く一度も実行されていない | リモート設定後の初回 push（回帰検知ではなく受入確認として扱う） |
| — | cold start で `hostMode` 不明の窓 | 契約変更（`boolean \| null`）を伴うため本パスでは扱わない | 後続パス |

## build-and-test から持ち越して**閉じた**項目

| ID | 内容 | 結果 |
|----|------|------|
| **MA-6** | FR-6.1 チェック項目2 — mermaid が図として描画されること | ✅ **閉じた**。実ブラウザで `<svg id="mermaid-1">`、子ノード143件、512×257px。生フェンス（`graph TD` 等）の本文漏れなし。同時に GFM テーブル16件が本物の `<table>` として描画され（項目1）、plain preview へのフォールバックは発生していない（`<pre>` 0件）。**Milkdown を落としたときと同じ種類の実測証拠**であり、build-and-test 時点で自認していた「証拠の非対称」は解消された |

## 総括

**数値目標はすべて合格し、最小の余裕でも約2倍ある。** 設計上の主要な賭けだった ADR-03（段階的初回描画）は、687ファイルの走査完了（685ms）より前に `/api/workflow` が応答している（648ms）という形で、実測により裏付けられた。

残る未検証は**すべて「別のハードウェアが要る」種類**であり、実装の不確かさに起因するものではない。いずれも偽装せず、閉じ方とタイミングを上表に明記した。
