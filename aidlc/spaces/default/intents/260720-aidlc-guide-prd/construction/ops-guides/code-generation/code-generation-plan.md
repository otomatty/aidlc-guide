# Code Generation Plan — Unit: ops-guides

> code-generation (3.5) / Unit: ops-guides (kind: spec, S — コード外の文書成果物) / 2026-07-25
> 入力: functional-design（business-rules BR-OG-1〜7 / domain-entities の G-1・G-2 見出し骨格 + 必須要素チェックリスト）
> + nfr-design（security-design S-OG-1〜5 の文書上の機構）
> + nfr-requirements（security-requirements S-OG-1〜5 / tech-stack-decisions）
> 実装場所: `docs/guides/`（**実行コードを1行も書かない**。本 Unit の成果物は2つの Markdown 文書）

## 0. 本 Unit が実装しない範囲

| 事項 | 所有 | 本 Unit の作業 |
|------|------|---------------|
| `--host` の bind 分岐・警告文言・403 | U5 dashboard-server / U8 mob-mode | **参照して記述するだけ**。コードに1行も触れない |
| 文書 lint / CI での文言ドリフト検知 | — | **導入しない**（tech-stack-decisions.md の明示決定）。同期は B7 完了時の一度きりの突合 |
| フックのインストール | 操作者 | **サンプルを載せるだけ**。リポジトリに `scripts/` も `.git/hooks/` も作らない |
| 図（Mermaid） | — | 入れない（tech-stack-decisions.md の決定メモ） |

## 1. 成果物

| ID | ファイル | 見出し骨格 |
|----|---------|-----------|
| G-1 | `docs/guides/live-share.md` | domain-entities.md「G-1 の構造」の H2 8節を**そのまま**（前提と適用範囲 / セットアップ / ターミナルの read-only 共有 / Dashboard の併用 / モブ中の回答記入 / リモート参加（トンネル公開）/ 使えないときの代替 / トラブルシュート） |
| G-2 | `docs/guides/async-sharing.md` | 同「G-2 の構造」の H2 5節をそのまま（目的 / ゲート通過時の自動 push / 参加者側: checkout 不要の閲覧 / 何を共有し、何を共有しないか / 使えないときの代替） |

H3 以下は自由。**H2 は骨格どおりに固定**し、受入判定が節の存在で機械的に取れる形にする。

## 2. 実装（＝執筆）の前に、実装から確認する事実

BR-OG-6 の同期義務は「実装を読んでから書く」ことでしか満たせない。**推測で書かない**ため、着手前に次を実コードから確定する。

| 確認する事実 | 出所 | 書き方 |
|------------|------|--------|
| 公開警告の文言 | `packages/dashboard-server/src/server.ts` `HOST_EXPOSURE_WARNING` | **ブロック引用で逐語**。引用元をファイル名 + 定数名で併記（S-OG-2） |
| URL 見出し / 一覧が空のときの案内 | `packages/dashboard-server/src/exposure-notice.ts` `EXPOSURE_ADDRESS_HEADING` / `EXPOSURE_NO_ADDRESS_HINT` | 同上 |
| ポート衝突時のヒント / dist 欠落時のヒント | `cli.ts` / `server.ts` `DIST_MISSING_HINT` | トラブルシュートに逐語で載せ、対処コマンドを付ける |
| `--host` が同時に切り替えるもの | `server.ts`（`hostname` と `answerContext.hostMode` が**同じ `config.host`** 由来） | 「LAN bind」と「全クライアント read-only」が1フラグで不可分であることを明記 |
| 403 の種類と発生条件 | `handlers/answer-writer.ts` の早期 return 7段 | `read-only-mode` / `not-a-questions-file` / `outside-record` / `not-an-answer-line` を表で切り分け |
| 参加者に出るバッジ文言 | `packages/dashboard/src/components/ReadOnlyBadge.tsx` | 逐語 |
| LiveStatus の全文言 | `packages/dashboard/src/components/LiveStatus.tsx` + `push.ts` の `degrade()` 理由 | トラブルシュート「反映されない」の切り分け表 |
| 起動コマンドの実体 | ルート `package.json` の `scripts` / `cli.ts` の `parseArgs` | 実在するコマンド・フラグだけを書く。引数の passthrough は実測で確認 |
| 何が commit され何が ignore されるか | リポジトリの `.gitignore` | G-2 の「何を共有し、何を共有しないか」を推測で書かない |

## 3. 執筆順（依存順）

1. **実装の読み取り**（上表）→ 逐語文言を確定
2. **G-2 を先に書く** — U8 に依存しない（git 手順のみ。domain-entities「依存とタイミング」どおり）。**書く前にスクラッチ git リポジトリで全手順を実行**し、実際の出力を採取する
3. **G-1 を書く** — U8 完了後に確定。逐語引用は 1 で採った文言を貼る
4. **突合** — 引用箇所が実コードの定数と一致することを機械的に確認（下記4）
5. `bun run check`

## 4. 検証計画

自動テストは書かない（実行コードが無い）。代わりに**機械的に確認できるものは機械で確認する**。

| # | 検証 | 方法 |
|---|------|------|
| V-1 | 逐語引用が実コードの定数と一致（BR-OG-6 / S-OG-2） | ソースから定数を抽出し、ガイド本文（引用符 `> ` を剥がした後）に**部分文字列として含まれるか**を判定するワンショットスクリプト。目視の一致確認にしない |
| V-2 | H2 見出しが骨格どおり | `grep -n "^#"` で列挙して domain-entities.md と突合 |
| V-3 | G-2 の手順が実際に動く（US-22 AC） | **スクラッチ git リポジトリで実行**（本ワークスペースは git リポジトリではないため、ここで実行検証する）。正常系・変更なし・ブランチ違い・push 拒否の4経路と、参加者側の `--no-checkout` clone → `fetch` / `show` / `ls-tree` / `log` / `diff` を実行 |
| V-4 | 実在値を書いていない（S-OG-3） | `grep -nE "\.local\b\|<IPv4>\|ghp_\|sk-\|Bearer "` で全ヒットを目視判定。許容は `127.0.0.1` / `0.0.0.0`（実装が出す値）と `192.0.2.10`（TEST-NET-1）のみ |
| V-5 | フックサンプルの契約3条件（S-OG-4） | サンプル本文で (a) 対象ブランチ定数 (b) 対象パス定数 + pathspec (c) `--force` 不在 を確認し、直下に「すること/しないこと」を置く |
| V-6 | 起動コマンドが実在する | `bun packages/dashboard-server/src/cli.ts --help` と `bun run dashboard --help` を実行して確認（passthrough が効くかを含む） |
| V-7 | 各コマンド節に期待される出力がある（BR-OG-7） | 節ごとに目視。コマンドだけ・方針だけの節を残さない |

## 5. ゲート

`bun run check`（biome + `tsc --noEmit` ×2 + `vitest run --coverage` + `bun audit`）が全緑で、**mob-mode 完了時点の `52 files / 685 passed | 2 skipped` から変動しない**こと。Markdown はビルド対象でもテスト対象でもなく、Biome 2.x は Markdown を lint しないため、本 Unit の差分がゲートに影響しないことを実測で確認する（`Checked 155 files` が変わらないこと）。

もし Biome が `docs/**` に触れた場合は、**除外設定を足すのではなくガイド側を規約に合わせる**（team.md の単一ローカルゲートを崩さない）。
