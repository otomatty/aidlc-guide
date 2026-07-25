# Build and Test Summary — AIDLC Guide

> build-and-test (3.6) / lead: quality（support: devsecops）/ 2026-07-25
> 入力: 全9 Unit の `construction/<unit>/code-generation/{code-generation-plan.md,code-summary.md}`
> 実測値の出典: 本ディレクトリの `build-test-results.md`（実行して観測したもの）

## 総合判定

| 観点 | 状態 | 根拠 |
|------|------|------|
| **build-ready** | ✅ | `bun install --frozen-lockfile` → `bun run build:dashboard` が成功。前提は bun 1.3.6 のみ。DB・環境変数・クラウドアカウント不要 |
| **test-ready** | ✅ | `bun run check` が exit 0。52ファイル / 685 passed / 2 skipped（環境条件付き）/ 0 failed |
| **deployment-ready** | ✅（local-only の定義において） | 本プロジェクトに環境・CD は存在しない。「リリース」= `main` への squash-merge または git タグ、配布は `bun install` → `bun run <script>`（team.md Deployment） |

**残る条件**: 下記「残存する手動確認」7件のうち、MA-1/2/3（LAN 到達性と参加者 DOM）と MA-6（mermaid 実描画）は**モブ運用を始める前に**通す。それ以外は運用開始後でよい。

## 生成した指示書

| ファイル | 生成理由 |
|---------|---------|
| `build-instructions.md` | 前提・依存・ビルド・起動・トラブルシュート |
| `unit-test-instructions.md` | Standard 戦略の必須 |
| `integration-test-instructions.md` | Standard 戦略の必須。Unit 境界4種を定義 |
| `performance-test-instructions.md` | 戦略の必須ではないが、**実測可能な数値目標（NFR-2/3、P-AV-*）が存在する**ため生成。実測自体は performance-validation (4.6) の責務 |
| `security-test-instructions.md` | 同上。**書込境界・パス containment・公開範囲**という守るべき不変条件が project.md Mandated/Forbidden に明記されており、その検証手順を残す必要がある |
| `build-test-results.md` | 実行結果 |

Standard 戦略の既定は unit + integration の2点。performance / security を足したのは、この2つが本プロジェクトでは「あれば良い」ではなく**受入条件そのもの**だからである（NFR-1/2/3/7 と project.md の Mandated 群）。

## テスト種別インベントリ

| 種別 | 実行方法 | 状態 |
|------|---------|------|
| 単体 | `bun run test`（Vitest 2プロジェクト） | ✅ 685 passed |
| 統合（実プロセス HTTP/WS） | 同上に含む（`server-smoke.test.ts`） | ✅ |
| 統合（実 stdio） | 同上に含む（`mcp-server/server-smoke.test.ts`） | ✅ |
| 契約（cross-consumer） | 同上に含む（docs-bridge を Dashboard と MCP が同一 slug で引く） | ✅ |
| 構造（依存方向・書込経路の走査） | 同上に含む（`dependency-direction.test.ts` ×2） | ✅ |
| ゴールデン（共有ベクタ） | 同上に含む（`guard-path-vectors.ts` を2パッケージが実行） | ✅（symlink ベクタのみ本環境で skip） |
| 静的解析 | `biome check .` | ✅ 155ファイル |
| 型検査 | `tsc --noEmit` ×2 | ✅ |
| 依存監査 | `bun audit` | ✅ |
| 性能（秒数） | 手動計測 | ⏳ performance-validation (4.6) |
| a11y（実ブラウザ） | 手動 | ⏳ |

すべて**単一コマンド `bun run check`** に収束する。CI 基盤が無いため、これがこのプロジェクトの唯一のゲートである（team.md）。だからこそ、負荷由来で赤くなるテストは許容しない（`asyncUtilTimeout: 5000` の設定はこの理由による）。

## Unit 別のカバレッジ期待と実測

| Unit / パッケージ | 期待 | 実測（statement） | 備考 |
|------------------|------|-----------------|------|
| reader-core | parse は **branch 95% 強制** | 96.77%（`parse/state.ts` は statement 100% / branch 98.82%） | 本プロジェクトのリスク中心 |
| docs-bridge | 標準 | 100% | zero-runtime-dependency を維持 |
| mcp-server | 標準 | 100% | bin は smoke で担保（v8 除外） |
| dashboard-server | 標準 | 97.61% | server/cli は smoke で担保（v8 除外） |
| dashboard (UI) | line 80% 目安 | components 94.94% / viewer 96.64% / store 100% | `main.tsx` は v8 除外 |
| btw | 標準 | 98.70% | spawn/cli は手動 smoke（MA-7） |
| shared-types | — | — | 型のみ。`tsc` が唯一の検査 |
| mob-mode / artifact-viewer / ops-guides | — | 上記パッケージに内包 | Unit ＝ パッケージではない（mob-mode は dashboard-server + dashboard に跨る4ファイル、ops-guides は `docs/guides/` の2文書） |

## 残存する手動確認（偽装せず残す）

| ID | 内容 | 必要なもの | 優先 |
|----|------|----------|------|
| MA-1 | 既定起動でポートが LAN から**到達不能** | 別端末 | モブ前 |
| MA-2 | `--host` 起動で LAN から到達可能 + 警告が読める | 別端末 | モブ前 |
| MA-3 | 参加者ブラウザの DOM に編集要素が0件 | 別端末 + devtools | モブ前 |
| MA-6 | FR-6.1 項目2 — mermaid が**図として**描画される | 実ブラウザ | モブ前 |
| MA-4 | 参加者側の反映時間が NFR-3 内 | 別端末 + 計測 | 4.6 |
| MA-7 | btw の macOS 経路（`btw` / `--fork` / `-p`） | macOS | 運用前 |
| — | symlink containment ベクタ | symlink 作成権限のある環境 | 早めに |

MA-6 は率直に非対称な状態である: WYSIWYG 第一候補 Milkdown は**実測**（mermaid フェンスが図にならない）で落としたのに、後継の `marked.lexer()` 経路の同項目は jsdom のモック越しでしか確認していない。トークン層（`lang=mermaid` のフェンスが `code` トークンとして分離され `MermaidBlock` に渡ること）は実データで確認済みなので設計判断が覆るとは見ていないが、**未確認であることは事実**として残す。

## 既知の限界

- **自動回帰検出を持たない**。性能もドキュメントの文言同期も、変更時に人が再確認する運用に依存する（CI 基盤を持たないという決定の帰結）。
- **クロス OS の検証は人手のみ**。Windows 経路は本実行で通っているが、macOS 経路は未実行（MA-7）。`path.sep` 決め打ち等の混入は、両 OS で走らせる以外に検出手段が無い。
- **cold start で `hostMode` が不明な窓がある**。初回 `/api/workflow` が失敗した場合、クライアントは host モードを知り得ず（`AppState.hostMode` が `boolean` で「不明」を表現できない）、ReadOnlyBadge が出ず編集 UI が描画され得る。サーバの 403 は生きているため書き込みは通らない。`boolean | null` 化は契約変更のため、後続パスで判断する（`code-generation/memory.md` の Open questions に記録済み）。

## 次ステージへの引き継ぎ

- **ci-pipeline (3.7)**: CI 基盤が存在しないローカル専用プロジェクトであるため、`bun run check` を唯一のゲートとする前提で構成する。パイプライン定義を作るのであれば、その事実（環境なし・デプロイなし）を出発点にすること。
- **performance-validation (4.6)**: `performance-test-instructions.md` の手順と、上表の MA-4 を引き継ぐ。tb-lxp をピン留めしたうえで cold/warm を分けて記録する。
