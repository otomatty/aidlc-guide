# AIDLC Guide

aidlc-workflows 2.6.2（State Version **8** / 33 ステージ）の現在地・成果物・次の一手を、初学者でも迷わず把握できるローカル開発者ツールです。

**第一サーフェスは VS Code / Cursor 拡張**です。Dashboard は IDE 内の Webview に表示され、ブラウザ起動は Mob LAN 共有などの副経路です。

> 仮称です。詳細な要件は [docs/prd/PRD.md](docs/prd/PRD.md) を参照してください。

## なにを解くか

| 課題 | このツールの答え |
|------|------------------|
| 今どのステージにいるか分からない | Now strip / Stage rail（IDE 内 Dashboard） |
| 成果物が多すぎて全体像が見えない | Unit × Stage マトリクス + Markdown ビューア |
| 調べ物で本線セッションが濁る | MCP サーバー + `btw` サイドセッション |
| モブで参加者に状態を見せたい | 拡張 Dashboard + [使い方ガイド](docs/guides/README.md)（Live Share / LAN） |

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  VS Code / Cursor 拡張 (packages/vscode-extension)       │
│  ├─ Webview: Dashboard UI                                │
│  ├─ api-core (in-process, Node)                          │
│  └─ コマンド: Setup / btw / MCP / LAN Share              │
└───────────────────────────┬─────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   reader-core         docs-bridge      dashboard-server
   (読取)              (docs 対応)      (Bun HTTP — 副経路)
```

## クイックスタート（拡張）

### 1. ビルド（開発者向け）

```bash
bun install
bun run build:extension     # dist/ + media/ のみ（VSIX は作らない）
bun run package:extension   # VSIX を作成（packages/vscode-extension/*.vsix）
```

F5 で Extension Development Host を使うだけなら `build:extension` で足ります。インストール用の `.vsix` が欲しいときは `package:extension` を使います。

### 2. 拡張のインストール

**VS Code**

```bash
code --install-extension packages/vscode-extension/aidlc-guide-*.vsix
# または F5 で Extension Development Host からデバッグ起動
```

**Cursor** — 同様に VSIX を *Extensions: Install from VSIX* でインストール。

自分でビルドしない場合は [Releases](https://github.com/otomatty/aidlc-guide/releases) から `.vsix` を落として同じ手順でインストールできます（`main` へのマージから自動生成 — [リリース（CI/CD）](#リリースcicd) 参照）。

### 3. 初回 Setup（1 回）

1. `aidlc/` があるワークスペースを開く
2. コマンドパレット → **`AIDLC Guide: Setup`**
3. 「MCP をこのワークスペースに登録」をクリック

### 4. 日常利用（1 アクション）

コマンドパレット → **`AIDLC Guide: Open`**

またはステータスバーの `AIDLC Guide` / 現在ステージ名をクリック。

## 拡張コマンド

| コマンド | 用途 |
|---------|------|
| `AIDLC Guide: Open` | IDE 内 Dashboard |
| `AIDLC Guide: Setup` | 前提チェック + MCP 登録ウィザード |
| `AIDLC Guide: Register MCP` | `.mcp.json` に `aidlc-guide` をマージ |
| `AIDLC Guide: Ask (btw)` | 読取専用サイドセッション（ターミナル） |
| `AIDLC Guide: Ask one-shot` | ヘッドレス一問一答 |
| `AIDLC Guide: Share on LAN` | ブラウザ Dashboard を `--host` で起動（参加者向け副経路） |

## パッケージ

| パッケージ | 役割 |
|-----------|------|
| `@aidlc-guide/api-core` | 読取 API（HTTP / postMessage 共通） |
| `@aidlc-guide/reader-core` | `aidlc-state.md`・成果物・監査の読取 |
| `@aidlc-guide/vscode-extension` | VS Code / Cursor 拡張（第一サーフェス） |
| `@aidlc-guide/dashboard` | React UI（Webview / ブラウザ兼用） |
| `@aidlc-guide/dashboard-server` | Bun HTTP サーバー（副経路） |
| `@aidlc-guide/mcp-server` | Claude Code 向け MCP |
| `@aidlc-guide/btw` | サイド質問 CLI |
| `@aidlc-guide/docs-bridge` | ステージ slug → 公式 docs |

## 設定

ワークスペースルートの [`aidlc-guide.config.json`](aidlc-guide.config.json) で docs 連携を設定します（全ステージ分のキーを同梱）。

| キー | 用途 |
|------|------|
| `docsRepoPath` | 公式 docs のルート（excerpt 読取）。相対パスは config ファイル基準 |
| `docsBaseUrl` | （任意）ベース URL。`stageDocs` 未設定ステージで bridge-map の相対パスと結合 |
| `stageDocs` | ステージ slug → 開き先 URL（Confluence / Notion / GitHub など `http(s)://…`）。空文字は未設定 |
| `projectLinks` | ヘッダーに出す追加リンク `{ label, target }[]` |

「docs を開く」の優先順位: `stageDocs[slug]` → `docsBaseUrl` + map パス → 拡張ではワークスペース上のファイルを開く。

## 副経路: ブラウザ Dashboard

Mob 参加者が拡張未導入の場合や、HTTP で直接見たい場合:

```bash
bun run dashboard
# LAN 公開
bun packages/dashboard-server/src/cli.ts --host
```

## 前提

- **VS Code 1.122 以上**（拡張ホストの Node 22 を前提にバンドルしているため）。Cursor は VS Code 本体より数ヶ月遅れて追随するため、この下限に未到達のビルドではインストールできません
- [bun](https://bun.sh) — MCP / btw / LAN 副経路で使用（拡張の Dashboard 表示自体は Node の api-core のみ）
- 対象ワークスペースに aidlc-workflows **2.6.2**（State Version **8**）。State Version **7** は閲覧互換。それ以外は解析不可表示
- MCP / `btw` 利用時は [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI

## 開発

```bash
bun run test                          # Vitest（素の `bun test` は Bun のランナーで、dashboard を拾わない）
bun run lint                          # Biome
bun run check                         # lint + tsc + test + audit
bun run build:extension               # Webview + 拡張バンドル
bun run build:dashboard               # ブラウザ用 SPA のみ
```

## リリース（CI/CD）

`main` にマージすると [`.github/workflows/release.yml`](.github/workflows/release.yml) が走り、VSIX をビルドして GitHub Releases に添付します。手動作業はありません。

**`main` へのマージは既定でリリースされます。** [`.github/workflows/bump-extension-version.yml`](.github/workflows/bump-extension-version.yml) がマージ後にバージョンを上げ、そのコミットから Release を出します。ラベルは「リリースするかどうか」ではなく**上げ幅**を選ぶものです。

| ラベル | 例（いま `0.2.0`） |
|--------|-------------------|
| `release:major` | `1.0.0` |
| `release:minor` | `0.3.0` |
| `release:patch` | `0.2.1` |
| **ラベル無し（既定）** | `0.2.1`（= patch） |
| `release:skip` | 据え置き。リリースしない |

ラベルを付け忘れたマージは patch として出荷されます。リリースしたくないマージ（ドキュメントの誤字、CI だけの変更など）は `release:skip` を明示的に付けてください。上げ幅のラベルは 1 つだけにしてください。2 つ付いている場合や `release:skip` と併用した場合は、推測せず失敗します。

PR 内で `version` を既に上げている場合は、ラベルの有無にかかわらず二重に上げません（従来の手動 bump もそのまま使えます）。ただし `release:skip` は**自動 bump だけ**を止めるものです。手で書いたバージョンは `release.yml` がマニフェストの値だけを見て出荷するため、ラベルでは止まりません。そのため両方を指定した PR は矛盾として[`release-labels.yml`](.github/workflows/release-labels.yml) が**マージ前に**落とします（マージ後に気づいても Release は既に出ているため）。同じ判定をマージ後のゲートも走らせます — 判定関数は 1 つで、PR 上と push 上の両方から呼ばれます。

`release-labels` は**required status check に設定して初めてマージを実際に止められます**（設定画面で選ぶチェック名も `release-labels`）。設定しない場合は PR 上の赤い ✗ が出るだけです。`release.yml` 側のゲートは従来どおり**バージョン変更**です（`v<version>` タグが未作成のときだけ公開）。したがって `release:skip` のマージはタグが動かず、公開もされません。

```bash
# 任意のバージョンを手で指定するとき（自動 bump は据え置きになる）
jq '.version="0.2.1"' packages/vscode-extension/package.json > tmp && mv tmp packages/vscode-extension/package.json
# → main へマージ → タグ v0.2.1 + Release + aidlc-guide-0.2.1.vsix が自動生成される
```

`release:patch` / `release:minor` / `release:major` はリポジトリに作成済みです。**`release:skip` は未作成なので、一度だけ作成してください**（`gh label create release:skip --description "Merge without releasing a new version"`）。ラベルが存在しないと付けられません。その場合、`release:minor` / `release:major` が付いていればそのサイズで、どの `release:*` も付いていなければ既定の patch で出荷されます（いずれにせよ出荷は止まりません）。`main` が「PR 必須」で保護されているときは、`github-actions[bot]` が `packages/vscode-extension/package.json` と `bun.lock` を push できるよう例外を付けてください。

判定の基準は「**公開済み Release があるか**」です（タグの有無だけでは判定しません）。

| 挙動 | 条件 |
|------|------|
| リリースする | `v<version>` タグが無い |
| リリースし直す | タグはあるが公開済み Release が無い（前回が途中で落ちた状態） |
| 何もしない | `v<version>` の Release が公開済み（= バージョン据え置きのマージ） |
| pre-release として出す | バージョンに `-` が含まれる（例 `0.2.0-rc.1`） |

ジョブは `decide`（タグ判定）→ `build`（`bun run check` + VSIX）→ `publish`（Release 作成）の 3 段です。

- 公開前に `bun run check`（単一の品質ゲート）を通します。赤ければリリースしません。
- 書込み権限は `publish` ジョブだけに付きます。`build` は `contents: read` かつ `persist-credentials: false` で、checkout もしない `publish` が artifact を受け取って公開します。自動 bump も同じ分離です。`apply` は `contents: read` で bun を走らせ、`push` は tip の version が apply 起点と同じときだけ `.version` を書き換え、lockfile は起点と一致するときだけ成果物を使います（リポジトリ上のスクリプトは実行しません）。
- **途中で失敗したら Actions から再実行してください。** `gh release create` は「下書き作成 → asset upload → 公開」の別々の API 呼出しなので中断は下書きを残します。`publish` は残骸の下書きを破棄してから作り直し、公開済みなら何もせず正常終了します。タグが残るかどうかに関係なく再実行で回復できるよう、ゲート自体が「公開済み Release の有無」を見ています。
- 手動実行（`workflow_dispatch`）は `main` 以外では失敗します。feature ブランチのバージョンが公開されるのを防ぐためです。
- 公開後に asset が実際に Release へ載っているかを検証します。載っていなければジョブは失敗します。
- 既存タグが別コミットを指している場合は公開せず失敗します（タグと VSIX の出所が食い違う Release を作らないため）。タグを打ち直すか、バージョンを上げてください。
- 排他はワークフロー全体ではなくタグ単位（`release-v0.2.0`）です。全体で 1 グループにすると、連続した version bump のうち待機中の run が後続に取り消され、そのバージョンが公開されないままになります。
- 自動 bump は、bump ワークフローがバージョンを上げたあと同じ実行から `release.yml` を呼びます。`GITHUB_TOKEN` の push は別ワークフローを起動しないためです。bump 側の排他は `queue: max` 付きです。既定の「待機 1 件」だと 3 件目のマージが 2 件目を取り消します。

## 公式ドキュメントの自動同期

同梱している公式ドキュメント（`docs/overview/en`・`docs/guide/en`・`docs/harness-engineering/en`・`docs/reference/en`・`docs/rfcs/en`）は awslabs/aidlc-workflows の `docs/` ツリー全体の逐語コピーで、`docs/official-docs.manifest.json` でピン留めしています。[`.github/workflows/aidlc-workflows-docs-update.yml`](.github/workflows/aidlc-workflows-docs-update.yml) が毎日 03:00 UTC に upstream の tip SHA をピンと比べ、動いていれば `chore/aidlc-workflows-docs` ブランチに PR を出します（`workflow_dispatch` で手動起動も可。`release.yml` と同じく `main` 以外の ref からの実行は拒否します）。upstream のタグは実バージョンより遅れる（2.6.x が現行のとき v2.3.0 止まり）ため、変更検知は SHA で行います。

- **upstream のブランチ名は固定せず解決します**。もともと `v2` を直接指していましたが、upstream が v2 を `main` に統合した（旧 tip は `v2_backup` として残存）ため `git ls-remote refs/heads/v2` が空を返し、スケジュール実行が毎回失敗する状態になりました。現在は `git ls-remote --symref HEAD` で **upstream 自身が既定としているブランチ**を訊きます。リネームに追従するのはこれで、名前の当てずっぽうではありません。symref を返さないサーバ向けのフォールバックとして `UPSTREAM_BRANCHES`（既定 `main v2`）を先頭から試します。候補は**置き換えではなく追加**してください。
- **解決したブランチが「同じ系統の続き」かを検証します**。名前による解決は「v2 が main にリネームされた」と「main は別系統だ」を区別できません（upstream には `v1` もあります）。そこで clone 後に `git merge-base --is-ancestor <ピン> HEAD` で、ピン留めしていたリビジョンがそのブランチの履歴上にあるかを見ます。このために clone は `--depth 1` をやめて blobless-full にしています（実測 452 commits で ~5MB・所要時間は同じ）。結果は 4 通りで、`ok`（通常の前進）と `no-pin`（初回）はそのまま進行、`diverged`（履歴書き換え、または別ブランチを見ている）と `unknown`（ピンが履歴に無い）は**ミラー自体は続行しつつ `release:skip`** にします。ジョブを失敗させないのは、毎晩静かに落ちる状態こそが v2 リネームを見逃した原因だからです。PR 本文の先頭に CAUTION ブロックが入ります。

- **`en` はミラー**です。upstream が消したページはここでも消し、その `ja` 訳も一緒に消します（原文の無い訳を出し続けないため）。それ以外で `ja` が変化したらジョブは失敗します。
- **`ja` の翻訳は人の仕事**です。PR 本文に差分レポートが入っていて、翻訳が要るページが一覧されます。
- **同期ブランチに人の作業が載っている間は、ジョブはそのブランチに触りません**。翻訳コミットを同期ブランチへ push した状態で upstream がさらに動いても、ジョブは更新を見送ります（更新はブランチを `main` から組み直すため、作業中の diff を書き換えてしまうからです）。新しい tip は、その PR をマージまたはクローズした次の実行で取り込まれます（見送り判定は PR が **open** の間だけです。squash マージ後もブランチのコミットは `main` の祖先にならないため、open 判定を挟まないと着地後も永久に見送り続けます）。見送りは Actions の warning とジョブサマリに残ります。
- PR には `release:patch` の付与を試みます（付与に失敗しても warning を出して PR 作成は続行します。既定が patch なので出荷内容は変わりません）。マージ＝新しいピンの出荷で、これにより利用者の拡張が「workspace の aidlc-workflows を更新しますか」と促すようになります。ラベル無しでも既定で patch が出るため、これは明示のためのラベルです。リリースを伴わせたくないときは、ラベルを外すのではなく `release:patch` を `release:skip` に**貼り替えて**ください（外すだけでは既定の patch が出ます）。
- **品質ゲートは同期ジョブ側で走ります**。`GITHUB_TOKEN` で作った PR では `check.yml` が無人で走りません（GitHub のドキュメントは「承認待ちで run が作られる」、create-pull-request 側は「そもそも起動しない」としています。どちらにせよ人が触るまで結果は出ません）。そのためジョブ内で `bun run check` を通してからでないと PR を出しません。副作用として、**`check.yml` を required status check にしている場合、同期 PR は誰かが承認／再実行するまでマージできません**。PR 上でも無人で回したい場合は create-pull-request の `token:` に PAT または GitHub App のインストールトークンを渡してください。
- **同期 PR が開いている間は再同期しません**。ピンは `main` ではなく同期ブランチ側から読むため、PR を放置しても毎日ブランチが書き換わって review / check がリセットされることはありません（マージせず PR を閉じた場合、upstream が再び動くまで新しい PR は出ません。すぐ出し直したいときは同期ブランチを削除してください）。

手元で試すときは upstream のチェックアウトを指定して直接実行できます（ネットワーク I/O はスクリプト側では行いません）。

```bash
bun scripts/sync-official-docs.ts --upstream ../aidlc-workflows --upstream-sha "$(git -C ../aidlc-workflows rev-parse HEAD)"
```

### 互換性チェック（docs 以外の追随）

ドキュメント以外にも、upstream のリビジョンに手で追随している箇所が 4 つあります。[`scripts/check-workflows-drift.ts`](scripts/check-workflows-drift.ts) が upstream の `AIDLC_VERSION`・`CURRENT_STATE_VERSION`・ステージ一覧・エージェント一覧を読み、これらと突き合わせて PR 本文にチェックリストを出します。

| 追随先 | 何が古くなるか |
|--------|----------------|
| `packages/shared-types/src/index.ts` | reader パーサが受け付ける State Version |
| `packages/docs-bridge/data/bridge-map.json` | ステージごとの日本語解説（件数は data-lint が固定） |
| `packages/docs-bridge/data/agent-map.json` | エージェントごとの日本語解説 |
| `packages/official-docs/src/stage-map.ts` | 同梱ドキュメントへの 7 本のディープリンク |

指摘は基本 advisory（PR は通常どおり出ます）ですが、**State Version が拡張のサポート範囲外になった場合だけはブロッキング**です。その PR は `release:patch` ではなく `release:skip` を貼られ、既存 `release:patch` は外されます。ラベル無しの既定は patch なので、貼り替えに失敗した場合はジョブが error で落ちます（「サポート範囲外の State Version をそのまま出荷して、利用者の拡張が一斉に unsupported になる」ことだけは避けるため）。

```bash
bun scripts/check-workflows-drift.ts --upstream ../aidlc-workflows
```

## ワークスペースシェル（`.claude/` と `.cursor/`）の自動同期

このリポジトリ自身が使っているハーネスツリーは upstream の `dist/claude/.claude` と `dist/cursor/.cursor` の写しです。[`.github/workflows/aidlc-workflows-shell-update.yml`](.github/workflows/aidlc-workflows-shell-update.yml) が毎日 03:30 UTC に同期し、差分があれば `chore/aidlc-workflows-shell` ブランチに PR を出します。

- **両ハーネスを必ず一緒に動かします**。`AGENTS.md` の冒頭が「Cursor (`.cursor/`) と Claude Code (`.claude/`) の2ハーネスを lockstep で運用する」と明記しているため、片方だけの同期は「小さい版」ではなくバグです。スクリプトは**両ツリーを計画してからどちらかを書き**、upstream が別バージョンで出荷していたら中断します（`refusing to split lockstep`）。
- **VSIX には同梱されません**（`.vscodeignore` は `dist/` と `media/` のみ、実行時のドキュメント解決はユーザ側の `docsRepoPath`）。ここでのハーネスツリーは品質ゲートのフィクスチャで、`packages/docs-bridge/tests/data-lint.test.ts` が bridge-map の全エントリを `.claude/aidlc-common/stages` に対して解決します。**古いシェルのままだと、ゲートが昨日のステージグラフを検証し続ける**というのが、この同期を足した理由です。
- そのため PR は既定で **`release:skip`** です（ラベル無しの既定は patch なので、貼らないと利用者に届かない変更でリリースが出てしまいます）。このブランチに利用者向けの変更を載せた場合だけ貼り替えてください。
- **ミラーなので削除もし、ローカルパッチも上書きします**。upstream が消したステージ／エージェントはここでも消えます。温存されるのは各ハーネスの local-only パスだけです。

  | ツリー | 温存されるもの |
  |--------|----------------|
  | `.claude/` | `scopes/aidlc-prd-implementation.md`、gitignore 済みの `settings.local.json` |
  | `.cursor/` | `aidlc-install.json`、`hooks/aidlc-cursor-adapter.test.ts`、`scopes/aidlc-prd-implementation.md` |

- **`.cursor/hooks/aidlc-cursor-adapter.ts` のローカルパッチ（PR #43）は上書きされます。これは事故ではなく意図した更新経路です。** パッチ自身のコメントが「re-applied on each engine upgrade」と書いており、リポジトリ側の `aidlc-cursor-adapter.test.ts` がそれを pin しているため、**パッチが消えるとゲートが赤くなって検出されます**（黙って通りません）。PR 本文のチェックリストが再適用を促します。
- **`.cursor/aidlc-install.json` は再生成しません。** これは upstream 出荷時の sha256 を記録して手編集を検出するためのマニフェストなので、ローカル内容から作り直すとその検出信号を消してしまいます。ミラーで内容が変わった managed file を PR 本文に列挙するだけに留め、再生成は upstream のインストーラに任せます。
- **ゲートが赤でも PR は出します**（docs 同期とは逆）。上のパッチ上書きやステージ名変更で落ちるのは想定どおりで、その手当こそが PR の中身だからです。赤の場合は **draft** で開き（`always-true` なので更新時にも draft へ戻します）、`bun run check` の末尾 100 行を本文に入れます。
- **ジョブは2つに分かれていて、その境界がセキュリティ境界です。** `build`（`contents: read`）が clone・ミラー・`bun run check` などコードを実行する処理を全部やり、結果を**パッチとして** `publish` に渡します。`publish`（write 権限）は checkout・パッチ適用・PR 作成・ラベル付けだけで、リポジトリのコードを一切実行しません。この分離が必要なのは、ゲートが `.cursor` に**届く**からです（vitest は `.cursor/hooks/**/*.test.ts` を拾い、そのテストは upstream の `aidlc-cursor-adapter.ts` を import します）。ミラーしたばかりの upstream コードを write トークン下で実行しないためのもので、2つのジョブを再統合しないでください。受け渡しにパッチを使うのは、成果物のコピーでは表現できない**削除**を運べるからです。
- 同期ブランチに人のコミットが載っている間はブランチに触りません（docs 同期と同じ）。
- ブランチ解決と系統の検証も docs 同期と同じです。このワークフローは自前のピンを持たない（シェルのミラーは内容ベース）ため、系統の検証には `docs/official-docs.manifest.json` の `upstreamSha` を借ります。こちらは元から `release:skip` なので、`diverged` / `unknown` は PR 本文の CAUTION に出るだけです。

```bash
bun scripts/sync-workflows-shell.ts --upstream ../aidlc-workflows --upstream-sha "$(git -C ../aidlc-workflows rev-parse HEAD)"
```

## 設計上の約束

- **読取専用原則**: `*-questions.md` の `[Answer]:` 記入と Setup 時の `.mcp.json` マージ以外は書込まない
- **aidlc-workflows 本体は触らない**
- **クラウド / AWS 不使用**（ローカル専用）
- Mob の listen 既定は loopback。LAN 公開は明示操作のみ

## ドキュメント

| 文書 | 内容 |
|------|------|
| [docs/guides/README.md](docs/guides/README.md) | **使い方ガイド一覧**（ユースケース別） |
| [docs/prd/PRD.md](docs/prd/PRD.md) | 要件・マイルストーン |
| [AGENTS.md](AGENTS.md) | Cursor 上の AI-DLC ワークフロー |
