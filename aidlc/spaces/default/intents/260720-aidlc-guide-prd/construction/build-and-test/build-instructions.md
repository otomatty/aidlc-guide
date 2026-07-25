# Build Instructions — AIDLC Guide

> build-and-test (3.6) / lead: quality（support: devsecops）/ 2026-07-25
> 入力: 全9 Unit の `construction/<unit>/code-generation/{code-generation-plan.md,code-summary.md}`
> 前提: 本プロジェクトは**ローカル専用ツール**。クラウド・CI 基盤・環境変数によるデプロイ先切替は存在しない（team.md Deployment）。

## 前提条件

| 要件 | 版 | 確認コマンド | 備考 |
|------|----|-----------|------|
| bun | 1.3.6 で検証 | `bun --version` | **唯一のランタイム**（C-T1 / NFR-5）。Node.js は不要 |
| OS | Windows 11（Git Bash）/ macOS | — | 両系統サポート必須（C-T4 / NFR-4）。CI は無いため、両方で人手確認する |
| git | 任意版 | `git --version` | `btw --fork` のセッション解決と、async-sharing 規約で使用 |

データベース・追加のプロセスマネージャ・クラウドアカウントは**不要**（project.md Forbidden）。

## 依存インストール

```bash
bun install --frozen-lockfile
```

期待される出力（既にインストール済みの場合）:

```
bun install v1.3.6
Checked 660 installs across 700 packages (no changes)
```

- `bun.lock` は**コミット済みの真実**であり、`--frozen-lockfile` はそれとの乖離を失敗として検出する（project.md Mandated: lockfile をピン留めして真実とする）。
- 依存を意図的に更新した場合のみ `--frozen-lockfile` を外す。その差分は必ずレビュー対象に含める。
- ワークスペースは bun workspaces（`packages/*`）。個別パッケージで `bun install` を叩く必要はない。

## 環境設定

**環境変数は不要**。設定ファイルも必須のものは無い。

| 項目 | 既定 | 変更方法 |
|------|------|---------|
| Dashboard の待受ポート | 4700 | `--port <n>` |
| bind アドレス | `127.0.0.1`（loopback） | `--host` で `0.0.0.0`（**LAN 公開 = データ開示イベント**。NFR-7 / `docs/guides/live-share.md`） |
| docs の解決先 | リポジトリ同梱 | docs-bridge の設定（FR-5.2） |

`--host` を環境変数や設定ファイルから暗黙に有効化する経路は**存在しない**（BR-MM-1）。露出は常に明示的なコマンド操作でのみ起きる。

## ビルド

対象は SPA（`packages/dashboard`）のみ。他の6パッケージは bun が TypeScript を直接実行するためビルド成果物を持たない。

```bash
bun run build:dashboard
```

期待される出力（末尾）:

```
✓ built in 16.46s
```

補足: `mermaid.core` などのチャンクに Vite の 500 kB 超警告が出るが、**これは想定どおり**である。mermaid / marked / artifact-viewer はすべて動的 import 経由の遅延チャンクであり、初期チャンク（`assets/index-*.js`、約 232 kB / gzip 74 kB）には含まれない（P-AV-1）。警告はチャンク**単体**のサイズに対するもので、初期ロードのサイズではない。

### ビルド検証

```bash
grep -c "mermaid" packages/dashboard/dist/assets/index-*.js
```

期待される出力: `0`（初期チャンクに mermaid が混入していないこと = P-AV-1 の機械的検証）

同様に `marked` / `securityLevel` / ビューア固有文字列も 0 であること。

## 起動

```bash
bun run dashboard
```

`build:dashboard` を実行してから `packages/dashboard-server/src/cli.ts` を起動する連結コマンド。引数はそのまま CLI に渡る（`bun run dashboard --host` は有効）。

期待される出力（loopback 既定）:

```
AIDLC Guide dashboard: http://127.0.0.1:4700
```

MCP サーバーは stdio 経由で Claude Code から起動される（`packages/mcp-server/README.md` の `.mcp.json` 断片を参照）。単体起動は不要。

## トラブルシュート

| 症状 | 原因 | 対処 |
|------|------|------|
| `Failed to start server. Is port 4700 in use?` | ポート衝突 | `--port <別の番号>` を指定。**loopback へ自動フォールバックはしない**（BR-MM-5。黙って公開範囲を変えないため） |
| `dist/` が無い旨のヒントが出る | `build:dashboard` 未実行 | `bun run dashboard` は build を含むので、そちらを使う |
| `bun install` が lockfile 差分で失敗 | 依存を触った / 別 OS で解決が変わった | 差分が意図的なら lockfile ごとコミットする。意図的でなければ `git checkout bun.lock` で戻す |
| Windows でパス関連の失敗 | `path.sep` 決め打ちのコード混入 | `node:path` / bun のクロスプラットフォーム API を使う（team.md Code Style）。両 OS での実行が唯一の検出手段（CI が無いため） |
| `bun audit` が脆弱性を報告 | 直接依存または推移依存の CVE | **ゲート失敗として扱う**（lint 失敗と同格）。`overrides` でのピン留めか依存更新で解消する。抑制はしない |
