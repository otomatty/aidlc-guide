# Code Summary — Unit: ops-guides

> code-generation (3.5) / Unit: ops-guides (kind: spec) / 2026-07-25
> 実装場所: `docs/guides/`（**実行コードの差分はゼロ**。成果物は2つの Markdown 文書）
> 本 Unit は9ユニット中の最後。U8 mob-mode の実装完了後に確定させた（domain-entities.md「依存とタイミング」/ bolt-plan B7 どおり）。

## 生成ファイル

| ファイル | 役割 | 行数 |
|---------|------|-----|
| `docs/guides/live-share.md` | G-1 Live Share 運用ガイド（モブセッション） | 403 |
| `docs/guides/async-sharing.md` | G-2 非同期共有規約 | 309 |

**触った既存ファイルはゼロ。** `packages/**` に1バイトの差分も無い。コード外の文書 Unit であり、既存実装の挙動には**要求・検証の責任だけ**を持つ（project.md「Way of Working」の後発 Unit ルール）。

## 必須要素チェックリストの充足（domain-entities.md の受入判定表を1行ずつ）

| 要素 | 所在（実ファイル:行） | 根拠 | 判定 |
|------|--------------------|------|------|
| 「モブ中の回答記入」節 | `docs/guides/live-share.md:179`（H2）。制約 `:181`、ADR-04 の受容トレードオフの明示 `:183`、403 の実体 `:186`、手順3段 `:191-213`（うち `:197` がトンネル停止の先行手順） | BR-OG-1 / ADR-04 / components.md C8 | ✅ |
| 認証注意（トンネル） | `docs/guides/live-share.md:217-221`（節の**冒頭**、最初の手順見出し `:223` より前）。因果の1文は `:219` | BR-OG-2 / NFR-7 / S-OG-1 | ✅ |
| `liveshare.autoShareTerminals` 等の具体設定 | `docs/guides/live-share.md:81-88`（貼れる `settings.json`）+ `:90-95`（キー・値・意味の表）+ read-only にする理由 `:65-67` + 確認手順 `:99-101` | BR-OG-3 | ✅（キー名の出所は下記「実物に当てて確かめていない記述」） |
| push フックのサンプル + `git show` 手順 | サンプル `docs/guides/async-sharing.md:33-62`、`git show` は `:169-180`（`:172` が本体） | BR-OG-4 / US-22 AC | ✅ |
| 代替手段の節 | `docs/guides/live-share.md:286`（tmux read-only / Dashboard 単独運用 / 画面共有）、`docs/guides/async-sharing.md:267`（手動 push / `git archive` 添付） | BR-OG-5 | ✅ |
| 実装文言との一致（警告文） | `docs/guides/live-share.md:139`（`HOST_EXPOSURE_WARNING` を逐語ブロック引用、引用元をファイル名 + 定数名で併記 `:137`） | BR-OG-6 | ✅（機械照合の証跡は次節） |

### ルール側（BR-OG-1〜7 / S-OG-1〜5）の充足

| ID | 所在 | 判定 |
|----|------|------|
| BR-OG-1 | `live-share.md:179-213` | ✅ |
| BR-OG-2 | `live-share.md:217-221`（注意）+ `:233-272`（手順 cloudflared / Tailscale） | ✅ |
| BR-OG-3 | `live-share.md:63-101` | ✅ |
| BR-OG-4 | `async-sharing.md:25-146`（push）+ `:148-227`（checkout 不要の閲覧） | ✅ |
| BR-OG-5 | `live-share.md:286` / `async-sharing.md:267` | ✅ |
| BR-OG-6 | 下記「実装との突合」 | ✅ |
| BR-OG-7 | 全コマンド節に「期待される出力」を併記。方針だけの節は無い（下記「BR-OG-7 の棚卸し」） | ✅ |
| S-OG-1 | `live-share.md:219` — 「本ツールは認証機構を一切持たない。したがってトンネル公開は…インターネットへ無認証で開くことと同義である」+ 「トンネルを張る前に…アクセス制御を掛けること」。**手順より前**に配置 | ✅ |
| S-OG-2 | `live-share.md:139`（逐語引用）+ `:141`「**これはポート開放ではなくデータ開示である。**」+ 警告の読み方3点 `:143-147` | ✅ |
| S-OG-3 | 実在値ゼロ（下記「S-OG-3 スキャン結果」） | ✅ |
| S-OG-4 | `async-sharing.md:38`(a) / `:39`+`:48`+`:54`(b) / `--force` 不在(c)。直下に「すること/しないこと」`:64-79`。失敗時の非握り潰しは推奨(d)として `:79` | ✅ |
| S-OG-5 | `live-share.md:109-115` の3段階表（loopback / LAN / トンネル）。`--host` 手順の**前**に置き、開く前に選ばせる | ✅ |

## 実装との突合（BR-OG-6 / S-OG-2 — 逐語一致の証跡）

**目視ではなく機械照合した。** ソースから定数を抽出し、ガイド本文から Markdown の引用記号 `> ` を剥がしたうえで部分文字列として含まれるかを判定した。

```
OK  HOST_EXPOSURE_WARNING     packages/dashboard-server/src/server.ts:24-27      → live-share.md:139
OK  DIST_MISSING_HINT         packages/dashboard-server/src/server.ts:29-31      → live-share.md:361
OK  EXPOSURE_ADDRESS_HEADING  packages/dashboard-server/src/exposure-notice.ts:20 → live-share.md:152
OK  EXPOSURE_NO_ADDRESS_HINT  packages/dashboard-server/src/exposure-notice.ts:27-30 → live-share.md:161
OK  ポート使用中のヒント        packages/dashboard-server/src/cli.ts:93-95         → live-share.md:349
OK  READ-ONLY · 参加者ビュー   packages/dashboard/src/components/ReadOnlyBadge.tsx:15 → live-share.md:170
OK  LiveStatus 全5文言         packages/dashboard/src/components/LiveStatus.tsx:32-46 → live-share.md:378-382
```

`HOST_EXPOSURE_WARNING` は3つの文字列リテラルの連結（`server.ts:25-27`）なので、抽出側で `+` 連結を復元してから比較している。**「だいたい同じ」では通らない照合**であり、句読点1つの差でも MISS になる。

### 逐語ではなく「コードを読んで書いた」記述と、その根拠

| ガイドの記述 | 根拠にした実コード |
|------------|-----------------|
| `--host` は「LAN bind」と「全クライアント read-only」を**1フラグで不可分に**切り替える（`live-share.md:227`） | `server.ts:90` の `answerContext = { hostMode: config.host, ... }` と `server.ts:110` の `hostname: config.host ? ALL_INTERFACES : LOOPBACK` が**同じ `config.host`** を読む。`cli.ts:32` の `--host` アーム以外に `host: true` を作る経路が無い |
| **トンネル公開時も `--host` が要る**（付けないとリモート参加者が書き込める）（`live-share.md:223-231`） | `hostMode` は接続元アドレスを一切見ない（`answer-writer.ts:153` は `ctx.hostMode` だけを見る）。トンネルは `127.0.0.1:4700` に接続するため、`--host` 無しでは 403 が立たない。**実装から導いた帰結であり、どこにも書かれていなかった事実** |
| **回答記入のため `--host` を外す前に、トンネルを閉じなければならない**（`live-share.md:197`。レビュー指摘1で追加） | 上と同じ機構の帰結。cloudflared / `tailscale serve` は Dashboard の再起動を跨いで生き続け `127.0.0.1:4700` に再接続するため、loopback 起動に切り替えた窓の間、**リモート参加者にだけ見え続け、かつ `POST /api/answer` が 200 で通る**。LAN 参加者は bind が `127.0.0.1` に戻ることで実際に切れるが、トンネル参加者は切れない |
| 403 は「リクエストの中身を見る前」に返る（`live-share.md:183`） | `answer-writer.ts:151-153` — `handleAnswer` の最初の文が `if (ctx.hostMode) return deny("read-only-mode", 403)`。JSON パースより前 |
| 403 の4種と発生条件の切り分け表（`live-share.md:388-398`） | `answer-writer.ts:153`（`read-only-mode`）/ `:167`（`not-a-questions-file`）/ `:172-174`（`outside-record`）/ `:189,191-193`（`not-an-answer-line`） |
| 参加者の画面に編集 UI が**描画されない**（`live-share.md:173`） | `ReadOnlyBadge.tsx:8-10` のコメントが述べるサーバ 403 との二段構え。DOM 不在は mob-mode の `mob-mode.test.tsx` で自動検証済み |
| 「更新が止まっています（&lt;理由&gt;）」の理由の実値（`live-share.md:382`） | `push.ts:64,65,76,84,88,91` の `degrade()` 呼び出し — `workflow-unreadable` / `next-step-unreadable` / `audit-unreadable` / `no-record` / `matrix-unreadable`、および `:107` の watch 由来 |
| アドレス一覧は**起動時1回だけ**列挙され、NIC 変化に追従しない（`live-share.md:402`） | `exposure-notice.ts:32-41` のコメントと `cli.ts:59` の呼び出し位置（起動時1回） |
| 起動コマンド `bun run dashboard` / `--host` / `--port` | ルート `package.json:14`（`dashboard` スクリプトは build を含む）と `cli.ts:25-47` の `parseArgs`。**引数 passthrough は実測**（下記） |
| `bun run build:dashboard` の期待出力 `✓ built in <秒数>s` | 実測（下記） |

### 実測したこと（推測で書かなかったもの）

```
$ bun packages/dashboard-server/src/cli.ts --help
aidlc-dashboard — local AI-DLC workflow dashboard
Usage: aidlc-dashboard [--port <n>] [--host]
  --port <n>  Port to listen on (default 4700; 0 picks a free port).
  --host      Bind 0.0.0.0 so others on your LAN can view it.
              Read-only: answer writing is disabled for every client.
  --help      Show this message.
exit=0

$ bun run dashboard --help          # ← 引数 passthrough が効くかの確認
...（vite build が走り）✓ built in 15.12s
aidlc-dashboard — local AI-DLC workflow dashboard
...
exit=0
```

`bun run dashboard --host` が成立することを、この passthrough 実測で確認した。**確認せずに書いていたら、`bun run dashboard` が `build && cli` の `&&` チェーンであるためフラグが届かない可能性があった。**

## G-2 の実行検証（US-22 AC）

**本ワークスペースは git リポジトリではない**（`git rev-parse --is-inside-work-tree` が `fatal: not a git repository`）。そのため US-22 AC の実行検証は、スクラッチに `origin`（bare）+ ドライバー clone + 参加者 clone を立てて**実際に全経路を走らせた**。

### ドライバー側（サンプルスクリプト）

| 経路 | 仕込み | 実際の結果 |
|------|-------|-----------|
| 正常系 | `aidlc/` 配下に**変更1件 + 新規未追跡1件**、同時に `src/app.ts` を未コミットで汚す | `aidlc/` の2ファイルだけがコミット・push された。`git show --stat` の出力は `aidlc/...` 2行のみ |
| アプリコードの巻き込み | 同上 | `git status --porcelain` → ` M src/app.ts` が**そのまま残った**（stage も commit も push もされていない） |
| 変更なし | 直後にもう一度実行 | `aidlc-share: 'aidlc' に未コミットの変更はありません。push だけ試します。` → `Everything up-to-date` / exit 0。空コミットを作らない |
| ブランチ違い | `bolt/7-x` に切り替えて実行 | `aidlc-share: 現在のブランチは 'bolt/7-x' です。'main' 上でのみ実行します。` / exit **1**。記録の変更は未コミットのまま残る |
| push 拒否 | 別 clone から先に push させてから実行 | `! [rejected] HEAD -> main (fetch first)` → `aidlc-share: push に失敗しました。コミットはローカルに残っています。` / exit **1**。ローカルコミットは残存を確認 |
| **拒否からの復旧**（レビュー指摘2） | 上の状態から `git pull --rebase --autostash origin main` → スクリプト再実行 | rebase 成功（`Created autostash` → `Applied autostash.` → `Successfully rebased`）。再実行が `803e717..820be10  HEAD -> main` を出し、**ゲートのコミットが実際に `origin/main` に載った**（`git log origin/main` で確認）。`src/app.ts` の未コミット変更は復元されて手元に残る |

**未追跡の新規成果物が拾えること**が要点だった。`git commit -- <pathspec>` は未追跡ファイルを拾わないため、`git add -- "$RECORD_PATH"` が必要である。逆に `git add` だけでは操作者が別途 stage したものが混ざるため、`git commit ... -- "$RECORD_PATH"` の pathspec が要る。**両方が必要**で、片方だけでは契約(b)が破れる。

### レビュー指摘2 の是正（初版のサンプルと復旧手順はどちらも壊れていた）

初版は「`aidlc/` に未コミットの変更が無ければ `exit 0`」で早期 return していた。**その分岐は「コミット済みだが push できていない」状態にも当たる。** そのため拒否 → rebase → 再実行の流れで、再実行が「変更はありません。何もしません。」と成功形の出力を出して exit 0 し、**ゲートのコミットは `origin/main` に載らないまま**になっていた。再現も是正後の確認も、上表の4行目のとおり実リポジトリ相当のスクラッチで実行して確かめた。

是正は、早期 return をやめて **push まで必ず到達させる**こと（`async-sharing.md:49-56`）。コミットを作るかどうかだけを分岐し、push は無条件に走らせる。真に何もすることが無い場合は git 自身が `Everything up-to-date` と出して exit 0 で終わるので、「何もしなかった」ことは git の出力で読める。

**さらに、記述していた復旧手順そのものも動かなかった。** `git pull --rebase origin main` は作業ツリーが汚れていると `error: cannot pull with rebase: You have unstaged changes.` で失敗する。このスクリプトを使う場面は定義上「アプリコードを触っている最中にゲートを通過した」であり、汚れているのが通常である。`--autostash` を足して実測で通ることを確認し、G-2 に「省くと失敗する」ことを理由付きで書いた（`async-sharing.md:134-146`）。**この2点目はレビュー指摘には無く、指摘1の再現作業の中で見つけた。**

### 参加者側（checkout 不要）

`git clone --no-checkout` → 作業ツリーは `.git` のみ。その状態で以下が全て成功:

```
git fetch origin
git show origin/main:aidlc/.../requirements.md      → ファイル内容が stdout に出た
git ls-tree -r --name-only origin/main -- aidlc/    → 3件のパスが列挙された
git log --oneline origin/main -- aidlc/             → ゲートごとのコミット2件
git diff --stat origin/main~1 origin/main -- aidlc/ → 直前ゲートの差分2ファイル
```

代替2の `git archive --format=zip --output=... origin/main aidlc/` も実行し、`unzip -l` で先頭に commit SHA、続いて `aidlc/` 配下のパスが並ぶことを確認した。

## `.gitignore` の記述（推測せず現物から）

G-2「何を共有し、何を共有しないか」の2表は、リポジトリの `.gitignore:26-55` を読んで書いた。ignore 側6項目（`aidlc/active-space` / `aidlc/spaces/*/intents/active-intent` / `aidlc/.aidlc-clone-id` / `aidlc/.aidlc-sessions/` / `runtime-graph.json` / `.aidlc-*`）+ `.claude/settings.local.json` は ignore ルールそのものから採った。

**共有側は当初 `.gitignore:47-54` の「COMMITTED（NOT ignored、記録のためここに列挙）」コメントブロックを写しており、それが誤りだった**（レビュー指摘5）。このコメントは `aidlc/spaces/*/knowledge/**` を挙げていないが、当該パスはこのワークスペースに実在し（`aidlc/spaces/default/knowledge`）、ignore ルールも存在しないため実際には共有される。**コメントの網羅性を判定根拠にしたことが誤りの原因**である。是正として、

- G-2 の共有側の表に `aidlc/spaces/*/knowledge/**` の行を追加（`async-sharing.md:239`）
- **判定根拠は ignore ルールの有無であって `.gitignore` 末尾コメントではない**ことを明記し、`git check-ignore -v <パス>` で確かめる導線を付けた（`async-sharing.md:263`）。コメント自身に漏れがあることも同じ場所に書いた

**参加者にとっての帰結**（`async-sharing.md:257-261`）は、この分割から導いた事実を書いた:

- アクティブインテントのカーソルが ignore されるので、**参加者にはどのインテントを見ればよいかが伝わらない** → `git ls-tree` で確かめる導線を書いた
- 監査はクローンごとのシャードなので、共有側に乗るのは push した人の分だけ
- `.gitignore` に追加ルールを足さないよう明記（特に監査シャードを ignore すると履歴が失われる）

## S-OG-3 スキャン結果（実在値の不在）

`grep -nE "\.local\b|<IPv4 パターン>|ghp_|sk-|Bearer "` の全ヒットを判定:

| ヒット | 判定 |
|-------|------|
| `127.0.0.1` (7件) | ✅ 実装が実際に出力する loopback アドレス。プレースホルダにすると嘘になる |
| `0.0.0.0` (2件) | ✅ 同上（`--host` 時の待受アドレス）。「参加者が開く URL ではない」と注記済み |
| `192.0.2.10` (3件) | ✅ RFC 5737 TEST-NET-1。プレースホルダである旨を本文で明記 |
| `.claude/settings.local.json` (1件) | ✅ `.local` ホスト名ではなくリポジトリ内の実在パス（`.gitignore` の記載どおり） |
| `example.com` (3件) | ✅ RFC 2606 予約ドメイン。`aidlc-mob.example.com` として使用 |
| トークン様文字列 | ✅ **0件**。cloudflared は `tunnel login` フロー、Tailscale は `serve` を採ったため、手順にトークンが登場しない（`<YOUR_TOKEN>` プレースホルダを使う場面自体が発生しなかった） |

`.local` を mDNS ホスト名として使った箇所は無い（security-design.md の規約どおり）。

> **件数はレビュー指摘4を受けて再計測した。** 初版の表は `0.0.0.0` を1件（実際は2件: `live-share.md:154,157`）、`example.com` を2件（実際は3件: `:241` と `:245` の2箇所）と誤記していた。`127.0.0.1` は指摘時点で6件が正しく、上表の7件はレビュー指摘1の修正で `:197` にトンネル停止の注意（`127.0.0.1:4700` を含む）を追加した結果である。**判定はいずれも初版から変わっていない — 誤っていたのは数だけ。** 出現位置の全件は `grep -n -o` で列挙して確認した。

## BR-OG-7 の棚卸し（コマンド + 期待出力の併記）

「抽象的な方針だけの節が無いこと」の確認。コマンドを含む全ブロックに期待される出力・結果を付けた。

| 文書・節 | コマンド | 併記した期待 |
|---------|---------|------------|
| G-1 セットアップ | `code --install-extension` / `code --list-extensions \| grep` | `successfully installed` を含む行 / `MS-vsliveshare.vsliveshare` |
| G-1 read-only 共有 | パレット操作 + `settings.json` | ゲストのプロンプトが反応しないこと（確認手順を独立させた） |
| G-1 Dashboard | `bun run dashboard` / `--host` | `AIDLC Guide dashboard: http://127.0.0.1:4700` / 警告 → URL 見出し → 一覧の3ブロック |
| G-1 回答記入 | 停止 → loopback 起動 → 記入 → 再開 | 参加者側 LiveStatus が「ライブ更新中 · 最終更新 …」に変わる |
| G-1 トンネル | `cloudflared tunnel {login,create,route,run}` / `tailscale serve` | `Registered tunnel connection` / `Available within your tailnet:` + `.ts.net` URL。**確認手順**（シークレットウィンドウで Access のログイン画面が出ること）を付けた |
| G-1 代替 | `tmux -S ... new` / `attach -r` | 参加者の入力が無視されること。detach キー・後始末コマンドまで |
| G-1 トラブルシュート | `curl -w "%{http_code}"` ×2 / `--port` / `bun run build:dashboard` | `200` / `Connection refused` / `✓ built in <秒数>s` |
| G-2 push | `sh scripts/aidlc-share.sh "<ゲート名>"` | push 行 + 完了メッセージ、`git show --stat` と `git status --porcelain` による**検算**2本 |
| G-2 閲覧 | `clone --no-checkout` / `fetch` / `show` / `ls-tree` / `log` / `diff` | 各コマンドの実出力（スクラッチ検証で採取したもの） |
| G-2 代替 | 手動 3コマンド / `git archive` + `unzip -l` | push 行 / zip の中身一覧 |

**クロスプラットフォーム**（team.md「Windows Git Bash と macOS の両方で動くこと」）: `grep` は両方にある旨と PowerShell 版（`Select-String`）を併記。`ipconfig`（Windows）と `ifconfig`/`ip addr`（macOS）を対で提示。ファイアウォールの節は Windows と macOS の両方の操作を書いた。**`tmux` が Git Bash に無いことは明記して代替の適用範囲を限定した**（できないことを黙らない）。

## 品質ゲート実測（`bun run check`）

```
$ bun run check

biome check .                        Checked 155 files in 160ms. No fixes applied.
tsc --noEmit                         (エラーなし)
tsc --noEmit -p packages/dashboard   (エラーなし)
vitest run --coverage                Test Files  52 passed (52)
                                     Tests  685 passed | 2 skipped (687)
                                     Statements   : 96.53% ( 1504/1558 )
                                     Branches     : 92.6%  ( 989/1068 )
                                     Functions    : 96.78% ( 361/373 )
                                     Lines        : 97.73% ( 1336/1367 )
bun audit                            No vulnerabilities found

exit code 0
```

**mob-mode 完了時点から一切変動していない**（`52 passed` / `685 passed | 2 skipped` / `Checked 155 files` / カバレッジ4指標すべて同値）。Biome 2.x は Markdown を lint しないため `docs/**` の追加はチェック対象ファイル数を動かさない。**除外設定は追加していない**（team.md の単一ローカルゲートを崩していない）。

## 実物に当てて確かめていない記述（正直に残す）

この環境から検証できないのは、**本リポジトリの外にある外部製品の記述すべて**である（初版は「唯一」と書いていたが誤り — レビュー指摘3）。内訳:

| 未検証の記述 | 所在 | 緩和 |
|------------|------|------|
| VS Code Live Share の設定キー名4件 | `live-share.md:81-95` | 下記3点（主経路をパレット操作に / 現物確認の注記 / 実効性の確認手順） |
| Live Share の招待リンクのホスト形式 | `live-share.md:59` | 「形式」と明示しており、操作者はクリップボードに入った実物を渡す。リンクの中身に依存する手順は無い |
| cloudflared のサブコマンド形（`tunnel create` / `route dns` / `run --url`） | `live-share.md:239-242` | `cloudflared tunnel --help` / `tunnel route --help` で現物を確認してから使うことを明記（`:249`）。版によっては `config.yml` の `ingress` で書く形が推奨される旨も添えた。**Access のログイン画面が出ることの確認（手順3）はどの版でも省略しないよう明記** |
| `tailscale serve 4700` の引数形 | `live-share.md:258` | `tailscale serve --help` で現物を確認する注記を既に付けていた（`:272`）。`serve status` / `serve reset` で結果を目視できる導線もある |

**いずれも「手順が動かなければその場で分かる」形にしてあり、黙って安全でない状態になる経路は無い。** 唯一その性質を持たないのが Live Share の設定キーで（存在しないキーを VS Code は黙って無視する）、そこだけ確認手順を独立させている。

### VS Code Live Share の設定キー（最も注意が要る1件）

**設定キー名は、本リポジトリのコードからは検証できない。** `liveshare.autoShareTerminals` / `allowGuestDebugControl` / `allowGuestTaskControl` / `guestApprovalRequired` は拡張側の設定であり、この環境から拡張の設定スキーマを引く手段が無かった（外部ドキュメント参照も利用不可）。

そこで G-1 は次の形にした:

1. **手順の主経路をコマンドパレット操作にした** — パレットに `Live Share:` と打てば現物の候補が並ぶので、表示名が版で違っても操作者はその場で正しいものを選べる
2. **設定表には「設定 UI で `liveshare` を検索して現物にキーが存在することを確認してから使う」注記を付けた**（`live-share.md:97`）。存在しないキーを書いても VS Code は黙って無視するため、「設定したつもりで効いていない」が最悪の失敗モードである旨も書いた
3. **read-only の実効性の確認手順を独立させた**（`live-share.md:99-101`）— 設定に頼らず、ゲストに実際に打ってもらって反応しないことを見る

BR-OG-3 は「設定名と値、read-only にする理由」を要求しており、上記で3点とも満たしている。ただし**キー名そのものの正しさは、初回の実運用で確認して必要なら直す**必要がある。

## 既知の制限

- **文言ドリフトの自動検知は無い**（tech-stack-decisions.md / security-design.md の明示決定）。上記の照合スクリプトは本ステージで1回走らせたもので、CI にもローカルゲートにも入れていない。将来 `HOST_EXPOSURE_WARNING` 等を変更する場合は、G-1 に引用元をファイル名 + 定数名で書いてあることを手掛かりに、その変更作業の中で G-1 を直す運用に依存する
- **`git archive` 代替は差分で追えない**（G-2 に明記）。ゲートを重ねるほど不利になる
- **トンネル公開は `--host` の副作用として LAN にも開く**。read-only を得る手段が `--host` しか無いため、リモートモブでは「LAN にも開く」ことを受け入れる形になる。フラグを分離すればこの副作用は消せるが、それは U5/U8 の契約変更であり本 Unit の範囲外（`live-share.md:227` に事実として明記した）。**この不可分性は「回答記入のため一時的に `--host` を外す」手順にも波及する** — トンネルを先に閉じないと、その窓の間だけリモート参加者に書き込みが通る（`live-share.md:197`。レビュー指摘1）
- **US-22 AC の実行検証はスクラッチリポジトリで行った**（本ワークスペースが git リポジトリでないため）。実リポジトリでの初回実行時は `git remote get-url origin` で push 先が意図した private リポジトリであることを確認してから使うこと（G-2 の冒頭に注意として置いた）

---

## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25

### What was independently re-verified (not taken from this summary)

- **全逐語引用を機械照合し直した。** 定数をソースから `import` し、ガイド本文から `> ` を剥がし `&lt;`/`&gt;` を戻したうえで部分文字列判定。`HOST_EXPOSURE_WARNING` / `DIST_MISSING_HINT` / `EXPOSURE_ADDRESS_HEADING` / `EXPOSURE_NO_ADDRESS_HINT` / ポート使用中ヒント / `READ-ONLY · 参加者ビュー` / LiveStatus 全5文言 = **11/11 OK**。パラフレーズは1件も無い。
- **起動出力を実測した。** `--host --port 4711` の実出力は「警告 → `参加者に共有する URL:` → インデントされたアドレス群 → `AIDLC Guide dashboard: http://0.0.0.0:4711`」で、`live-share.md:137-157` の記述順・書式と一致。複数 NIC（`10.5.0.2` と `192.168.0.189` の2行）が実際に出ることも確認でき、`:157` / `:335` の注記が空論でないことを裏付けた。loopback は `AIDLC Guide dashboard: http://127.0.0.1:4712`。
- **`bun run dashboard --help` の passthrough を実測した。** `"dashboard": "bun run build:dashboard && bun packages/dashboard-server/src/cli.ts"` の `&&` チェーンでも引数は末尾に付くため `--host` / `--port` は届く。`✓ built in 15.74s` も `:361` の記述どおり。
- **フックサンプルをガイドから `sed` で抜き出してスクラッチ repo で走らせ直した。** 契約3条件を敵対的に攻撃した結果: (b) は破れない — 未追跡の新規 `aidlc/` ファイルは拾われ、**操作者が事前に `git add` していた `src/app.ts` は commit に入らず `M ` のまま残った**（`git add --` と `git commit ... --` の両方が要るという `:109` の論証は正しい）。(a) は detached HEAD でも `'HEAD' です` として exit 1 で fail-closed。(c) push 拒否時にリモートは一切書き換わらず、`! [rejected]        HEAD -> main (fetch first)` は `:131` の記載と逐語一致。
- **参加者側の checkout 不要経路を実行した。** `--no-checkout` clone の作業ツリーは `.git` のみ、`fetch` / `show` / `ls-tree` / `log` / `diff --stat` / `git archive` + `unzip -l`（先頭に commit SHA）すべて記載どおり。
- **`AnswerEditor.tsx:168` の `if (hostMode || answerLines.length === 0) return null;` を確認**し、`live-share.md:173`「編集 UI は描画されない」が実挙動どおりであることを裏取りした（`Header.tsx:19` のバッジ条件も同様）。
- **`bun run check` = exit 0。** `Checked 155 files` / `52 passed` / `685 passed | 2 skipped` / カバレッジ4指標すべてこの summary の記載と同値。ゲートは緑で、`docs/**` の追加はゲートを動かしていない。
- **S-OG-3 スキャンを自前で流し直した。** 実在ホスト名・実 IP・トークン様文字列は**ゼロ**。`.local` を mDNS ホスト名として使った箇所も無い。
- **`.gitignore` 2表の突合。** `async-sharing.md:229-239` の ignore 側7行は `.gitignore:34-55` と、`:221-227` の commit 側6行は `.gitignore:47-54` の COMMITTED コメントブロックと一致。
- **file:line 主張の抜き取り検査。** `live-share.md` の H2 8節・`async-sharing.md` の H2 5節は domain-entities.md の骨格と完全一致（`grep -n "^## "` で確認）。行数 394 / 291 も `wc -l` と一致。`:179` `:181` `:183` `:186` `:210-216` `:139` `:152` `:161` `:170` `:340` `:352` `:369-373` `:109-115`、`async-sharing.md:33-61` `:38` `:39` `:48` `:54` `:63-78` `:157` — すべて記載どおり。

BR-OG-1 / S-OG-1 / S-OG-4 / S-OG-5 / BR-OG-5 は充足を確認した。S-OG-4 は「アプリコードを push できるか / 別ブランチへ行くか / リモートを壊せるか」を実際に攻撃して破れなかった。実装から導いた2つの発見（`handleAnswer` が `ctx.hostMode` だけを見て接続元を見ないこと、`--host` が `server.ts:90` と `:110` で同じ `config.host` を読む1フラグ2効果であること）も**どちらもソースで裏が取れた**。

以下2件は、その2つの発見を**節をまたいで**適用したときに崩れる。どちらも単体の節としては正しく、組み合わせで壊れる。

### Findings

**1. [Blocking] 「モブ中の回答記入」の手順3をトンネルセッション中に実行すると、リモート参加者に書き込み権限が開く。`:206` の可視性の記述も、その構成では事実に反する。**

- 所在: `docs/guides/live-share.md:195-206`
- 契約: BR-OG-6（実挙動と食い違う記述をしない）/ S-OG-1・S-OG-2（公開の帰結を運用者に正しく判断させる）
- 事実関係（ソースで確認済み）: `handleAnswer` の唯一のモードゲートは `answer-writer.ts:153` の `if (ctx.hostMode) return deny("read-only-mode", 403)` で、**接続元アドレスを一切見ない**。`ctx.hostMode` は `server.ts:90` → `cli.ts:32` の `--host` のみに由来する。
- 破れ方: 手順3は「`--host` を止める → `bun run dashboard`（loopback）で起動し直す → 記入する」。ところが cloudflared（`tunnel run --url http://127.0.0.1:4700`）も Tailscale（`serve 4700`）も**ダッシュボードの再起動をまたいで常駐し、同一ホストの loopback:4700 へ再接続する**。したがってこの窓の間、リモート参加者は (i) 見え続け、(ii) `hostMode === false` になったため `POST /api/answer` が通る。読み取り専用を担保していた唯一の制御が、操作者が「閉じた」と思っている間だけ外れる。
- `:206` の「**手順3の間だけ参加者からは Dashboard が見えなくなる**」は LAN 構成でのみ真で、トンネル構成では偽。安全側に誤解させる向きの誤りである。
- ガイド自身が同じ機構を `:267` で言語化している —「Dashboard が落ちた後もトンネルの URL が生きたまま残り、次に何かを 4700 で起動した瞬間にそれが公開される」。手順3はまさにその「次に何かを 4700 で起動した」であり、起動されるのは書き込み可能なダッシュボードである。終了手順にはこの規則があり、記入手順には無い。
- 修正: 手順3に前提条件を1行足す —「トンネルを張っている場合は、`--host` を落とす前にトンネルを先に閉じる（`Ctrl+C` / `tailscale serve reset` で `:265-275` の順序どおり）。トンネルが生きたまま `--host` を外すと、リモート参加者の書き込みが有効になる」。あわせて `:206` の可視性の文を LAN 構成に限定するか、トンネル時の帰結を併記する。

**2. [Blocking] push 拒否からの復旧手順が、記載どおりに実行しても復旧しない。ゲートのコミットがリモートに乗らないまま exit 0 で成功に見える。**

- 所在: `docs/guides/async-sharing.md:131`（「起きうる失敗と対処」表3行目）
- 契約: BR-OG-7（コピペで実行可能）/ BR-OG-4・US-22 AC（ゲート通過で push され、参加者が閲覧できる）
- 記載: 「`git pull --rebase origin main` してから、もう一度スクリプトを叩く。commit はローカルに残っているので、作り直す必要はない」
- 再現（衝突しない現実的な構成 — 別の人が別ファイルを触ったケース）: 拒否 → 記載どおり `git pull --rebase origin main`（成功、`aidlc: my-gate` が上に replay される）→ **スクリプト再実行 → `aidlc-share: 'aidlc' に変更はありません。何もしません。` / exit 0** → `origin/main` に my-gate は**乗っていない**。
- 原因: 早期 return が `git diff --cached --quiet -- "$RECORD_PATH"`（＝未コミットの差分の有無）で判定されており、リモートに対して**ローカルが進んでいるか**を見ていない。rebase 後は stage すべきものが無いため、`git push` に到達する前に打ち切られる。
- 影響: 出力もexit code も成功形なので、操作者は共有済みだと信じる。非同期参加者には見えない。ガイド自身の「失敗を握り潰さない」原則（`:78`）が守れていない唯一の経路であり、しかも**共有リポジトリを2人以上で使う＝本規約の前提そのもの**で必ず踏む。
- 修正（どちらか）: (i) `:131` の対処を「`git pull --rebase origin main` してから `git push origin HEAD:refs/heads/main` を直接叩く（スクリプトの再実行は『変更なし』で止まる）」に直す。(ii) サンプル側で、変更が無くてもローカルが先行していれば push する分岐にする（例: `git rev-list --count "$REMOTE/$BRANCH..HEAD"` が 0 でなければ push へ進む）。(ii) を採る場合は `:66-78` の「すること/しないこと」も追随させる。

**3. [Non-blocking] 「未検証の1点」は1点ではない。`code-summary.md:200` の「これが本 Unit で唯一、実物に当てて確かめていない記述である」は偽。**

- 同じく実物に当てていない外部ツールの記述が少なくとも3つある: cloudflared のサブコマンド形（`live-share.md:232-235`）、`tailscale serve 4700`（`:249`）、Live Share 招待リンクのホスト形式（`:59`）。
- Tailscale は `:263` に「`tailscale serve --help` で現物を確認してから使うこと」があり自己申告済み。**cloudflared には同等の注記が無い**のが非対称。
- 実害は小さい: 手順3（`:240`）のシークレットウィンドウで Access のログイン画面が出ることを確認させる検証が、コマンド形式が版で変わっていようと**安全性そのものは行動で捕まえる**設計になっている。フラグが違えばコマンドが失敗して気づく。したがって BR-OG-3 の判断（コマンドパレット優先 + 現物確認の注記 + 実効性の独立確認）は妥当であり、**設定キーの未検証は defect ではない**と判定する。直すべきは summary の「唯一」という主張のほうで、cloudflared にも `:263` と同じ形の一行注記を足せば対称になる。

**4. [Non-blocking] S-OG-3 スキャン表の件数が2箇所ずれている。** `code-summary.md:141` は `127.0.0.1` を7件とするが実際は6件（`live-share.md:126,201,218,235,242,327`）、`:142` は `0.0.0.0` を1件とするが実際は2件（`:154,157`）。判定（すべて許容）はいずれも正しく、S-OG-3 の結論は変わらない。件数を実測値に直すこと。

**5. [Non-blocking] `async-sharing.md:221-227` の「共有される」表に `aidlc/spaces/*/knowledge/**` が無い。** このワークスペースには `aidlc/spaces/default/knowledge` が実在し、`.gitignore` のどのルールにも該当しないため実際には共有される。表は `.gitignore:47-54` の COMMITTED コメントを忠実に写しており、抜けの出所はそちら側。参加者が「チーム知識も共有物である」ことを表から読み取れないので、1行足すのが望ましい。

### 判定の根拠

Findings 1 と 2 はどちらも、**ガイドが指示したとおりに実行した結果**が「安全側の制御が外れる」「共有できていないのに成功に見える」に着地する。BR-OG-6（実挙動と食い違う記述をしない）と BR-OG-7（コピペで実行可能）は本 Unit の中心的な記載義務であり、`kind: spec` の Unit にとって「手順が実際には成立しない」は実行コードのバグと等価である（security-requirements.md「位置づけ」の「ガイドの記述ミスが実際の情報漏洩につながる」という本 Unit 自身の定義による）。したがって NOT-READY。

裏を返せば、他はすべて通っている。逐語引用11件・起動出力・passthrough・フック契約3条件・参加者側6コマンド・`.gitignore` 2表・H2 骨格・ゲート緑まで、この summary の主張は件数2箇所と「唯一」の1語を除いて実測で裏が取れた。上記2件は節をまたいだ組み合わせでのみ現れるもので、修正はいずれも数行の追記で閉じる。

---

## Review (iteration 2)

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25

指摘5件すべて解消。ブロッカー2件は実行で閉じたことを確認した。行番号はガイドが 403 / 309 行に変わったため全件を採り直している。

### Blocking 1 — 解消（トンネル → Dashboard の順序）

- **順序が手順として強制されている。** `live-share.md:195`（手順3の導入）→ `:197`（注意ブロック）→ `:199-209`（サンプル、その `# 0.` がトンネル停止）と、上から読む人が必ず「閉じる」を先に踏む配置になっている。注意ブロックがサンプルの**前**にあり、サンプル内の番号も 0 → 1 → 2 → 3 → 4 で、`# 1. --host の Dashboard を Ctrl+C で停止` より前に 0 が来る。踏み外しようがない。
- **機構の説明が実装と一致。** `:197` は「`answer-writer.ts:153` は `ctx.hostMode` しか参照しない」「cloudflared / `tailscale serve` は Dashboard の再起動を跨いで生き続け `127.0.0.1:4700` に再接続する」と、私がソースから確認したのと同じ因果を書いている。
- **虚偽だった可視性の記述が正しくなった。** `:213` は「LAN 参加者は loopback bind により到達不能」「リモート参加者は手順0でトンネルを閉じたことにより到達不能」と**理由を分けて**書き、さらに「手順0を飛ばした場合、リモート参加者にだけは見え続け、かつ書き込みも通ってしまう」と失敗時の帰結まで明示している。初版の無条件の「見えなくなる」は消えた。
- **他節に「`--host` を外すだけで十分」を含意する記述は残っていない**（`--host` の全出現 18 箇所を確認）。`:177` の「停止すると LAN からは即座に見えなくなる」は LAN 節の中で LAN に限定した記述で正しい。`:388`（403 のトラブルシュート）は修正後の「モブ中の回答記入」へ委譲しており、独自に手順を再掲していない。`:274` の「終わったら閉じる」は元から順序が正しく、`:197` からのアンカー `#終わったら閉じる` は実在する H3 に解決する。

### Blocking 2 — 解消（実行で確認。5経路 + 復旧 + 新規ホール2件を再走）

改訂サンプルをガイドから `sed -n '34,61p'` で抜き出し、スクラッチ repo で全経路を走らせ直した。

| 経路 | 結果 |
|------|------|
| 正常系（記録変更 + 未追跡新規 + 作業中アプリ + **事前 stage 済みアプリ**） | commit は `aidlc/` 2ファイルのみ。事前 stage の `src/app.ts` は commit されず `M ` のまま残存。exit 0 |
| 未コミット変更なし・共有済み | `push だけ試します` → `Everything up-to-date` → `反映済みです（HEAD = …）` / **exit 0**。表 `:130` の記載と一致 |
| ブランチ違い | `現在のブランチは 'bolt/7-mob-mode' です` / **exit 1**。記録は未コミットのまま、リモートは無変更 |
| detached HEAD | `現在のブランチは 'HEAD' です` / **exit 1**（fail-closed） |
| push 拒否 | `! [rejected]        HEAD -> main (fetch first)` → exit 1。リモートは書き換わらず、ローカルコミットは残存 |

**復旧経路（初版の欠陥そのもの）を最後まで走らせた:**

- 旧記述（`--autostash` なし）が本当に失敗することを再現 — 汚れた作業ツリーで `git pull --rebase origin main` は `error: ... your index contains uncommitted changes. Please commit or stash them.` で停止する。**この summary が新たに見つけた3つ目の欠陥は実在した。**
- 修正後の `:137-138` の2コマンドを実行: `Created autostash: 7be4c12` → `Applied autostash.` → `Successfully rebased and updated refs/heads/main.` → 再実行で `push だけ試します` → `d1beb05..80b1047  HEAD -> main` → `反映済みです（HEAD = 80b1047）` / exit 0。
- **ゲートのコミットが `origin/main` に到達したことを確認した** — 初版でここが失われていた。`git ls-tree -r origin/main -- aidlc/` に自分の `mine.md` と相手の `OTHER.md` が両方並ぶ。
- **autostash がアプリ側の変更を戻したことも確認**（rebase 後に ` M src/app.ts` が復帰）。
- **封じ込めは全工程を通して破れなかった** — コミット → 拒否 → rebase → autostash → push を経ても、`git show origin/main:src/app.ts` は初期内容のままで、作業中のアプリ変更は1バイトもリモートに乗っていない。

根本原因の直し方も妥当。`git diff --cached --quiet` は「コミットするものが無い」と「コミット済みだが push できていない」の両方で真になるため、これを終了条件にしたのが初版の誤りだった。改訂版は分岐を**コミットを作るかどうか**だけに限定し、push は必ず通る。`:70` の「すること」と `:146` の「`push だけ試します` の行が出ても『何もしなかった』という意味ではない」が、この挙動変更を読み手に正しく伝えている。

**ブランチガードは弱まっていない。** always-push はガードの**後ろ**にあり、`$current != $BRANCH` は push に到達する前に exit 1 する（上表の2経路で実測）。S-OG-4 の契約3条件（対象ブランチ・対象パス・force 不使用）は3つとも維持されている。

### 非ブロッカー 3 / 4 / 5 — 解消

- **3**: 「唯一」が4行の未検証表（`:211-217`）に置き換わり、cloudflared にも `live-share.md:249` で版差の注意が入った。この注意は `cloudflared tunnel --help` / `tunnel route --help` での現物確認を求めつつ、**「手順3の確認（シークレットウィンドウで Access のログイン画面が出ること）だけは、どの版でも省略しない」**と安全側の検証を版差から切り離している。Tailscale との非対称は解消。
- **4**: 件数を独立に採り直し、`127.0.0.1` 7 / `0.0.0.0` 2 / `192.0.2.10` 3 / `example.com` 3 で表と一致。`127.0.0.1` が 6→7 になったのは指摘1の修正で `:197` に `127.0.0.1:4700` が増えたためで、`:165` の注記がそう説明している — 数字合わせではなく実際の増分。禁止パターン（`.local` の mDNS 用法・トークン様文字列・実在 IP）は再スキャンでも0件。
- **5**: `:239` に `aidlc/spaces/*/knowledge/**` が追加され、`:263` が「`.gitignore` のコメントの写しではない」「判定は ignore ルールの有無であって、あのコメントの網羅性ではない」「迷ったら `git check-ignore -v`」と、抜けの出所と決め手を両方書いている。

### 修正で壊れていないことの再確認

ガイド2本が編集されたため、初版で通した項目のうち影響を受けうるものだけ引き直した。

- **逐語引用 11/11 OK**（定数を `import` して部分文字列判定。`HOST_EXPOSURE_WARNING` / `DIST_MISSING_HINT` / `EXPOSURE_ADDRESS_HEADING` / `EXPOSURE_NO_ADDRESS_HINT` / ポート使用中ヒント / バッジ / LiveStatus 全5文言）
- **H2 骨格** — G-1 8節 / G-2 5節、domain-entities.md と完全一致のまま
- **`bun run check` = exit 0**、`Checked 155 files` / `52 passed` / `685 passed | 2 skipped` / カバレッジ4指標すべて初版と同値

### 残る指摘（非ブロッカー、1件）

**6. [Non-blocking] `async-sharing.md:75` の「アプリケーションコードを一切 stage / commit / **push** しない」のうち、`push` だけが実挙動と違う。**

- 実測: `main` に自分のアプリコードのコミットが1つ未 push で存在し、`aidlc/` に未コミット変更が**無い**状態でスクリプトを叩くと、`push だけ試します` の経路から `git push "$REMOTE" "HEAD:refs/heads/$BRANCH"` が走り、**そのアプリコードのコミットが `origin/main` に乗る**（`git show origin/main:src/app.ts` で確認）。
- これは `HEAD:refs/heads/main` がブランチ全体を送る git の通常挙動であり、**初版でも記録変更があれば同じことが起きていた**（先行するアプリコミットは常に相乗りしていた）。改訂で新たに壊れたのではなく、「記録変更が無い実行でも起きる」ようになって**露出頻度が上がった**。
- **ブロッカーにしない理由**: (i) 送り先は記録と同じ private リポジトリで、開示範囲は変わらない — 機密性の事象ではない。(ii) team.md / org.md の way of working では作業は短命な Bolt ブランチ上で行い `main` へ squash-merge するため、`main` に未 push のアプリコミットが溜まっている状態自体が想定外。Bolt ブランチで使う場合は `:81` の注記どおり `BRANCH` を書き換えるので、そのブランチのコミットが乗るのはむしろ意図どおり。(iii) 本プロジェクトに CI は無く、早すぎる push がパイプラインを壊すこともない。(iv) 同じ箇所の具体的な約束（pathspec が stage/commit を保証する / 作業中の `src/` の変更と別途 stage したものは手元に残る）は**すべて実測で真**であり、誤っているのは見出し文の `push` の1語だけ。
- 修正案（1行）: 「一切 stage / commit / push しない」→「アプリケーションコードを**新たに stage / commit することはない**（pathspec が保証する）。ただし `git push HEAD:refs/heads/$BRANCH` は**そのブランチに既にあるコミットをすべて送る**ので、対象ブランチに未 push の作業コミットを溜めない運用を前提にすること」。

### 判定

ブロッカー2件は、いずれも**指摘した経路を実際に走らせて**閉じたことを確認した — 順序は手順として強制され、復旧はゲートのコミットをリモートに届ける。改訂で最も壊れやすかった always-push は、ブランチガード・封じ込め・force 不使用のいずれも損なっていない。残る指摘6は1語のスコープ誤りで、開示範囲を広げず、周辺の具体的記述はすべて真。**人間ゲートへエスカレーションすべき事項は無い。READY。**

## Post-review resolution (conductor, 2026-07-25)

イテレーション上限（2/2）到達後、レビュー指摘6（非ブロッキング）を修正した。**全 Finding クローズ。**

`async-sharing.md`「しないこと」の1行目が「アプリケーションコードを一切 stage / commit / **push**
しない」と書いていたが、**push は正しくない**。git の push はブランチ単位でありパス指定を持たない
ため、`$BRANCH` に既にコミット済み・未 push のアプリコードがあれば、このスクリプトの push は
それも公開する（レビュアーが実行で確認済み）。stage / commit は pathspec が保証しており事実。

修正: 当該行を stage / commit に限定し、直下に push のブランチ単位性と、その帰結
（private リポジトリ前提なので開示範囲は変わらないが「記録だけが飛ぶ」とは考えないこと、
アプリコードは Bolt ブランチ側で扱い `main` に未 push コミットを溜めない運用が効くこと）を追記した。
フックのサンプル自体は変更していない（S-OG-4 の契約3条件は影響を受けない）。
