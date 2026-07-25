# Performance Test Instructions — AIDLC Guide

> build-and-test (3.6) / 2026-07-25
> 入力: 各 Unit の `code-summary.md` + `nfr-design/performance-design.md`（P-RC / P-DS / P-UI / P-AV / P-MM）+ requirements.md NFR-2 / NFR-3
> Standard 戦略の必須生成物ではないが、**実測可能な数値目標（NFR-2/NFR-3）が存在する**ため生成する。実測そのものは **performance-validation (4.6)** の責務であり、本書はその実行手順を定義する。

## 目標（合否の数値）

| ID | 目標 | 測定条件 |
|----|------|---------|
| NFR-2 | 起動 → 初回表示 **≤3秒** | tb-lxp フィクスチャ（約593ファイル）に対して |
| NFR-3 | 変更 → 反映 **≤2秒** | 同上。ファイル保存から参加者/ドライバー画面の更新まで |
| P-AV-2 | 成果物の初回オープン ≤1.5秒 / 2回目以降 ≤0.8秒 | 一般的な成果物（〜100KB） |
| P-AV-3 | Mermaid 描画 図ごと ≤500ms | 図を含む実成果物 |
| P-AV-4 | 保存操作（POST + 再取得 + 再検証）≤1.5秒 | `*-questions.md` の `[Answer]:` 行 |
| P-AV-1 | 初期バンドルに mermaid/marked/viewer を含めない | ビルド成果物の走査（**実装済み・検証済み**） |

NFR-2 の達成機構は**段階的初回描画**（ADR-03）: `GET /api/workflow` は `aidlc-state.md` 1枚のパースと next-step 解決のみで応答し、593ファイルの全走査は初回応答後の背景構築として `matrix-ready` の WS push で届く。したがって**初回表示のクリティカルパスに全走査は含まれない**。計測はこの前提が実際に成立しているかの確認でもある。

P-AV-* は NFR-2/NFR-3 のどちらにも**含まれない**（成果物を開くのはユーザーの明示操作）。加算関係にないため、独立した体感目標として個別に測る。

## フィクスチャの用意

tb-lxp を read-only で参照する（書き換えない）。決定的な比較のため**特定コミット/スナップショットにピン留めする**（team.md Testing Posture）。

```bash
# 対象ワークスペースのファイル数を確認（593前後であること）
find <tb-lxp>/aidlc -type f | wc -l
```

計測ごとに OS のファイルキャッシュ状態が変わるため、**cold/warm を分けて記録する**。cold は初回、warm は同一セッション内の2回目以降とし、両方を残す。片方だけの数字は再現しない。

## 測定手順

### NFR-2（起動 → 初回表示）

```bash
cd <tb-lxp のワークスペース>
bun run dashboard
```

1. ブラウザの devtools → Network / Performance を記録開始してから URL を開く
2. **計測の終点は「Now strip が phase / current stage / depth / gate 状態 / 完了数を表示した時点」**（FR-4.1 の受入基準）。Unit×Stage マトリクスの到着（`matrix-ready`）は終点に**含めない** — ADR-03 の設計どおり初回表示の後段だからである
3. `GET /api/workflow` の応答時間を別途記録する（サーバ側予算の内訳確認）

記録する値: cold の合計 / warm の合計 / `GET /api/workflow` 単体 / `matrix-ready` 到着までの追加時間。

### NFR-3（変更 → 反映）

```bash
# 別ターミナルから、監視対象のファイルに触れる
touch <tb-lxp>/aidlc/spaces/default/intents/<intent>/aidlc-state.md
```

保存の瞬間から画面が更新されるまでを計測。chokidar の debounce を含む値であり、**参加者ビュー側でも同じ計測を行う**（同一 broadcast を使うため、参加者専用経路は存在しない — BR-MM-4）。

### P-AV-2 / P-AV-3 / P-AV-4

| 測定 | 手順 | 注意 |
|------|------|------|
| P-AV-2 初回 | マトリクスのセルをクリック → 成果物が描画されるまで | チャンク取得と `GET /api/artifact` が**並行**であることを Network タブの waterfall で確認する（直列に見えたら P-AV-2 の機構が壊れている） |
| P-AV-2 2回目 | 同じ成果物を閉じて開き直す | チャンクは解決済み。**リクエストは新規に飛ぶ**のが正しい（コンテンツキャッシュではない） |
| P-AV-3 | mermaid を含む成果物（`component-dependency.md` / `unit-of-work-dependency.md`）を開く | 図ごとに計測。1図目は `mermaid` の動的 import を含むため2図目以降と分けて記録する |
| P-AV-4 | `*-questions.md` の `[Answer]:` 行を編集して保存 | POST → 再取得 → バイト不変再検証までの合計 |

### P-AV-1（バンドル分離）— 自動検証済み

```bash
bun run build:dashboard
grep -c "mermaid" packages/dashboard/dist/assets/index-*.js
```

期待: `0`。`marked` / `securityLevel` / ビューア固有文字列も同様に 0。初期チャンクの実測は 232.84 kB / gzip 74.11 kB。

## 大サイズ成果物（P-AV-5）

| サイズ | 期待挙動 |
|-------|---------|
| < 1MB | リッチ描画（`marked.lexer()` → React 要素） |
| ≥ 1MB | **リッチ描画に入らず** plain preview 固定（描画前に判定するため、重い描画を開始しない） |
| > 10MB | サーバが `file-too-large` で拒否するため viewer に届かない |

1MB 境界はテストで検証済み。10MB は到達不能経路のため実測しない。

## 回帰の検出

ベースラインは performance-validation で確定した実測値とする。CI が無いため**自動回帰検出は持たない**。以下を変更したときに再計測する運用で代替する:

- `reader-core/src/parse/**` または `tree/matrix.ts`（走査の重さが変わる）
- `dashboard-server/src/handlers/read.ts`（初回応答の内容が変わる）
- `packages/dashboard` の依存追加（初期バンドルが膨らむ）
- `MarkdownSurface.tsx` の実装差し替え（ADR-05 の交代が起きたとき）

## 未計測であることの明示

本ステージ時点で**実測済みは P-AV-1（バンドル分離）と P-AV-2 の並行性（テストによる観測）と P-AV-5 の 1MB 経路のみ**。秒数目標（NFR-2 / NFR-3 / P-AV-2..4）は tb-lxp に対する実測が未了であり、performance-validation (4.6) で確定させる。本書の数値は目標であって実績ではない。
