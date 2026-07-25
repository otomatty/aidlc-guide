# Live Share 運用ガイド（モブセッション）

> 対象: AIDLC Guide のモブセッションを回すドライバー（ホスト役）と参加者
> 関連: [非同期共有規約](./async-sharing.md)（同席できない人への共有）

## 前提と適用範囲

モブで困るのは「ドライバーの画面しか見えない」ことではなく、**参加者が自分の手元でワークフローの現在地を確認できない**ことである。本ガイドは2つの道具を役割分担させてそれを解く。

| 道具 | 共有するもの | 誰が操作できるか |
|------|------------|----------------|
| VS Code Live Share | コード・エディタ・ターミナル | ドライバー（ゲストは read-only 推奨 — 後述） |
| Dashboard `--host` | ワークフローの現在地・成果物・監査 | 誰も書き込めない（サーバが全クライアントの書き込みを拒否する） |

**前提**:

- リポジトリを clone 済みで `bun install` が通っていること
- Windows（Git Bash）と macOS のどちらでも同じ手順で動く。OS で分かれる箇所は都度明記する
- VS Code Live Share は Microsoft アカウント / GitHub アカウントでのサインインが要る（組織ポリシーで塞がれている場合は「[使えないときの代替](#使えないときの代替)」へ）

**適用しない場合**: 参加者が同席できない（非同期）なら本ガイドではなく [非同期共有規約](./async-sharing.md) を使う。

## セットアップ

### 1. 拡張の導入

```sh
code --install-extension MS-vsliveshare.vsliveshare
```

期待される出力: 最終行に `successfully installed` を含む行が出る。既に入っていれば `is already installed` と出て終了する（どちらも成功扱いでよい）。

導入済みかどうかだけを確かめたい場合:

```sh
code --list-extensions | grep -i vsliveshare
```

期待される出力:

```
MS-vsliveshare.vsliveshare
```

（何も出力されなければ未導入。`grep` は Git Bash・macOS のどちらにもある。PowerShell から実行する場合は `code --list-extensions | Select-String vsliveshare`。）

### 2. サインインと共有の開始

コマンドパレット（Windows: `Ctrl+Shift+P` / macOS: `Cmd+Shift+P`）で `Live Share:` と入力すると候補が並ぶ。使うのは次の3つ。

| コマンドパレットの候補 | 用途 |
|---------------------|------|
| `Live Share: Sign In` | 初回のみ。ブラウザが開いて認証する |
| `Live Share: Start Collaboration Session (Share)` | セッション開始。招待リンクがクリップボードにコピーされる |
| `Live Share: Stop Collaboration Session` | セッション終了。**モブが終わったら必ず実行する** |

> 候補の表示名は拡張のバージョンで変わることがある。上表と完全一致しなくても、パレットに `Live Share:` と打てば現物の候補が並ぶので、そこで確認する。

期待される結果: VS Code 左下のステータスバーが共有中の表示に変わり、招待リンク（`https://prod.liveshare.vsengsaas.visualstudio.com/join?...` 形式）がクリップボードに入る。このリンクを参加者に渡す。

> **リンクを渡す相手を確認する**: 招待リンクを持つ人は誰でも参加できる。チャットの公開チャンネルではなく、モブの参加者だけがいる場所に貼る。

## ターミナルの read-only 共有

### なぜ read-only にするのか

Live Share の共有ターミナルは、**ドライバーのマシンの、ドライバーの権限で動くシェル**である。read/write で共有すると、ゲストはそこから `git push`、`rm`、`bun run` を、ドライバーの認証情報のまま実行できる。モブで必要なのは「テストの出力が全員に見えること」であって「全員が叩けること」ではない。既定を read-only に寄せておけば、書き込みが要る場面だけ明示的に開けばよい。

### 手順

1. コマンドパレット → `Live Share: Share Terminal`
2. アクセスレベルの選択が出る → **Read-only** を選ぶ
3. 共有したいターミナルを選ぶ

期待される結果: ゲスト側にターミナルが現れ、出力はリアルタイムに流れるが、**プロンプトに入力しても送信されない**。

### 設定で既定を固める

`.vscode/settings.json`（リポジトリ単位）またはユーザー設定に貼る:

```json
{
  "liveshare.autoShareTerminals": false,
  "liveshare.allowGuestDebugControl": false,
  "liveshare.allowGuestTaskControl": false,
  "liveshare.guestApprovalRequired": true
}
```

| キー | 値 | 意味 |
|------|----|------|
| `liveshare.autoShareTerminals` | `false` | セッション開始後に開いたターミナルを自動共有しない。共有は毎回、上記の手順で明示的に行う |
| `liveshare.allowGuestDebugControl` | `false` | ゲストがデバッグセッションを開始・停止できない |
| `liveshare.allowGuestTaskControl` | `false` | ゲストが `tasks.json` のタスクを実行できない（タスクは実質的に任意コマンド実行である） |
| `liveshare.guestApprovalRequired` | `true` | 参加者が入るたびにドライバーに承認を求める |

> **設定キーは現物で確認する**: 上表は本リポジトリのコードではなく VS Code Live Share 拡張の設定である。設定 UI（`Ctrl+,` / `Cmd+,`）で `liveshare` を検索し、実際にインストールされているバージョンにそのキーが存在することを確認してから使うこと。存在しないキーを書いても VS Code は黙って無視するため、設定したつもりで効いていない状態になりやすい。

### 確認

ゲストに1人入ってもらい、共有ターミナルで文字を打ってもらう。**プロンプトが反応しなければ read-only が効いている。** 文字が入るなら read/write で共有されているので、`Live Share: Stop Sharing Terminal` してから手順2をやり直す。

## Dashboard の併用

Live Share はコードを共有するが、ワークフローの現在地（どのフェーズ・ステージ・ユニットにいて、次に人間が何を求められているか）は共有しない。それは Dashboard の仕事である。

### 公開範囲を先に決める

Dashboard をどこまで開くかは3段階ある。**開いてから考えるのではなく、開く前にこの表で選ぶ。**

| 公開範囲 | 起動方法 | 誰が見えるか | 認証 | 推奨用途 |
|---------|---------|------------|------|---------|
| loopback（既定） | `bun run dashboard` | 自分の PC のみ | 不要 | 通常の1人作業 |
| LAN | `bun run dashboard --host` | 同一ネットワークの**全端末**（成果物・監査内容が読める） | **無し**（ツールは認証機構を持たない） | 同席モブ |
| トンネル | `--host` + cloudflared / Tailscale | トンネル URL を知る**全員**（設定次第でインターネット全体） | **運用側で必須**（Access / ACL） | リモートモブ → [リモート参加（トンネル公開）](#リモート参加トンネル公開) |

### 既定（loopback）での起動

```sh
bun run dashboard
```

期待される出力（最終行）:

```
AIDLC Guide dashboard: http://127.0.0.1:4700
```

この URL は自分の PC からしか開けない。停止は `Ctrl+C`。

### LAN 公開（同席モブ）

```sh
bun run dashboard --host
```

`--host` を付けると、起動時に次の警告が**アドレスより先に**表示される。これは `packages/dashboard-server/src/server.ts` の定数 `HOST_EXPOSURE_WARNING` の文言そのものである:

> 警告: LAN に公開します。レンダリングされた aidlc 成果物・監査内容（ユーザーが貼り付けた秘密を含み得る）が同一ネットワークの全端末から閲覧可能になります。また --host 中は回答の書き込みが全クライアントで無効になります（read-only mode）。

**これはポート開放ではなくデータ開示である。** 開くのはポートではなく、レコードの中身（成果物・監査ログ・そこに貼り付けられたもの全部）である。

警告の読み方は3点:

1. **何が見えるか** — レンダリング済みの aidlc 成果物と監査内容。過去に質問回答へ貼り付けた API キーやログの断片があれば、それも見える
2. **誰から見えるか** — 同一ネットワークの全端末。参加者だけではない（カフェ・コワーキング・ゲスト Wi-Fi では見知らぬ端末も含む）
3. **書き込みは全員で無効** — ドライバー自身も含む。詳細は [モブ中の回答記入](#モブ中の回答記入)

警告に続いて、参加者に渡す URL が出る。見出しは `packages/dashboard-server/src/exposure-notice.ts` の `EXPOSURE_ADDRESS_HEADING`:

```
参加者に共有する URL:
  http://192.0.2.10:4700
AIDLC Guide dashboard: http://0.0.0.0:4700
```

（`192.0.2.10` はこのガイドのプレースホルダ。実際には自機の IPv4 が並ぶ。複数の NIC があれば複数行出るので、参加者と同じネットワークのものを選んで渡す。最終行の `0.0.0.0` は待受アドレスであり、参加者が開く URL ではない。）

一覧が出ない場合は、代わりに次の1行が出る（`EXPOSURE_NO_ADDRESS_HINT` の文言そのもの）:

> 待受アドレスを自動検出できませんでした（外部 NIC なし、または列挙に失敗）。公開自体は成立しています — `ipconfig` / `ifconfig` で自機の IPv4 を確認し、`http://<そのIP>:<ポート>` を参加者に共有してください。

**公開自体は成立している**点に注意。一覧が空でも LAN には開いている。

### 参加者の画面

参加者が URL を開くと、ヘッダに次のバッジが出る（`packages/dashboard/src/components/ReadOnlyBadge.tsx`）:

```
READ-ONLY · 参加者ビュー
```

バッジが出ていれば read-only モードで見えている。質問回答の編集 UI は参加者の画面には**描画されない**（要素が存在しない）。

### 停止

`Ctrl+C`。停止すると LAN からは即座に見えなくなる。**モブが終わったら止める。** つけっぱなしは、参加者がいなくなった後もネットワークに開いたままという意味である。

## モブ中の回答記入

**`--host` 中は、ドライバーを含む全員が Dashboard から回答を記入できない。**

これは制限の漏れではなく、ADR-04 が明示的に受容したトレードオフである。参加者と自分を区別する仕組み（クライアント種別の判定）を持たない代わりに、`--host` 中は書き込み経路を**無条件で**閉じている。実装上は `packages/dashboard-server/src/handlers/answer-writer.ts` の最初のゲートで、リクエストの中身を見る前に `403 read-only-mode` を返す:

```
POST /api/answer  →  403  {"error":"read-only-mode"}
```

「ドライバーだけ書ける」抜け道が無いのは意図的である。抜け道を作ると、その判定が参加者にも成立してしまう経路が1つでもあれば read-only が破れる。判定を持たなければ破れようがない。

### モブ中に質問へ回答する手順

1. **口頭で合意する** — その場で結論を出す。Dashboard は合意の材料（成果物・現在地）を全員に見せる役であって、記入面ではない
2. **ドライバーが本線の Claude Code セッションで記入する**（推奨） — モブと並行して動いている本線のセッションで回答する。ゲートの承認・監査イベントが正規の経路で残る
3. 本線セッションが使えない場合のみ、`--host` を止めてから記入する:

> **トンネルを張っている場合は、先にトンネルを閉じること。** 書き込みを拒否しているのは `--host` だけであり、接続元アドレスは一切見ていない（`answer-writer.ts:153` は `ctx.hostMode` しか参照しない）。cloudflared / `tailscale serve` は Dashboard の再起動を跨いで生き続け、`127.0.0.1:4700` に再接続する。つまり **`--host` を外して loopback で起動し直した瞬間、リモート参加者には Dashboard が見えたまま、しかも回答を書き込める状態になる。** 順序は [終わったら閉じる](#終わったら閉じる) と同じで、トンネル → Dashboard の順に閉じる。

```sh
# 0. トンネルを張っている場合は先に閉じる（cloudflared は Ctrl+C / Tailscale は下記）
tailscale serve reset
tailscale serve status   # 期待: 公開中の項目が無いこと
# 1. --host の Dashboard を Ctrl+C で停止
# 2. loopback で起動し直す
bun run dashboard
# 3. http://127.0.0.1:4700 を開いて該当の *-questions.md の [Answer]: 行に記入
# 4. 記入したら Ctrl+C → --host で再開（トンネルも張り直す）
bun run dashboard --host
```

期待される結果: 記入が保存されると、ファイル監視が変更を拾って全参加者へ push される。参加者の画面のヘッダが「ライブ更新中 · 最終更新 &lt;相対時刻&gt;」に変わり、内容が更新される。

**手順2〜3の間、参加者からは Dashboard が見えなくなる**（LAN 参加者は loopback bind により到達不能になり、リモート参加者は手順0でトンネルを閉じたことにより到達不能になる）。**先に「いったん止めます」と口頭で伝える。** 手順0を飛ばした場合、リモート参加者にだけは見え続け、かつ書き込みも通ってしまう。

## リモート参加（トンネル公開）

> ### ⚠️ 手順の前に読むこと
>
> **本ツールは認証機構を一切持たない。したがってトンネル公開は、成果物と監査内容をインターネットへ無認証で開くことと同義である。** URL さえ知っていれば誰でも読める。**トンネルを張る前に、cloudflared Access や Tailscale の ACL でアクセス制御を掛けること。** 認証はツール側では絶対に発生しないので、掛けるのは運用側の責任である。
>
> トンネル公開は「[Dashboard の併用](#dashboard-の併用)」の3段階表のうち最も広い段階にあたる。LAN 公開ですら「同一ネットワークの全端末」だったものが、ここでは「URL を知る全員」になる。

### 必ず `--host` を付ける

トンネルはローカルの `127.0.0.1:4700` に接続してリモートへ中継する。つまり **`--host` を付けなくてもトンネル越しには見える**。しかし `--host` を付けないと read-only モードにならず、**リモートの参加者が回答を書き込めてしまう**。

`--host` は「LAN に bind する」と「全クライアントの書き込みを無効にする」の**両方**を1つのフラグで切り替える（実装上、分離されていない）。read-only を得るために `--host` が必要で、その副作用として LAN にも開く。トンネル公開時はこの副作用を受け入れる。

```sh
bun run dashboard --host
```

### 手順 A: cloudflared

1. **先にアクセス制御を用意する**。Cloudflare Zero Trust の管理画面で Access アプリケーションを作り、許可するメールアドレス / ドメインのポリシーを設定する。これを飛ばすと以降の URL は無認証で公開される
2. 名前付きトンネルを作り、Access を掛けたホスト名に紐付ける:

```sh
cloudflared tunnel login
cloudflared tunnel create aidlc-mob
cloudflared tunnel route dns aidlc-mob aidlc-mob.example.com
cloudflared tunnel run --url http://127.0.0.1:4700 aidlc-mob
```

期待される出力: 最後のコマンドが常駐し、`Registered tunnel connection` を含む行が接続ごとに出る。参加者に渡す URL は `https://aidlc-mob.example.com`（`example.com` はこのガイドのプレースホルダ。自分のドメインに置き換える）。

3. 参加者に URL を渡す前に、**シークレットウィンドウで自分で開いて Access のログイン画面が出ることを確認する**。いきなりダッシュボードが表示されたら Access が掛かっていない。その場合は即座に `Ctrl+C` でトンネルを止め、手順1をやり直す

> **サブコマンドの形は cloudflared のバージョンで変わっている。** `cloudflared tunnel --help` および `cloudflared tunnel route --help` で現物を確認してから使うこと。特に `run` にホスト名と `--url` をどう渡すかは版差がある（設定ファイル `config.yml` の `ingress` で書く形が推奨される版もある）。**手順3の確認（シークレットウィンドウで Access のログイン画面が出ること）だけは、どの版でも省略しない。**

> **クイックトンネル（`cloudflared tunnel --url http://127.0.0.1:4700` だけの形）は使わない。** ランダムな `*.trycloudflare.com` の URL が即座に払い出されるが、**Access を掛けられないため常に無認証**である。手軽さと引き換えに、URL が漏れた時点で全部読まれる。

### 手順 B: Tailscale

Tailscale は tailnet 内に閉じるので、既定でインターネットには出ない。

```sh
tailscale serve 4700
```

期待される出力: `Available within your tailnet:` に続けて `https://<マシン名>.<tailnet名>.ts.net/` 形式の URL が表示される。この URL は **tailnet に参加している端末からしか開けない**。参加者を tailnet に招待し、必要なら ACL（管理画面の Access Controls）で、このマシンへ到達できるユーザーを絞る。

状態確認と停止:

```sh
tailscale serve status   # 何を公開しているかの一覧
tailscale serve reset    # 全部止める
```

> **`tailscale funnel` は使わない。** `funnel` は tailnet の外＝インターネット全体へ公開するサブコマンドである。本ツールに認証が無い以上、`funnel` は無認証の全世界公開になる。
>
> サブコマンドの引数形式は Tailscale のバージョンで変わっている。`tailscale serve --help` で現物を確認してから使うこと。

### 終わったら閉じる

モブが終わったら、**Dashboard より先にトンネルを閉じる**（順序を逆にすると、Dashboard が落ちた後もトンネルの URL が生きたまま残り、次に何かを 4700 で起動した瞬間にそれが公開される）。

```sh
# cloudflared: 起動しているターミナルで Ctrl+C
# Tailscale:
tailscale serve reset
tailscale serve status   # 期待: 公開中の項目が無いこと
# 最後に Dashboard を Ctrl+C
```

## 使えないときの代替

Live Share が組織のポリシー（外部サービスへの接続禁止・アカウント連携禁止）で使えないことがある。その場合の順に、劣化の少ないものから。

### 代替 1: tmux の read-only 共有（同一ホストに SSH できる場合）

ドライバー側:

```sh
tmux -S /tmp/mob-socket new -s mob
chmod 777 /tmp/mob-socket
```

参加者側（同じホストに SSH してから）:

```sh
tmux -S /tmp/mob-socket attach -r
```

`-r` が read-only での attach である。期待される結果: 参加者にはドライバーの画面が流れるが、キー入力は無視される。detach は `Ctrl+B` `D`。

終わったら:

```sh
tmux -S /tmp/mob-socket kill-session -t mob
rm -f /tmp/mob-socket
```

> **Windows の Git Bash には tmux が無い。** この代替は macOS / Linux / WSL のドライバーに限られる。ソケットに `777` を与えるのは同一ホストの全ユーザーに attach を許すことなので、共用サーバーでは使わない（そこは Live Share より弱い）。

### 代替 2: Dashboard 単独運用 + 画面共有

Live Share を諦め、Dashboard の `--host` だけを使う。参加者は自分のブラウザでワークフローの現在地・成果物・監査を自由に見られる（ここが本ガイドの目的の大半）。コードとターミナルは Meet / Zoom / Teams の画面共有で見せる。

```sh
bun run dashboard --host
```

失うもの: 参加者が自分の VS Code でコードを開いて追えないこと。得るもの: 外部の共同編集サービスへ接続しないこと。**組織ポリシーが理由なら、この代替が第一候補になることが多い。**

### 代替 3: 画面共有のみ（最終手段）

Dashboard も公開できない（ネットワーク分離など）場合、ドライバーが画面共有で Dashboard を見せる。Now strip（現在地の1行）は小さいので、共有前にブラウザを `Ctrl`+`+` で拡大しておく。参加者が自分のペースで成果物を読めなくなるため、質問のたびにドライバーがスクロールする必要がある。

## トラブルシュート

### 参加者が URL を開けない

| 確認 | コマンド | 判定 |
|------|---------|------|
| ドライバー機で開けるか | `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4700` | `200` ならサーバは動いている |
| `--host` が効いているか | 起動出力に `参加者に共有する URL:` があるか | 無ければ `--host` を付け忘れている |
| 参加者機から届くか | 参加者機で `curl -sS -o /dev/null -w "%{http_code}\n" http://192.0.2.10:4700` | タイムアウト / `Connection refused` ならネットワーク側の問題 |

届かない場合の原因は、ほぼ次のどれか。

- **同じネットワークにいない** — ゲスト Wi-Fi と社内 Wi-Fi、有線と無線が分かれていることがある。参加者と自分の IPv4 の先頭3オクテットを見比べる（Windows: `ipconfig` / macOS: `ifconfig` または `ip addr`）
- **ファイアウォールが受信を止めている** — Windows では初回起動時に「Windows セキュリティの重要な警告」が出る。**プライベートネットワークのみ**許可する。パブリックは許可しない。macOS では「システム設定 → ネットワーク → ファイアウォール」で受信接続の許可を確認する
- **複数の NIC がある** — VPN や Docker の仮想 NIC のアドレスが一覧に混ざる。参加者と同じネットワークのアドレスを渡す

### 「そのポートは使用中です」で起動しない

```
aidlc-dashboard: そのポートは使用中です。--port で別のポートを指定してください。
```

別のポートで起動する（参加者に渡す URL のポート番号も変わる点に注意）:

```sh
bun run dashboard --host --port 4701
```

### 「`packages/dashboard/dist/` が見つかりません」と出る

```
packages/dashboard/dist/ が見つかりません。先に dashboard のビルドを実行してください。今回は API のみのモードで起動します（UI は配信されません）。
```

この状態でもサーバは起動するが、**画面は出ない**（API だけ）。ビルドしてから起動し直す:

```sh
bun run build:dashboard
```

期待される出力: 最終行が `✓ built in <秒数>s`。なお `bun run dashboard` はビルドを含むので、通常この状態にはならない。

### 画面が更新されない

ヘッダの LiveStatus の文言で切り分ける（`packages/dashboard/src/components/LiveStatus.tsx`）。

| 表示 | 意味 | 対処 |
|------|------|------|
| 接続中… | 初回の WebSocket 接続がまだ | 数秒待つ。続くならリロード |
| ライブ更新中 · 最終更新 &lt;相対時刻&gt; | 正常。その時刻に変更を受信した | 対処不要。「最終更新」が進まないなら、そもそもファイルが変わっていない可能性 |
| ライブ更新中 | 接続はできているが、まだ変更を1件も受信していない | 対処不要 |
| 切断・再接続中… | WebSocket が切れて再接続中 | ドライバー機で Dashboard が動いているか確認。Wi-Fi の切り替えでも起きる |
| 更新が止まっています（&lt;理由&gt;） | 監視は生きているが、レコードを読めなくなった | 理由（`workflow-unreadable` / `matrix-unreadable` / `audit-unreadable` / `no-record` など）を見る。多くはドライバー機側でファイルが移動・削除された、またはアクティブインテントが解決できない状態 |

**画面は正しいのに古い、という状態は起きない設計になっている**（読めなくなったら黙るのではなく「更新が止まっています」と表示する）。したがって上表のどれでもないのに内容が古い場合は、見ているファイル自体が更新されていないことを疑う。

### 回答を保存できない（403）

`--host` 中は仕様どおりの拒否である（`{"error":"read-only-mode"}`）。[モブ中の回答記入](#モブ中の回答記入) の手順に従う。

`--host` を付けていないのに拒否される場合は、別の理由である:

| 応答 | 意味 |
|------|------|
| `{"error":"not-a-questions-file"}` | 書き込み先が `*-questions.md` ではない。回答行を持つのはこの命名のファイルだけ |
| `{"error":"outside-record"}` | 対象パスがアクティブなレコードの外を指している |
| `{"error":"not-an-answer-line"}` | 指定行が `[Answer]:` で始まっていない。回答行以外は書き換えられない |

いずれもツールの安全境界そのもので、設定で緩める手段は無い。

### NIC のアドレス一覧が出ない / 途中で URL が繋がらなくなった

- 一覧が出ない場合は `EXPOSURE_NO_ADDRESS_HINT` の案内どおり、`ipconfig`（Windows）/ `ifconfig`（macOS）で自機の IPv4 を確認して手で渡す。**公開自体は成立している**
- アドレス一覧は**起動時に1回だけ**列挙される。モブ中に Wi-Fi を切り替えるなどして IP が変わると、配った URL は古くなる。Dashboard を起動し直せば新しい一覧が出る
