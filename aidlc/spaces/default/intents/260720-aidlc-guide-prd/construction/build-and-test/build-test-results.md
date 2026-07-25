# Build and Test Results — AIDLC Guide

> build-and-test (3.6) / 実行日: 2026-07-25 / 実行環境: Windows 11（Git Bash）+ bun 1.3.6
> 入力: `build-instructions.md` / `unit-test-instructions.md` / `integration-test-instructions.md` の各コマンド
> 本書は**実行して観測した結果**であり、目標や見込みではない。

## サマリ

| 工程 | 結果 |
|------|------|
| 依存インストール（`--frozen-lockfile`） | ✅ 成功（lockfile と乖離なし） |
| ビルド（`build:dashboard`） | ✅ 成功（17.32s） |
| 静的解析（Biome） | ✅ 155ファイル、指摘なし |
| 型検査（`tsc --noEmit` ×2） | ✅ エラーなし |
| テスト（Vitest 2プロジェクト） | ✅ 52ファイル / 685 passed / 2 skipped / **0 failed** |
| 依存監査（`bun audit`） | ✅ 脆弱性なし |
| 総合（`bun run check`） | ✅ **exit 0** |

修正を要する失敗は発生しなかったため、ステージ手順の「失敗時の診断・修正（最大2回）」は発動していない。

## 1. 依存インストール

```
$ bun install --frozen-lockfile
bun install v1.3.6 (d530ed99)

Checked 390 installs across 441 packages (no changes) [266.00ms]
```

lockfile はコミット済みの内容と一致。未コミットの依存変更は無い。

## 2. ビルド

```
$ bun run build:dashboard
dist/assets/index-CsbJQmik.css     11.08 kB │ gzip:   2.45 kB
dist/assets/index-CGBSdQNm.js      50.53 kB │ gzip:  16.55 kB   ← artifact-viewer（遅延）
dist/assets/index-xAm3UF0w.js     232.84 kB │ gzip:  74.11 kB   ← 初期チャンク
dist/assets/mermaid.core-*.js     582.62 kB │ gzip: 136.91 kB   ← 遅延（図が現れたときのみ）
dist/assets/cynefin-*.js          687.47 kB │ gzip: 151.76 kB   ← mermaid の図種別チャンク
✓ built in 17.32s
```

Vite が 500 kB 超のチャンクに警告を出すが、**該当はすべて動的 import 経由の遅延チャンク**であり初期ロードには含まれない。警告はチャンク単体のサイズに対するもので、初期ロードサイズの指標ではない。

### P-AV-1 検証（初期チャンクの汚染チェック）

`index.html` が参照する実際のエントリを特定してから走査する。`assets/index-*.js` というグロブは viewer チャンクにも一致するため、glob で数えると誤って非ゼロになる（本実行で一度その誤検出を踏み、`index.html` 由来のファイル名で再測した）。

```
$ ENTRY=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' packages/dashboard/dist/index.html | head -1)
entry from index.html: assets/index-xAm3UF0w.js
mermaid          0
marked           0
securityLevel    0
成果物を閉じる    0
entry bytes: 232842
```

✅ **P-AV-1 成立**: 初期チャンク 232,842 バイト（gzip 74.11 kB）に mermaid / marked / ビューア固有文字列は1件も含まれない。

## 3. 静的解析・型検査

```
$ biome check .
Checked 155 files in 147ms. No fixes applied.

$ tsc --noEmit                          → エラーなし
$ tsc --noEmit -p packages/dashboard    → エラーなし
```

`docs/**` は Biome の lint 対象外（Biome 2.x は Markdown を lint しない）。除外設定は追加していない。

## 4. テスト

```
$ vitest run --coverage
 Test Files  52 passed (52)
      Tests  685 passed | 2 skipped (687)
```

プロジェクト別内訳:

| project | ファイル | テスト |
|---------|---------|-------|
| `node` | 35 | 500 passed / 2 skipped |
| `dashboard`（jsdom） | 17 | 185 passed |

### skip された2件（正常）

どちらも `skipIf` による環境条件付きスキップで、無効化されたテストではない:

| 場所 | 条件 |
|------|------|
| `docs-bridge/tests/data-lint.test.ts:27` | docs リポジトリが手元に無い環境 |
| `docs-bridge/tests/vectors/guard-path-vectors.ts:134` | symlink 作成権限が無い環境（Windows で開発者モード未有効） |

**2件目は注意が必要**: symlink による containment 突破ベクタの検証がこの環境では走っていない。権限のある環境で一度必ず通すこと（`security-test-instructions.md` S-2）。

### カバレッジ（実測）

```
Statements   : 96.53% ( 1504/1558 )
Branches     : 92.60% (  989/1068 )
Functions    : 96.78% (  361/373  )
Lines        : 97.73% ( 1336/1367 )
```

| 対象 | 基準 | 実測 | 判定 |
|------|------|------|------|
| `reader-core/src/parse/**`（強制閾値） | branch 95% / stmt 95% / func 95% / line 95% | **statement 100% / branch 98.82%** | ✅ |
| UI 層（目安 line 80%） | 80% | `dashboard/src/components` 94.94% / `viewer` 96.64% / `store` 100% / `services` 95.23% | ✅ |
| 最も低い区分 | — | `dashboard/src/app`（App.tsx）branch 50% | 許容（ブート配線のみ。分岐は2本） |

パッケージ別の statement カバレッジ: `docs-bridge` 100% / `mcp-server` 100% / `btw` 98.70% / `dashboard-server` 97.61% / `reader-core` 96.77%。

## 5. 依存監査

```
$ bun audit
bun audit v1.3.6 (d530ed99)
No vulnerabilities found
```

MCP SDK が推移的に引いていた `@hono/node-server` の脆弱性は、抑制ではなくルート `overrides` でのピン留めにより解消済み。

## 6. 統合（実プロセス）の実行状況

以下は上記スイートに**含まれて実行された**（別コマンドではない）:

- `dashboard-server/tests/server-smoke.test.ts` — bun 子プロセスを spawn し実 HTTP/WS で検証（bind 分岐 / 警告文言と順序 / アドレス列挙の形 / 403 / ポート衝突時の致命的終了）
- `mcp-server/tests/server-smoke.test.ts` — 実 stdio で5ツールと記録外パス拒否3ベクタ
- `dashboard/tests/detail-panel.test.tsx` — 遅延チャンクと成果物取得の**並行性**（P-AV-2）を、DOM 未マウント時点の fetch 発行で観測

## 残存する既知の限界

| ID | 内容 | 理由 |
|----|------|------|
| MA-1/2 | LAN 到達性（既定で不達 / `--host` で到達） | 別端末が必要 |
| MA-3 | 参加者ブラウザの DOM に編集要素が無いこと | 実ブラウザでの再確認（jsdom では検証済み） |
| MA-4 | 参加者側の反映時間 | 別端末 + 計測 |
| MA-6 | FR-6.1 チェック項目2（mermaid の実描画） | jsdom では mermaid をモックしている。**候補を落とした基準（実測）と後継を採用した基準（グルーの単体テスト）が非対称**であることを自認した上での残件 |
| MA-7 | btw の macOS 経路 | Windows 経路のみ実行済み |
| — | symlink containment ベクタ | 本実行環境では権限不足で skip |
| — | NFR-2 / NFR-3 / P-AV-2..4 の秒数 | tb-lxp に対する実測は **performance-validation (4.6)** の責務 |

いずれも偽装していない。手動確認の結果は、実施時にこの表へ追記する。
