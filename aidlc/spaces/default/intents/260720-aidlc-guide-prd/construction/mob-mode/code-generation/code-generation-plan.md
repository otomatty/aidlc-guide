# Code Generation Plan — Unit: mob-mode

> code-generation (3.5) / Unit: mob-mode (kind: service, M) / 2026-07-25
> 入力: functional-design（U5 所有表 + M1〜M3 / BR-MM-1〜7 + 受入条件）
> + nfr-design（logical-components のモジュール表 / performance-design P-MM-1〜3 /
> security-design S-MM-1〜6 / reliability-design R-MM-1〜5）
> + nfr-requirements（tech-stack-decisions / SC-MM-1〜2）
> 実装場所: 既存の `packages/dashboard-server/src/` と `packages/dashboard/src/`
> （**新パッケージ・新プロセスを作らない** — ADR-04）

## 0. 本 Unit が実装しない範囲（U5 が所有済み・実装済み）

BLM 冒頭の所有表どおり。**コードを一切足さない**まま、本 Unit は要求・検証だけを行う:

| 挙動 | 所有 | 現状 |
|------|------|------|
| bind 分岐（既定 127.0.0.1 / `--host` で 0.0.0.0） | U5 `server.ts` | 実装済み・緑 |
| 公開警告文字列 `HOST_EXPOSURE_WARNING` | U5 `server.ts` | 実装済み・緑 |
| `serverMode.hostMode` を `GET /api/workflow` に載せる | U5 `handlers/read.ts` | 実装済み・緑 |
| hostMode 中の `POST /api/answer` 無条件 403 | U5 `handlers/answer-writer.ts` | 実装済み・緑 |
| 全クライアント同一の WS broadcast | U5 `push.ts` | 実装済み・緑 |

したがって本 Unit の diff は**追加4ファイル + それを成立させる最小の配線**に限る。

## 1. モジュール（logical-components.md のモジュール表どおり）

| ファイル | 責務 | 主要 ID |
|---------|------|--------|
| `packages/dashboard-server/src/exposure-notice.ts` | `buildExposureNotice(port, host)`: NIC 列挙 → `ExposureNotice`。U5 の警告定数を **import**（複製しない）。列挙失敗は `addresses: []` | M1 / S-MM-2 / S-MM-4 / R-MM-2 / P-MM-1 |
| `packages/dashboard/src/store/liveStatusView.ts` | `LiveSlice → LiveStatusView` の純関数。`connected=false` から `live` を返す分岐を**構造的に持たない** | M3 / R-MM-3 |
| `packages/dashboard/src/components/LiveStatus.tsx` | 4状態の描画（`role="status"` + `aria-live="polite"`、`Intl.RelativeTimeFormat`） | M3 / a11y 4.1.3 |
| `packages/dashboard/src/components/ReadOnlyBadge.tsx` | `role="status"` バッジ「READ-ONLY · 参加者ビュー」 | M2 / US-11 |

## 2. 配線（付随変更 — 上記4ファイルを成立させるのに必要な最小限）

- **`dashboard-server/src/cli.ts`**: 起動時に1回 `buildExposureNotice` を呼び（P-MM-1）、
  `--host` のとき警告に続けてアドレス一覧を出力する。
- **`dashboard/src/store/state.ts` / `reducer.ts` / `services/live.ts`** —
  **`live` スライスが4状態を表現できないため拡張が必要**。現状は
  `{connected, degraded, reason?}` で、(a)「初回接続前」と「切断後」を区別できず、
  (b)「最終更新」の時刻を持たない。最小の追加:
  - `everConnected: boolean` — 一度でも socket が open したか。connecting / reconnecting の分岐点。
  - `lastChangeAt?: string` — **実際に受信した `change` push の時刻**。接続時刻でも推測でもない。
    stamp は `services/live.ts`（socket 側）で行い、`{type:"ws"}` アクションに `receivedAt`
    を載せて渡す（reducer を計測可能に保つ）。
- **`dashboard/src/components/Header.tsx`**: 新2ファイルから import。
- **`dashboard/src/components/atoms.tsx`**: 旧 `LiveStatus` / `ReadOnlyBadge` を**削除**
  （二重実装を残さない）。
- **`dashboard/src/styles/app.css`**: `data-state` を `LiveStatusView.kind` と 1:1 にする
  （`disconnected` → `reconnecting`、`connecting` は idle ドットを継承）。
- **`shared-types`**: `ServeOptions.host` / `ServerMode.hostMode` を `readonly` に
  （S-MM-6 の「実行中不変」を型で表す）。

## 3. 実装順（依存順）

1. `exposure-notice.ts` → `cli.ts` 配線 → 起動出力を実測
2. `live` スライス拡張（state → reducer → services/live.ts）
3. `liveStatusView.ts`（純関数。UI より先に確定させる）
4. `LiveStatus.tsx` / `ReadOnlyBadge.tsx` → `Header.tsx` 差し替え → `atoms.tsx` から削除
5. 既存テストの移設・強化 → `bun run check`

## 4. テスト計画

| ファイル | 対象 |
|---------|------|
| `packages/dashboard-server/tests/exposure-notice.test.ts` | NIC 列挙（IPv4 のみ / internal 除外 / 複数 NIC）、列挙失敗 → 空（R-MM-2）、loopback 起動、**警告文言の複製検出（構造検査: src 走査で所有ファイル1件 + import の存在）**、出力にホスト名・ユーザー名・cwd が含まれないこと（S-MM-4） |
| `packages/dashboard/tests/mob-mode.test.tsx` | `liveStatusView` 4状態（BLM M3 表と1:1）+ 切断時に live を返さないこと、LiveStatus の role / aria-live / data-state / 文言、相対時刻の各単位、ReadOnlyBadge の文言と hostMode=false での不在、**読み取り失敗を跨いでバッジが残り編集 DOM が現れないこと（+ ポジティブコントロール）** |
| `packages/dashboard/tests/reducer.test.ts`（更新） | `everConnected` の遷移、`lastChangeAt` の stamp、縮退理由の消去、**hostMode が失敗読み取りで落ちないこと**、`live` 以外の全スライスの参照不変 |
| `packages/dashboard-server/tests/server-smoke.test.ts`（更新） | 既定 bind = 127.0.0.1 / hostMode の 403 / `serverMode.hostMode===true` / 警告の必須語（成果物・監査・秘密）/ 警告→アドレスの順序 / 起動出力のアドレス一覧 / **ポート占有下で起動が致命的に失敗し loopback へ落ちないこと（R-MM-1）** |

**自動化しない受入条件は、別端末が物理的に必要な3件のみ**（既定で LAN 不達 / `--host` で
LAN 到達 / 参加者反映時間）。偽装せず `code-summary.md` に手動受入項目として残す。
ポート占有下の起動テスト（R-MM-1）は既存 smoke harness が待ち合わせを持つため**自動化する**。

## 5. ゲート

`bun run check`（biome + `tsc --noEmit` ×2 + `vitest run --coverage` + `bun audit`）が全緑。
既存 657 テストを1件も壊さない（`live` スライス変更で失敗する assert は**移設・強化**して直す。
弱めない）。

> `hostMode` は「成功した `/api/workflow` だけが変えられる」粘着値として扱う
> （`deriveWorkflow` は失敗時に `null`＝不明を返し、reducer が直前値を保持）。
> 読み取り失敗で `false` に落とすと ReadOnlyBadge と参加者の編集 DOM 不在が同時に破れる。
