# CI Configuration — AIDLC Guide

> ci-pipeline (3.7) / lead: pipeline-deploy / 2026-07-26
> 入力: 全9 Unit の `construction/<unit>/code-generation/code-summary.md` + `construction/build-and-test/build-and-test-summary.md` + `construction/build-and-test/build-test-results.md`（実測値の出典）+ `ci-pipeline-questions.md` の回答（Q1=B / Q2=B）
> 前提: 本プロジェクトは**ローカル専用ツール**。クラウド・ステージング/本番環境・成果物リポジトリは存在しない（team.md Deployment / project.md Forbidden）。

## 適用しない標準要素（先に明示する）

本ステージの定型構成のうち、以下は**本プロジェクトに存在しないため作らない**。空の設定を置くより、無いことを書く:

| 標準要素 | 本プロジェクトでの扱い |
|---------|---------------------|
| CodePipeline / CodeBuild / buildspec.yml | 該当なし（AWS 不使用 — project.md Forbidden） |
| 成果物リポジトリ（ECR / CodeArtifact / S3） | 該当なし。ビルド成果物を外部に置かない。配布は `bun install` → `bun run <script>` のみ |
| 環境別デプロイ（staging / production） | 該当なし。環境という概念が無い |
| デプロイ承認ゲート | 該当なし。「リリース」= `main` への squash-merge または git タグ |
| シークレット管理 | 該当なし。本ツールは認証情報を一切持たない |

## パイプラインの構成（2系統）

`bun run check` という**単一のゲートコマンド**があり、それを2つの場所から呼ぶ。ゲートの定義を二重に持たないことが設計の要点である。

```
                    ┌─ scripts/hooks/pre-push ──┐
bun run check ◀─────┤                            │ 同一コマンド・同一定義
                    └─ .github/workflows/check.yml ┘
```

```
bun run check
  = biome check .                       静的解析（155ファイル）
  && tsc --noEmit                       型検査（ワークスペース全体）
  && tsc --noEmit -p packages/dashboard 型検査（SPA の tsconfig）
  && vitest run --coverage              テスト（52ファイル・685件・カバレッジ閾値込み）
  && bun audit                          依存の脆弱性監査
```

`&&` 連結であり、先に失敗した時点で止まる。**最も安いチェックが先**（lint 147ms → 型 → テスト → 監査）で、遅い工程に入る前に落ちる。

### 系統1: ローカル pre-push フック（既定のゲート）

`scripts/hooks/pre-push` にサンプルとして同梱。**インストールは意図的な手動操作**とし、自動配線しない:

```bash
cp scripts/hooks/pre-push .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

設計上の判断:

- **pre-commit ではなく pre-push**。`bun run check` は完走に数十秒かかり、コミットのたびに走らせると人はフックを外す。外されたゲートは無いのと同じである。境界は「手元の履歴」ではなく「他人に渡る瞬間」に置く
- **フックはファイルを書き換えない**。format も stage も amend もしない。push しようとしている最中に作業内容を書き換えるフックは、フックが無い状態より悪い
- **bun が PATH に無ければ push を拒否する**（黙って skip しない）。gate を通ったのか素通りしたのかが区別できない状態を作らない
- `--no-verify` での迂回は残す。ただしそれは「ゲートが捕まえるものを他に捕まえるものが無い」と知った上での操作である旨をメッセージに書いている

### 系統2: GitHub Actions（リモート接続時）

`.github/workflows/check.yml`。`main` への push と PR で発火し、`bun run check` を**そのまま**実行する。

| 項目 | 値 | 理由 |
|------|----|----|
| bun | 1.3.6 に固定 | 実測に使った版と同じ。CI で版が動くと再現性が失われる |
| インストール | `bun install --frozen-lockfile` | lockfile との乖離をゲート失敗として検出する（project.md Mandated） |
| OS マトリクス | ubuntu / windows / **macos** | クロス OS が必須要件（C-T4 / NFR-4）なのに CI が無く、macOS 経路は人手でも未実行（MA-7）。macOS ランナーはこの穴を埋める最初の実行になる |
| `fail-fast` | `false` | 1つの OS が落ちても他の結果を見たい。OS 固有の失敗こそ知りたい情報である |
| `permissions` | `contents: read` のみ | ゲートは読み取りしかしない。書き込み権限を持たせる理由が無い |

**未検証であることの明示**: 本ステージ時点でリモートが存在しないため、**この workflow は一度も実行されていない**。ローカルフックは実行して確認済み（下記）だが、workflow は未検証のまま同梱される。リモート接続後の初回実行を**受入確認**として扱い、回帰検知として扱わない。

### 二重定義を避ける規約

workflow とフックはどちらも `bun run check` を呼ぶだけで、**チェック項目を各自で列挙しない**。ゲートの内容を変えるときに触るのは `package.json` の `check` スクリプト1箇所である。両者が食い違った場合は**ローカルコマンドが真実**（team.md: ローカルゲートがゲート）で、workflow 側を直す。

## ブランチ戦略

org.md / team.md で確定済み（本ステージで新たに決めていない）:

- **trunk-based development**。`main` から切った短命ブランチ（1〜2日で解消）
- **squash-merge** で `main` に入れる。Bolt 1つが `main` の1コミットになり、delivery-planning の Bolt 列と 1:1 で対応する
- 長命ブランチを持たない。環境別のリリースブランチも持たない（環境が無いため）
- Construction の worktree ベース / マージ先はどちらも `main`

## git リポジトリの初期化（Q2=B の実施内容）

本ステージで `git init` を実施した。**リモートは設定していない**（設定は公開範囲の判断を伴うため人が行う）。

初回コミット前に `.gitignore` の除外対象を実測で確認した。除外されるべきもの:

| 対象 | 理由 |
|------|------|
| `aidlc/active-space`, `aidlc/spaces/*/intents/active-intent` | per-user カーソル |
| `aidlc/.aidlc-clone-id`, `aidlc/.aidlc-sessions/` | per-clone トークン・machine-local ランタイム |
| `aidlc/spaces/*/intents/*/runtime-graph.json` | 生成物 |
| `aidlc/spaces/*/intents/*/.aidlc-*` | recovery / hooks-health / sensors スクラッチ |
| `.claude/settings.local.json` | 個人設定 |
| `node_modules`, `dist` | 生成物 |

コミットされるべきもの: `aidlc/` の記録本体（state・監査シャード・intents.json）、`memory/`・`codekb/`・`knowledge/`、`packages/`、`docs/`、`bun.lock`。

## 検証状況

| 対象 | 検証 | 結果 |
|------|------|------|
| `bun run check` 本体 | 実行 | ✅ exit 0（52ファイル / 685 passed / 2 skipped、`bun audit` clean） |
| pre-push フック | 実行 | 下記「実行記録」参照 |
| GitHub Actions workflow | **未実行** | リモートが無い。初回実行が受入確認 |
| macOS 経路 | **未実行** | workflow の macos ランナーが初回になる見込み |

## トラブルシュート

| 症状 | 対処 |
|------|------|
| フックが走らない | `.git/hooks/pre-push` に実行ビットがあるか確認（`chmod +x`）。Windows の Git Bash では実行ビットが落ちることがある |
| `pre-push: bun is not on PATH` | 非対話シェルから起動されているため。`~/.bashrc`（Git Bash）/ `~/.zshenv`（zsh）に bun の PATH を通す。`~/.zshrc` は読まれない |
| workflow が lockfile で失敗 | 依存を触ったのに `bun.lock` を commit していない。lockfile ごと commit する |
| ゲートが遅くて外したくなる | 外す前に、どの工程が遅いかを測る。`vitest run` 単体と `--coverage` 付きでは所要が大きく違う |
