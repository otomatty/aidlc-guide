# インストールとライフサイクル

ネイティブ版は `aidlc` コマンドと 1 つ以上のハーネスランタイムをインストールします。`aidlc config` は、そのローカルランタイムからプロジェクトを初期設定または更新します。このコマンドと config に Bun や Node.js は不要です。GitHub CLI（`gh`）は任意です。対応する版なら署名付きアテステーション検証が足されます。ない、または古い版でもインストールは止まりません。

手動コピーでは Bun が必要です。`aidlc-copy-runtime-X.Y.Z.tar.gz` から、選んだハーネスの `runtime/<harness>/` ルート全体をコピーしてください。ネイティブの `aidlc` 実行ファイルは不要です。ハーネスのディレクトリだけでなく、`aidlc/` とプロジェクトルートの統合ファイルも含めます。詳しくは[コピー経路](#コピー経路)を参照してください。

## インストール

リリース資産の対象は次です。

- macOS x64 と arm64
- Linux x64 と arm64。glibc と musl のビルドあり
- Windows x64

インストールは利用するユーザーで実行します。Unix インストーラは root を拒み、Windows インストーラは昇格した Administrator セッションを拒みます。ネイティブ導入はユーザー単位で、`sudo` は不要です。

Alpine Linux の musl 資産は、Bun 自身のランタイム契約に従います。Bun の musl ビルドは Node.js と同じく、システムの `libgcc` と `libstdc++` パッケージが要ります。完全に静的リンクされた Bun musl のコンパイルターゲットは、上流で追跡中の機能で、まだ利用できません。インストーラやバイナリを実行する前に、前提を入れてください。

```sh
apk add libgcc libstdc++
```

この前提条件は Alpine の x64 と arm64 の両方に適用されます。システムパッケージの導入には管理者権限が要ることがありますが、AI-DLC 本体の導入は対象ユーザーのままです。インストーラは対応するローダ失敗を検出し、上のコマンドを出します。`apk` を走らせたり、システムパッケージを入れたりはしません。上流の追跡は `oven-sh/bun#15829` と `oven-sh/bun#29681` です。

インストーラは `claude`、`kiro`、`kiro-ide`、`codex`、`opencode` をまとめて入れます。

```bash
tmp="$(mktemp -d)"
curl -fsSL \
  https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh \
  -o "$tmp/install.sh"
sh "$tmp/install.sh"
rm -rf "$tmp"
```

### macOS と Linux

```bash
tmp="$(mktemp -d)"
curl -fsSL \
  https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh \
  -o "$tmp/install.sh"
sh "$tmp/install.sh"
rm -rf "$tmp"
export PATH="$HOME/.local/bin:$PATH"
```

オンライン実行には `curl` か `wget` が要ります。どの実行にも `sha256sum` か `shasum` が要ります。GitHub CLI は任意で、リリースが要求するアテステーションフラグに対応しているときだけ使います。
版は `${XDG_DATA_HOME:-$HOME/.local/share}/aidlc/versions/` の下に入れ、既定では `$HOME/.local/bin/aidlc` をアクティブな版へ結びます。

インストーラは、`--profile <absolute-path-under-$HOME>` を明示しない限り、シェルの起動ファイルを編集しません。そのオプションは `BEGIN AI-DLC:PATH` ブロックを 1 つ、トランザクションで書くか更新し、ファイルの残りは残します。プロファイルは AI-DLC の導入ルートやコマンドルートの中には置けません。既存マーカーは一意で、行全体が正確に一致し、begin が end より前に来る必要があります。壊れたマーカー配置は、プロファイルを変えずに拒みます。

### Windows PowerShell

```powershell
$download = Join-Path $env:TEMP "aidlc-install-$PID"
New-Item -ItemType Directory -Force $download | Out-Null
$installer = Join-Path $download install.ps1
Invoke-WebRequest `
  -Uri https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.ps1 `
  -OutFile $installer
& $installer
Remove-Item -Recurse -Force $download
```

Windows は版を `%LOCALAPPDATA%\aidlc\versions\` の下に入れ、安定した `%LOCALAPPDATA%\aidlc\bin\aidlc.cmd` シムを残します。インストーラはその bin ディレクトリを現在の PowerShell プロセスへ足し、新しいセッションで必要なコマンドを出します。PowerShell プロファイルは編集しません。

PowerShell インストーラのパラメータはネイティブ名です。例: `-Version`、`-From`、`-Offline`、
`-ReleaseBaseUrl`、`-CaBundle`、`-Yes`、`-Quiet`、`-Json`、`-NoColor`。

### 自動化

インストーラーはハーネスの選択を求めません。対話・非対話とも、同じバイナリと全ハーネスランタイムをインストールします。

### インストーラのオプション

| Unix | PowerShell | 意味 |
|------|------------|---------|
| `--version <version>` | `-Version <version>` | 最新ではなく、正確なリリース 1 つを入れる。安定の `x.y.z` か、プレビューの `x.y.z-preview.YYYYMMDD.N` id |
| `--from <dir>` | `-From <dir>` | 階層を持たないリリースファイル一式をローカルから読み、オフラインモードを含意する |
| `--offline` | `-Offline` | ネットワークを禁じる。`--from` / `-From` が要る |
| `--release-base-url <url>` | `-ReleaseBaseUrl <url>` | 互換のあるリリースミラーを使う |
| `--ca-bundle <absolute-path>` | `-CaBundle <absolute-path>` | 独自の CA バンドルを使う |
| `--profile <absolute-path>` | 未提供 | Unix の PATH ブロックをトランザクションで足す |
| `--yes` | `-Yes` | 自動化モード。完全性検査は迂回しない |
| `--quiet` | `-Quiet` | 進捗を抑え、結果を 1 行出す |
| `--json` | `-Json` | 進捗を抑え、スキーマ版付き JSON 結果を 1 つ出す |
| `--no-color` | `-NoColor` | 色出力を止める |
| `--help` | 未公開 | Unix インストーラの使い方を出す |

`AIDLC_RELEASE_BASE_URL` と `AIDLC_CA_BUNDLE` はインストーラの既定です。明示オプションが勝ちます。`AIDLC_RELEASE_REPOSITORY` は、既定ダウンロードに使う GitHub リポジトリと、出自検証が信頼するリポジトリの両方を選びます。既定は `awslabs/aidlc-workflows` です。
`AIDLC_RELEASE_WORKFLOW` は信頼する署名者ワークフローを上書きします。既定では、インストーラは安定版に
`<AIDLC_RELEASE_REPOSITORY>/.github/workflows/release.yml` を選び、プレビュー版には
`<AIDLC_RELEASE_REPOSITORY>/.github/workflows/preview-release.yml` を選びます。ワークフローのパスが違うフォークやミラーでは、そのリリースベース URL と一緒に上書きを明示してください。ダウンロード URL だけ変えても、出自の信頼根は変わりません。`AIDLC_GH_BIN` は、両インストーラが使う GitHub CLI 実行ファイルを明示します。その実行ファイルがないか、`--signer-workflow`、`--source-ref`、`--source-digest` がないときは、出自検証は飛ばし、チェックサム検証は必須のままです。

フォークのリリースに GitHub App も追加リポジトリも要りません。タグワークフローは、短命の `GITHUB_TOKEN` で同じリポジトリへ公開します。最後のジョブは `release` 環境を使い、公開の前にレビュアー承認を要求できます。

`AIDLC_INSTALL_ROOT` と `AIDLC_BIN_DIR` は、マシンとコマンドの場所を上書きします。Unix ではそれらのパスは絶対でなければなりません。PowerShell インストーラは `AIDLC_OFFLINE=1` も守ります。Unix インストーラは明示の `--offline` か `--from` が要ります。

版付きリリースに含まれるインストーラーは、プレビューを含め、そのリリース自身を既定で導入します。`latest/download` から取得した場合は最新の安定版です。明示的な `--version` / `-Version` は同梱版に優先し、`--from` / `-From` はローカルのマニフェストから版を読みます。

### リリース認証

インストーラは次をします。

1. `version.json`、`checksums.txt`、`aidlc-release.intoto.jsonl` をダウンロードするか読む。
2. 対応する GitHub CLI があるとき、`checksums.txt` のアテステーションをリポジトリと署名者ワークフローに対して検証する。
3. `version.json` の SHA-256 を検証し、版 id とソース識別情報を読み、明示した版の食い違いを、リリースバイナリをダウンロードまたは実行する前に拒む。
4. 安定リリースでは `sourceRef` が `refs/tags/v<version>` と等しいこと、プレビューでは `refs/heads/main` と等しいことを要求する。出自検証が使えるときは、その ref と認証済み `sourceDigest` に対してアテステーションを再検証する。
5. 選んだバイナリとハーネスアーカイブを、SHA-256 と宣言バイト長で検証する。
6. 検証済みバイナリに、リリースの検証とトランザクション導入を任せる。

ブートストラップスクリプトそのものを実行前に認証するときは、現在の GitHub CLI を使います。

```bash
tmp="$(mktemp -d)"
tag="$(gh release view --repo awslabs/aidlc-workflows --json tagName --jq .tagName)"
gh release download "$tag" --repo awslabs/aidlc-workflows --dir "$tmp" \
  --pattern install.sh --pattern aidlc-release.intoto.jsonl
gh attestation verify "$tmp/install.sh" \
  --bundle "$tmp/aidlc-release.intoto.jsonl" \
  --repo awslabs/aidlc-workflows \
  --signer-workflow awslabs/aidlc-workflows/.github/workflows/release.yml \
  --source-ref "refs/tags/$tag"
sh "$tmp/install.sh" --version "${tag#v}"
rm -rf "$tmp"
```

メタデータは 1 MiB まで、個々のリリース資産は 1 GiB までです。資産名にパスは入れられません。アーカイブ展開はリンク、特殊ファイル、パストラバーサル、絶対パス、重複エントリ、過大な展開を拒みます。

リリースワークフローは候補を一度組み立てます。Staging と Unix/Windows のライフサイクルジョブは `checksums.txt` を検証し、それらのバイトを、署名権限なしで試験します。本物のアテステーションはそれらの試験のあと作られるので、ジョブ局所の検証フィクスチャを足します。フィクスチャはアップロードしません。
`publish` は候補を再検証し、アテステーションし、`aidlc-release.intoto.jsonl` を書き出し、ファイル一覧全体を検証し、ワークフロー成果物を 1 つアップロードします。`release` はタグとチェックサムを再検査し、このリポジトリに `GITHUB_TOKEN` で GitHub Release を作り、ローカルとリモートのリリースファイル一覧を比べます。バンドルは `version.json` と `checksums.txt` の外に残ります。それらのファイルは入れられる成果物を覆い、バンドルは独立した Sigstore の信頼経路に属します。
オンライン輸送は TLS を強制し、どの導入も SHA-256 を強制します。対応する GitHub CLI の版は、署名付き出自検証を足します。OS のコード署名と公証はリリースに入りません。[Supply-Chain Security](../reference/19-supply-chain-security.md) を見てください。

インストーラは、既存の混在所有コマンドを拒みます。既存の Homebrew や Nix のコマンドにも、置き換えずに譲ります。このプロジェクトはそれらのパッケージマネージャ経路をまだ出荷していません。所有しているマネージャを使うか、空の `AIDLC_BIN_DIR` を明示してください。

## プロジェクトの設定と更新

推奨既定値は現在のモデルプロバイダーを維持します。カスタマイズはハーネス、provider、effort、plugins、MCP、モデルプリセットの保存層を順に選び、回答一覧の最終確認までは書き込みません。複数ハーネスがある場合はpreviewとrefreshにも `--harness <name>` を付けます。

ハーネスを開く前に config を実行します。

```bash
cd your-project
aidlc config --dry-run --json
aidlc config
aidlc doctor
```

`aidlc config` はローカルだけで、トランザクションとして動作します。選んだハーネスのディレクトリツリー、`aidlc/` ワークスペースシェル、ルート統合、投影スタンプ、所有の基準を作ります。ワークフローのインテントは作りません。

初期設定または更新が成功したあと、config は負荷の小さい導入後の確認を実行します。見るのは非対話フックの PATH、ホストの信頼ファイル、記録したプロバイダ操作だけです。ハーネス CLI を起動したり、プロバイダへ連絡したりはしません。トランザクションはそれでも終了 0 です。非 TTY の人向け出力は、残っている項目すべてと、正確な `aidlc config runtime`、`aidlc config trust`、または `aidlc config providers --check` の続きを指名します。JSON には `data.outstandingActions` が入ります。quiet 出力はきれいなときは 1 行のまま、続きが要るときは outstanding-actions の行を 1 行足します。

対話 TTY での素の初回は、質問ではなく検出から始まります。`PATH` 上の導入済みハーネス CLI、プロジェクト状態、ローカルの AWS クレデンシャルとリージョン、非対話フックのランタイムです。検出したハーネスが 1 つのときは、ウィザードがそれを指名し、3 択を出します。推奨既定、6 ステップのカスタマイズ、何も書かずに終了です。複数検出なら先に番号付きハーネスピッカーです。検出ゼロなら、既定なしの完全ピッカーです。

推奨既定は、選択肢の行にバンドルを書きます。カスタマイズは Harness、Model provider、Model effort preset、Plugins、MCP servers、settings layer を歩きます。番号付きプロンプトにはどれも括弧付き既定があり、無効入力はその場で聞き直し、各答えはエコーします。答え合わせの表は、Enter で適用、ステップ番号で編集です。その最終ゲートの前にファイルは書きません。適用のあと、実行内容を示す結果メッセージがプロジェクトファイルと設定層を指名し、本当に止まる操作が続き、それからウィザードが正確なハーネス起動と最初のワークフローコマンドを出します。

Model effort preset のステップには `unchanged` もあります。選ぶと新たなプリセットを記録せず、現在の方針、または出荷時の既定を維持します。推奨は `balanced` です。

既存プロジェクトの再実行は、Harnesses、Models、Runtime、Flags、Project、Providers、Trust、Workspace の 8 行を `[ok]` / `[needs]` で示します。既定が yes の確認から Models、Runtime、Providers、Trust の未完了項目を順に扱います。Workspace は報告だけです。`aidlc/spaces/default/memory/` がなければ `aidlc config --harness <name>` による再構築を案内し、不完全な間はセクションを修復する対話へ進みません。Bun のコピー導入では、コピー元の `runtime/<name>/` またはソース checkout の `dist/<name>/` を `--from` に指定します。ネイティブ版では不要です。締めの一覧は再構築コマンドを先に示します。`aidlc/` 自体がない場合は Trust の `workspace-root-missing` を Workspace にまとめます。Kiro の Providers は記録がなくても `[ok]` です。Runtime は必要な操作を先に示し、詳細は `aidlc config runtime --show` で確認します。セクション指定、非 TTY、`--dry-run`、`--json`、`--quiet` では対話ウィザードを開きません。

### Config のオプション

| オプション | 意味 |
|--------|---------|
| `--project-dir <path>` | カレントディレクトリではなく、このプロジェクトを対象にする |
| `--harness <name>` | 導入済みハーネスランタイムを選ぶ |
| `--from <dir-or-tgz>` | 導入済みランタイムではなく、ローカルの投影ディレクトリまたは投影アーカイブを使う |
| `--mcp defaults\|none` | Claude の任意の出荷 MCP エントリを足すか省く |
| `--dry-run` | 対象ディレクトリを作らず、バイトも変えずに、完全な計画を計算する |
| `--plan-token <token>` | JSON の dry run から承認した正確な計画だけを適用する |
| `--force` | その方針が許す範囲で、ローカル変更したフレームワーク所有ファイルと管理ブロックを置き換える |
| `--yes` | 認識できない対象ディレクトリやセクション変更を確認する。MCP 同意の含意も、セクションの答え選びもしない |
| `--json` | 件数、操作、`data.planToken` 付きの結果オブジェクトを 1 つ出す |
| `--quiet` | 要約または対処の行を 1 行出す |
| `--no-color` | 色出力を止める |

### モデル方針

`aidlc config models` は、選択した設定層にモデル方針を記録します。`--project` ならプロジェクトの `aidlc.settings.json` です。通常の config の計画・確認・更新ガード・トランザクションを通して適用し、モデルプロバイダーへは接続しません。

公開グループは次です。

| グループ | エージェント | 出荷ティア |
|-------|--------|--------------|
| Deciding | 設計、実装、プロダクト、セキュリティ、品質のエージェント 9 | judgment |
| Reviewing | product lead と architecture reviewer | balanced |
| Writing up | delivery、pipeline and deploy、operations | templated |

方針はエージェントごとに、この順で解決します。

1. エージェント単位の例外
2. グループのダイヤル。直接、またはプリセット経由
3. 出荷ティアの既定
4. セッション継承

ピンは双方向に効きます。ピンしたエージェントは、あとでセッションがより大きなモデルへ動いてもピンのままです。フレームワークがエージェントをセッションより上へ独断で上げることはありません。Judgment と Writing up は既定で継承します。一段下げるのは、測った balanced レビュアーの基準線だけです。導入単位の Writing up ダウングレードは `aidlc config models` で記録します。

```bash
aidlc config models --show
aidlc config models --reviewing-effort xhigh --project --yes
aidlc config models --agent architect --effort xhigh --model provider/raw-id --project --yes
aidlc config models --check
aidlc config models --reset --project --yes
```

`--show --json` は、全エージェントの実効モデル、effort、出自を出します。`--check` は CI で設定と生成結果を照合し、記録した方針がハーネスの面に完全に反映されていなければ非ゼロで終了します。

モデルとフラグの方針は、葉ごとにこの階層で解決します。

1. ティアとプリセット表の出荷既定
2. マシン `${AIDLC_INSTALL_ROOT:-~/.local/share/aidlc}/aidlc.settings.json`
3. プロジェクト `aidlc.settings.json`
4. 個人 `aidlc.settings.local.json`
5. 環境変数

プロジェクトファイルはコミットするチーム方針です。ローカルファイルは個人用で、config コマンドが作るときに `.gitignore` へ足します。変更には `--project`、`--local`、`--global` のちょうど 1 つが要ります。対話ウィザードは層を聞き、リポジトリの中ではプロジェクト方針を勧めます。認識したプロジェクトの外ではマシン層だけが有効なので、`--global` を推論します。`--show` は各実効値に、勝った出所のラベルを付けます。

3 ファイルとも同じ厳格スキーマです。未知のキーは拒否し、`offline` や `release-base-url` などの更新／リリースキーはマシン専用です。エディタは生成された `<harness>/tools/data/aidlc-settings.schema.json` を参照できます。既定の settings ファイルは書きません。

出荷する不変プリセットは effort だけを指定します。

| プリセット | Deciding | Reviewing | Writing up |
| --- | --- | --- | --- |
| `thorough` | セッション継承 | xhigh | セッション継承 |
| `balanced` | medium | medium | medium |
| `minimal` | medium | medium | low |

プリセットはモデル ID を指定しません。方針を記録していない場合は、Deciding と Writing up はセッションを継承し、Reviewing は出荷時の step-down を使います。初回ウィザードで balanced を選ぶと 3 グループの medium を記録します。

既存のプリセット記録は更新後の定義で再生成します。ワークフローの実行間に `aidlc config --yes`、または `aidlc config models --preset <name> --project --yes` を実行してください。Doctor と models の `--check` は読み取り専用で、設定を書き換えません。方針が未記録の環境には影響しません。

プリセットまたは既存プロファイルから、プロジェクトプロファイルを導きます。

```bash
aidlc config models --from thorough --reviewing-effort medium \
  --save-as my-profile --project --yes
```

プリセットとプロファイルが持つのはグループ effort だけです。生のモデル ID は、エージェント単位の例外にだけ許されます。`--yes` は変更を確認しますが、方針は決して選びません。決定的なフラグがないとき、TTY はモデル方針ウィザードを開き、非 TTY 実行は使い方案内で失敗します。

ハーネスが受け取るのは、読める設定だけです。Codex は `max` effort を `xhigh` へ下げます。opencode は `xhigh` を `high` へ下げます。Kiro CLI はグループ effort ダイヤルを表現できませんが、エージェント単位のモデル例外は `chat.modelDefaults` 経由で effort を運べます。Kiro IDE、Cursor、GitHub Copilot はエージェントのモデルや effort を持ち運び可能にピンできないので、コマンドは方針を記録し、効かないキーを書く代わりに未対応フィールドを報告します。

モデル方針はエージェント単位です。ステージファイルにモデルや effort のキーは載せず、ステージの重大度は引き続きスコープが持ちます。

### セッション内の別名

`/aidlc --config [section]` は、これらの同じ config セクションの会話別名です。コンダクターは聞く前に現在の JSON 状態を読み、変えたい変更だけ集め、受け入れたセクションごとに正確な `aidlc config <section> <explicit value flags> --yes` コマンド 1 本で着地します。セクションを変えなければコマンドは実行されません。着地または辞退のあと、別名は止まります。ワークフローの仕事を進めたり再開したりはしません。

### ランタイム診断

`aidlc config runtime` は、プロジェクトフックが実際に使う環境を検査します。Linuxではgetconf PATHに加えて/etc/environmentのPATH、/etc/login.defsのENV_PATH、environment.dを読みます。macOSではgetconf PATHと/etc/paths、/etc/paths.dから非対話のPATHを導きます。Windows では、シェルプロファイルを読まずに User と Machine の PATH を読みます。それから、導入済みフックバイトが要求するコマンド（コピー投影なら `bun`、ネイティブ投影なら `aidlc`）を解決し、選んだハーネス CLI を検査します。

```bash
aidlc config runtime --show
aidlc config runtime --check
aidlc config runtime --record-paths --yes
aidlc config runtime --reset --yes
```

`--record-paths` は解決した答えを `harness.json` に記録します。フックコマンドは書き換えません。ホストの権限規則と Codex のフック信頼は、裸の `bun` または `aidlc` コマンド接頭辞に結ぶので、絶対パスへ置き換えると既存の信頼契約が無効になります。コマンドが対話専用、またはないときは、セクションはプラットフォーム固有の PATH 指示を出します。

ハーネス CLI 検査は、対応するハーネスに `claude`、`kiro-cli`、`codex >= 0.145.0`、または `opencode` を要求します。Copilot CLI と Cursor の `agent` CLI は advisory です。それらの導入は VS Code や IDE だけが駆動することがあるからです。Kiro IDE に必須の別 CLI はありません。

### プロバイダ診断

`aidlc config providers` はプロジェクトのプロバイダー回答を保存します。既定は現在のハーネス設定を使う **keep current**、2番目がAmazon Bedrockです。AWS認証が検出されても既定は変わりません。Kiro CLI/IDEはモデル利用が製品に含まれるため質問しません。`other` は手動設定した別プロバイダー用で、確認済みとするまで保留事項を表示します。

```bash
aidlc config providers --provider current --yes
aidlc config providers --provider amazon-bedrock --region us-east-1 --profile default --yes
aidlc config providers --provider other --acknowledge --yes
aidlc config providers --show
aidlc config providers --check
aidlc config providers --mark-done <id> --yes
aidlc config providers --reset --yes
```

`--region`、`--profile`、`--opencode-default` は記録済みまたは選択したプロバイダーがamazon-bedrockの場合だけ使います。認証の検出はオフラインで、AWS環境変数、標準の認証設定、ローカルSSOキャッシュを確認します。AWSへ接続して資格情報を検証するものではありません。

| ハーネス | Bedrockを選んだ場合 |
|---|---|
| Claude Code | Bedrockを有効化し、settingsへAWS_REGIONと任意のAWS_PROFILEを保存。AWS MCP URLとregionも合わせる |
| Codex CLI | 選択を保存し、ユーザーの `~/.codex/config.toml` にプロバイダー・認証・モデルを設定するよう案内 |
| Kiro CLI / IDE | 回答不要 |
| opencode | `provider.amazon-bedrock.options.region/profile` の保存を提案。`--opencode-default yes\|no` で選択 |
| Cursor / Copilot | 製品側のBYOK／provider設定を保留事項として案内。AI-DLCからは実行しない |

保留事項はshowで確認し、完了した項目をmark-doneで記録します。残っていればcheckは非ゼロです。Codexは実効ユーザー設定と代替認証経路をオフラインで完全に判定できないため、完了後も自己申告である警告を伴う成功を返し、検証済みとは表示しません。

currentは、AI-DLCの旧既定値または前回記録に由来すると確認できるBedrock設定だけをClaude/Codex/opencodeのプロジェクトファイルから除去します。変更済みのClaudeモデル別名やCodexの旧Bedrockブロックは保持します。後者がまだBedrockを指定していればcheckは警告します。otherはacknowledgeまで手動設定を保留として扱います。resetも由来を証明できる値だけを除去し、ユーザー独自値は保持します。

再び同じ回答を選んだ場合、Bedrockのregion/profileやotherの保留事項を保持します。再回答せずmark-doneで作業完了を記録できます。

### 信頼診断

`aidlc config trust` はホストネイティブの信頼を読み、検証します。信頼シード、権限規則、IDE 設定は再生成しません。

```bash
aidlc config trust --show
aidlc config trust --check
aidlc config trust --acknowledge --yes
aidlc config trust --reset --yes
```

Codex では、検査は `$CODEX_HOME/config.toml` に、プロジェクト固有の信頼シードエントリ一式があることを要求します。対応する直し方は 2 つです。TUI の `Trust all and continue` を 1 回通すか、`<PROJECT_DIR>` を置き換えて完全なシードをマージするかです。それまで Codex フックは 1 本も発火しません。
`--dangerously-bypass-hook-trust` は未信頼フックを発火させず、2 つ目のシード集合を追記すると無効な TOML になります。

Kiro IDE では、検査は `.vscode/settings.json` の `kiroAgent.trustedCommands` に `aidlc engine *` が入っていることを検証します。新しい信頼面は作りません。`--show` は選んだハーネスの信頼ファイルと許可リストファイルを列挙します。

信頼検査は、コピー導入がよく落とすプロジェクトの兄弟も検証します。どのハーネスでも `aidlc/`、Codex の `.agents/`、opencode と Copilot の `.aidlc/` エンジンです。

doctor は、導入した命令ファイルを config の所有基準に対しても分類します。無傷の管理ブロックは `block present, user content preserved` と報告します。ブロックやファイルがなければ `aidlc config` の実行を案内します。手で直した管理ブロック、またはフレームワーク所有のファイル全体は衝突です。ハーネスの木が複数あるとき、行は起動したハーネスに従います。

### プロジェクトフラグ

`aidlc config flags` は、既定スコープ、スウォームモード、フックデバッグ、センサータイムアウト、明示のガード迂回や手続き停止スイッチのプロジェクト設定を記録します。

```bash
aidlc config flags --default-scope <installed-scope> \
  --swarm on --hook-debug off --sensor-timeout-ms 90000 --project --yes
aidlc config flags --bypass AIDLC_SKIP_ARTIFACT_GUARD --local --yes
aidlc config flags --show
aidlc config flags --check
aidlc config flags --reset --project --yes
```

本物の環境変数がいつも勝ちます。既存のツールとフックは、まず環境を読み、変数がないときにローカル、プロジェクト、マシンの設定を解決します。これで CI や一時的なシェルの export でも設定できます。

既定スコープ名は、導入済みスコープファイルから読みます。セクションは組み込みスコープ名で分岐しないので、スコープの改名とプラグインスコープはデータのままです。Claude Code では、config は段階的な `AWS_AIDLC_DEFAULT_SCOPE` 値を `.claude/settings.json` にも書き直します。そうしないと、出荷のセッション環境が、より優先度の低い記録を覆います。

記録できる迂回集合は、文書化した復旧スイッチと手続き停止スイッチを含みます。

- `AIDLC_SKIP_ARTIFACT_GUARD`
- `AIDLC_SKIP_HUMAN_PRESENCE_GUARD`
- `AIDLC_SKIP_REVISION_BACKSTOP`
- `AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD`
- `AIDLC_DISABLE_ENSEMBLE_EVIDENCE`
- `AIDLC_DISABLE_PLAN_APPROVAL_GUARD`
- `AIDLC_DISABLE_REVIEWER_SCOPE_HOOK`
- `AIDLC_DISABLE_REVIEW_FREEZE_HOOK`
- `AIDLC_DISABLE_USAGE_TRACKING`
- `AIDLC_DISABLE_SENSORS`: センサー実行とゲート検査を停止
- `AIDLC_DISABLE_LEARNINGS`: ステージの学びの手続きを停止
- `AIDLC_DISABLE_SUMMARY_CONFIRMATION`: 個別のサマリー確認を停止。ステージ承認は維持

ウィザードは迂回を出しません。明示の `--bypass <name>` が要ります。`--show` は有効な迂回すべてと、ガードが弱まる帰結を出します。

### プロジェクトの選択

`aidlc config project` は、導入したプラグイン選択、MCP 同意、シェル補完の答えを記録します。

```bash
aidlc config project --plugins aidlc,test-pro --mcp none \
  --completions zsh --yes
aidlc config project --show --json
aidlc config project --check
aidlc config project --reset --yes
```

プラグイン名は、導入済みグラフ、スコープ、プラグインサイドカーから発見します。ハードコードしません。選択は引き続き `harness.json` の既存トップレベル `plugins` 配列を使うので、グラフとランナーの再生成は、プラグイン合成と同じ選択連携箇所を使います。プロジェクト変更は更新の安全ガードを通り、ワークフローが進行中のあいだは拒みます。

MCP 同意は `defaults` か `none` のままです。以前の同意がない非対話のプロジェクト変更は `none` を記録します。`--yes` は変更を確認するだけで、MCP エントリは決して足しません。

Claude Code では `.mcp.json` が同意管理の面です。`--check` は `defaults` と `none` の両方を検証し、その後の引数なしの config による更新は答えを再適用します。Kiro CLI はいつも `.kiro/settings/mcp.json` を出荷します。`defaults` はそのファイルと出荷サーバ 5 つで満たし、`none` は指示だけの好みで、フレームワーク所有ファイルは消しません。現在の Codex、opencode、Copilot、Kiro IDE、Cursor 配布は MCP 面を出荷しないので、記録した設定は情報であり、`--check` を継続して失敗状態にはしません。`--show` は MCP ファイルがあるときは実際のファイルを指名します。

補完は指示だけで、マシン上のファイルは書きません。ネイティブ導入は次のようなコマンドを出します。

```bash
eval "$(aidlc system completions bash)"
```

コピー経路の導入は、対応する Bun 呼び出しを出します。例:

```bash
eval "$(bun .claude/tools/aidlc.ts system completions bash)"
```

Fish は `... completions fish | source`、PowerShell は `... completions powershell | Out-String | Invoke-Expression` です。

既存プロジェクトのスタンプは、更新のハーネスを固定します。新規の対話プロジェクトはハーネスを聞きます。非対話実行は `--harness` が要ります。`.aidlc-version` があるとき、config はその正確な版のソースと、一致するプロジェクトハーネスを要求します。

config が認識するのは、`.git`、`package.json`、`Cargo.toml`、`go.mod`、`pyproject.toml` を含むディレクトリです。それらの形の外では、対話モードは確認を聞き、非対話モードは `--project-dir` が要ります。

Claude の任意 MCP 統合は、TTY がないときの既定が `none` です。以前の選択がないとき、人の TTY は聞かれます。`--yes` と `--json` は MCP 同意を与えません。確実な自動化は `--project-dir`、`--harness`、`--mcp defaults|none` を明示します。JSON は出力を制御しますが、それだけでは TTY プロンプトを止めません。

正確なスクリプト承認には:

```bash
token=$(
  aidlc config --project-dir "$PWD" --harness claude --mcp none \
    --dry-run --json | jq -r .data.planToken
)
aidlc config --project-dir "$PWD" --harness claude --mcp none \
  --plan-token "$token" --json
```

両方の呼び出しで、ソースと振る舞いのオプションを同じにしてください。下見のあとソースバイト、オプション、またはプロジェクト状態が変わるとトークンが変わり、適用は処理を拒否します。

### 更新の安全

更新はプロジェクトのエンジンとグラフファイルを変えるので、いずれかのスペースに未完了のワークフローがある間は、config が更新を拒否します。パーク済みのワークフローも生きていると数えます。エラーが指名したワークフローをすべて完了してから、config を再実行してください。

検査は計画中に一度実行され、コミット直前にワークスペース監査ロックの下でもう一度実行されます。`--force`、`--yes`、`--plan-token` は迂回しません。`aidlc update` と `aidlc use` は、マシン状態だけ変えるので、ワークフロー中でも安全です。

更新が残すもの:

- 出荷投影にない、すべてのワークスペース記録、監査シャード、ナレッジ、そのほかのプロジェクトファイル
- 既存の `aidlc/active-space` とスペースメモリファイル。これらはプロジェクト所有の種
- 可変の `tools/data/harness.json` にある識別情報以外の兄弟キーすべて。プラグイン選択と将来の方針記録を含む
- プラグイン合成ファイルと記録したステージ寄与。そのあとグラフ、ランナー、スコープ、コンパイル済み表の面を再生成する
- 上流が書いたオーケストレータ散文。コンパイル済みステージとスコープ領域は、残したプロジェクト合成から組み直す

ローカル変更したフレームワーク所有ファイルは、以前の基準に対して衝突します。`--force` はそれらのファイルを更新候補で置き換えます。手で書いたオーケストレータ散文へのローカル編集も含みます。無関係なプロジェクト内容は主張しません。

### ルート統合と所有

| ファイル | 所有する範囲 |
|---|---|
| `.gitignore` | 全ハーネスの同梱エントリの和集合を1つのマーカーブロックに保存。外側のバイトは保持 |
| `.mcp.json` | Claudeの同意済み・基準に記録したmcpServersだけ。ユーザーキーと上書きを保持 |
| `AGENTS.md` | Kiro CLI/IDE、Codex、Cursor、opencodeは同じ共通ブロック。Copilotはmethod importを含む専有ブロック。プロジェクト指示を保持 |
| `.vscode/settings.json` | Kiro IDEのtrustedCommands内の同梱文字列だけ |
| `opencode.json` | 回答だけの変更は現在ファイル内の由来を確認したキーを編集。通常のrelease更新はファイル全体の所有権基準を検査 |

**複数ハーネス:** エンジンディレクトリが異なり、専有ブロックが衝突しなければ共存できます。Claudeはどのハーネスとも共存できます。Kiro CLIとIDEは `.kiro/` が同じなので不可、opencodeとCopilotも `.aidlc/` が同じなので不可です。CopilotのAGENTS.mdは専有のため、AGENTS.md共通ブロックを持つ他ハーネスとの組合せを導入順にかかわらず拒否します。

旧ハーネスの `predates shared onboarding` は、先に `aidlc config --harness <name>` で更新する案内です。共存可能になる保証ではなく、Copilotは更新後も専有です。共有中のAGENTS.mdを非共有版へ戻す更新も拒否し、forceでは回避できません。別releaseの共有ブロックがある場合は競合となり、同じreleaseへ揃える更新順を案内します。Cursorのコピーinstallerは単一ハーネス用なので、共存時はconfig経由で追加します。

gitignoreの `shared: "union"` は同梱エントリを結合し、追加分を `# <harness> harness` 以下に置きます。既存ハーネスの同梱コピーと未変更ブロックが確認できると結合し、古い導入でコピーがなければ更新まで所有権を維持します。各ハーネスは次のconfig時に同じ結合ハッシュを記録します。**複数導入後のすべてのconfig呼出しは、previewやrefreshも含め `--harness <name>` が必須です。**

プロバイダー・スコープ・モデルの回答は、Claude settingsとCodex configのプロジェクト所有キーを保持します。ClaudeのcompanyAnnouncements、permissions、statusLine、hooks、Codexのshell_environment_policy、sandbox_workspace_write、agents、features、tools、tuiはフレームワーク所有です。変更すると基準との競合となり、forceは無関係なキーを保持して同梱値に戻します。明示的なfromはプロジェクトのコピーより優先します。

マーカーなしの旧同梱ブロックは、同梱署名と一意に一致する場合だけ引き継ぎます。曖昧な類似内容、不正JSON、壊れた／重複したマーカー、通常ファイルではない対象、完全性を失った旧所有内容は拒否します。forceでも、曖昧な未所有内容やユーザーJSON値、通常更新時の未所有・変更済みopencode.jsonは上書きしません。

## 更新と版の選択

| コマンド | 公開オプションと動き |
|---------|-----------------------------|
| `aidlc update` | マシンのチャネルの最新リリースを、全ハーネスランタイム一式付きで入れ、原子的に有効化する。受け付けるのは `--version <version>`、`--channel <stable\|preview>`、`--from <release-dir>`、`--release-base-url <url>`、`--release-api-url <url>`、`--ca-bundle <path>`、`--offline`、`--dry-run`。 |
| `aidlc update --check` | 入れずに、チャネルの更新メタデータを更新する。遅れているとき（またはバイナリがもう一方のチャネルのとき）は 5、最新なら 0、利用不可／オフラインなら 3、検査が無効なら 1。 |
| `aidlc use <version>` | 保持していなければ正確な安定版またはプレビュー版を入れ、プロジェクトファイルは変えずにマシンのアクティブにする。 |
| `aidlc config --channel [stable\|preview]` | マシンのリリースチャネルをセットする。値が無ければ出す。 |
| `aidlc config --pin <version>` | 必要なら正確な版を入れて検証し、`.aidlc-version` を原子的に書き、マシンローカルの解決先を記録し、マシンのアクティブポインタは変えずにプロジェクトピンを登録する。 |
| `aidlc config --unpin` | `.aidlc-version`、そのマシンローカルの解決先、レジストリエントリを外す。 |

人向けライフサイクル出力は、完了した事実をそれぞれ述べます。update は旧から新への版検査、検証済みダウンロード、原子的な切り替え、残した以前の版、保護されていない刈り込み、プロジェクト更新の案内を報告します。
何もしないときは `You're on the latest version of aidlc (<version>).` です。`--dry-run` は `Would update aidlc from <old> to <new>.`、変わるものがないときは `You're on the latest version of aidlc (<version>); nothing to update.` です。プレビューチャネルでは更新の行が `preview releases` と `latest preview version` になり、チャネルをまたぐ更新は `Switched release channel from <a> to <b>.` を足します。`aidlc use` は `Now using` と `Already using` を区別し、uninstall は外した、または残したマシン状態を正確に述べます。JSON と quiet のメッセージは、自動処理向けの安定した形式を維持します。update の JSON は `channel` を運び、切り替え時は `channelSwitch` も運びます。

update はアクティブポインタを変える前に、候補をダウンロードして完全に検証します。失敗した更新は、以前の一貫した導入を自動で戻します。成功した更新は、以前のアクティブ版と登録済みプロジェクトピンをすべて残し、保護されていない古い版を自動で刈ります。公開のロールバックや、保持版の管理コマンドはありません。

## リリースチャネル

`main` は共有の開発ブランチです。**stable** は選んだコミットを `vX.Y.Z` タグで公開し、**preview** は次の安定版の前に main の変更を試す GitHub プレリリースです。preview を latest にはしません。ソースの版と changelog は安定版のリリース準備時に更新します。

予定実行と手動実行は、直列化した公開キューを共有します。最新プレビューからソースが変わっていなければスキップします。同じ UTC 日付に main が複数回進んだ場合は、変更のあるソースごとに次のカウンターで公開できます。

プレビュー id は `<x.y.(z+1)>-preview.<YYYYMMDD>.<N>` です。現在の安定版の次の patch、計画時の UTC 日付、1 から始まるビルド番号を使います。ワークフローがソースの版を編集せず計算します。失敗時に残った draft やタグも id を予約するため、再試行や同日の次の変更は、占有済みの id を越えて N を進めます。

安定 id は正確に `x.y.z` のままです。版が出るどこでも（インストーラフラグ、`use`、ピン、`.aidlc-version`、保持版ディレクトリ）それ以外は受けません。id は `x.y.z` で数値順です。基が同じときは、安定リリースがその基から作ったどのプレビューより上に並び、プレビューはビルド日、そのあとカウンタで並びます。プレビュー成果物の中では `aidlc version`、`version.json`、doctor バンドルはどれもプレビュー id を報告します。ソースツリーは決して変えません。

```bash
aidlc config --channel preview   # follow the preview stream
aidlc update                     # newest published preview
aidlc update --check             # 5 when a newer preview exists
aidlc config --channel stable    # back to the stable stream
aidlc update                     # newest stable, reported as a channel switch
```

チャネルはマシンローカルです。`aidlc config --channel` は導入ルートの下、更新キャッシュと `pins.json` の隣に `channel` マーカーを書きます（マーカーが無ければ `stable`）。`aidlc uninstall` はほかのマシン設定と一緒に残し、`--purge` が外します。`aidlc update --channel <c>` は 1 実行だけマーカーを上書きします。`--version` と `--from` はチャネルに関係なく正確なリリースを選びます。安定の発見は変わりません（`latest/download` リダイレクト）。プレビューの発見は、リリースベース URL の向こうのリポジトリのリリースを GitHub API で列挙し、プレビュー版 id で最新の公開プレリリースを残し、正確な版の経路で入れます。draft と、公開リリースのないタグは無視します。
`github.com` のベース URL では API エンドポイントを導出します。ほかのホストでは `--release-api-url <url>` か `AIDLC_RELEASE_API_URL` をセットします。
API 失敗、レート制限、公開プレビューのないリポジトリは利用不可（終了 3）として報告します。クライアントが安定リリースへ落ちることはありません。更新キャッシュは、更新したチャネルを記録するので、キャッシュしたプレビュー結果が安定の検査に答えることも、その逆もありません。

戻すのは `aidlc config --channel stable` のあと `aidlc update` です。実行中のプレビューより最新安定 id の並びが下でも、update はそれを入れ、チャネル切り替えとして報告します。プレビューの保持は、どのリリースにもある保護（アクティブ、ロールバック、使用中、ピン）の上の有界ウィンドウです。更新のあと、完全なプレビューの最新 2 つは残り、独自の保護がないより古いプレビューは刈られます。安定の保持は変わりません。

プロジェクトピンはマシンチャネルを上書きし続けます。`aidlc config --pin <id>` と `.aidlc-version` はプレビュー id を受け、ピンしたプロジェクトは、マシンが何を追っていても、その正確な保持版へディスパッチします。

プレビューは、その時点の `main` です。プロジェクトの状態スキーマ変更も含みます。状態スキーマを上げるプレビューは、安定ビルドが理解しないプロジェクト状態を書き、コードはビルドより新しい状態を開くことを拒みます。同じスキーマが安定リリースに乗るまで、そのプロジェクトは安定へ戻せません。再現できるプロジェクトでプレビューチャネルを使うか、ピンしてください。

## プロジェクトのピンと CI

```bash
aidlc config --pin 2.5.45
git add .aidlc-version
```

`aidlc config --pin <version>` は、必要ならその版を入れて検証し、`.aidlc-version` を書き、gitignore された `aidlc/.aidlc-sessions/` ランタイムディレクトリの下に絶対バイナリ先を記録し、マシンローカルの `pins.json` に本物のプロジェクトパスを登録します。
レジストリ読みはファイルシステム別名（macOS の `/var` と `/private/var` を含む）を正規化し、JSON 出力は正規プロジェクトパスを報告します。同じ版の同等キーは畳みます。衝突する同等は、`config --pin` か `config --unpin` がそのプロジェクトの別名すべてを突き合わせるまで、処理を拒否します。

コミットするのは `.aidlc-version` だけです。固定の `aidlc` ランチャは、完全性検査済みのアクティブバイナリを起動し、そのディスパッチャがピンしたバイナリとランタイム一式を検証してから選びます。ない、壊れた、改ざんされた、または使えない対象は `aidlc config --pin <version>` の対処で処理を拒否し、`aidlc doctor` も同じ状態を報告します。マシンのライフサイクルコマンドはアクティブバイナリを使います。`doctor`、`config`、`use` は壊れたピンの向こうに閉じ込められません。

新規クローンや CI ランナーは、config の前にコミットした版を入れます。

```bash
version=$(cat .aidlc-version)
tag="v$version"
tmp="$(mktemp -d)"
gh release download "$tag" --repo awslabs/aidlc-workflows --dir "$tmp" \
  --pattern install.sh --pattern aidlc-release.intoto.jsonl
gh attestation verify "$tmp/install.sh" \
  --bundle "$tmp/aidlc-release.intoto.jsonl" \
  --repo awslabs/aidlc-workflows \
  --signer-workflow awslabs/aidlc-workflows/.github/workflows/release.yml \
  --source-ref "refs/tags/$tag"
sh "$tmp/install.sh" --version "$version" --quiet --yes
rm -rf "$tmp"
aidlc config --pin "$version" --project-dir "$PWD" --quiet
aidlc config --project-dir "$PWD" --harness claude --mcp none --quiet
aidlc doctor --project-dir "$PWD" --quiet
```

## ハーネスの選択

ハーネスの選択は `aidlc config --harness <name>` の仕事です。マシン単位のハーネス管理は公開コマンドではありません。

## オフラインパッケージ

リリース資産の集合がオフラインパッケージです。バイナリ、ランタイム、インストーラ、`version.json`、`checksums.txt` と並んで `aidlc-release.intoto.jsonl` が入ります。ネットワークに接続できるマシンで完全なリリース 1 つをダウンロードし、そのディレクトリを変えずに移します。バンドルがないか、`checksums.txt` を認証できなければ、ローカル導入は処理を拒否します。

```bash
gh release download v2.5.45 --repo awslabs/aidlc-workflows --dir ./aidlc-offline
```

ネットワークに接続できないマシンでの導入:

```bash
bash ./aidlc-offline/install.sh \
  --from ./aidlc-offline --offline
```

```powershell
& .\aidlc-offline\install.ps1 `
  -From .\aidlc-offline -Offline
```

ネイティブコマンドでは、`--offline`、`AIDLC_OFFLINE=1`、またはグローバルの `offline=true` がリリースネットワーク接続を防ぎます。`--from` のないネットワーク操作は、変更の前に失敗します。config、doctor、version、uninstall はどれもローカルです。

## ミラー、プロキシ、CA、更新設定

リリース設定の解決順は、明示オプション、環境、マシン設定、既定です。

| 設定 | 環境 | マシン設定 |
|---------|-------------|----------------|
| オフライン | `AIDLC_OFFLINE=1`（`0` はネットワークを明示で有効にする） | `aidlc system config global set offline on` |
| ミラー | `AIDLC_RELEASE_BASE_URL` | `aidlc system config global set release-base-url <url>` |
| プレビューリリース API | `AIDLC_RELEASE_API_URL`（または `aidlc update --release-api-url <url>`） | `github.com` ではミラーから導出。マシン設定キーではない |
| CA バンドル | `AIDLC_CA_BUNDLE` | `aidlc system config global set ca-bundle <absolute-path>` |

マシン設定の 4 つのキーを管理するコマンド:

```bash
aidlc system config global list
aidlc system config global get update-check
aidlc system config global set update-check off
aidlc system config global set offline on
aidlc system config global set release-base-url https://mirror.example/releases
aidlc system config global set ca-bundle /absolute/path/corporate-ca.pem
aidlc system config global clear ca-bundle
```

キーは `update-check`、`offline`、`release-base-url`、`ca-bundle` です。
真偽値は `true|false`、`on|off`、`1|0`、`yes|no` を受けます。
`aidlc config <get|set|clear|list> ... --global` は同等です。

ミラーのベース URL は HTTPS が必須です。ローカル試験のループバック HTTP は例外です。クレデンシャル、クエリ、フラグメントは含められません。ネイティブライフサイクルクライアントはリダイレクトを最大 5 回まで追います。リダイレクト先 URL にクエリは入れてよいですが、クレデンシャルとフラグメントはまだ入れられません。エラーは URL のクレデンシャル、クエリ、フラグメントを伏せます。

ネイティブリリースクライアントは `HTTPS_PROXY` / `https_proxy` と `NO_PROXY` / `no_proxy` を守ります。プロキシ URL は HTTP か HTTPS が必須です。`HTTP_PROXY` は読みません。ブートストラップスクリプトのプロキシ振る舞いは `curl`、`wget`、または `Invoke-WebRequest` に委ねます。Windows で独自 CA バンドルを使うときは `curl.exe` が要ります。

素のヘルプと管理の列挙は、ネットワークを決して更新しません。有効なキャッシュ済み更新案内は出せます。対話の人向け `aidlc doctor` は、古い、またはないメタデータを 750 ms 以内に更新することがあります。非 TTY、`--json`、`--quiet` の doctor 実行は、`--check-updates` を明示しない限りキャッシュだけです。
`doctor --check-updates` と `update --check` はメタデータの予算 15 秒です。キャッシュは 24 時間で期限切れです。失敗した、または機能が低下した更新処理は、有効なキャッシュを置き換えません。`update-check=off` は明示の更新まで止めますが、明示の `aidlc update` は止めません。

## プラグイン

`aidlc doctor` は、導入済み対合成済みのプラグイン状態を報告します。プラグインの変更はプロジェクト設定で、`aidlc config` 経由で収束します。別の公開プラグインコマンドはありません。

## 出力、自動化、終了コード

公開コマンドは、ルートレジストリが宣言するところでは人向け、`--quiet`、`--json` 出力を支えます。`--json` は `ok`、`code`、`status`、`message`、あればコマンド固有の `data` 付きの、スキーマ版付き結果を出します。`--quiet` は成功の行か対処の行を 1 行出します。ダウンロード進捗は人向けモードだけに出ます。

ネイティブ診断の形は
`aidlc doctor [--project-dir <path>] [--verbose] [--json|--quiet]
[--check-updates] [--release-base-url <url>] [--ca-bundle <path>]
[--offline]` です。`--export` はマスキングした診断バンドルを書き、`--output <directory>` がその既定のプロジェクト場所を上書きします。export 出力は、選んだライブ報告モードへの追加です。人向け出力は Machine、Project、Framework の完全性検査をまとめます。どのセクションも警告・失敗の行は表示し、正常な行は既定で折り畳みます。`--verbose` は検査を全部広げます。警告は advisory で終了 0、失敗した検査があれば終了 1 です。

`--no-color` と `NO_COLOR` は ANSI 出力を止めます。`--project-dir <path>` はシェルのディレクトリを変えずにプロジェクト文脈を選びます。`uninstall` のような破壊的操作は TTY では確認を聞き、ないときは `--yes` が要ります。`--yes` は所有、完全性、進行中のワークフロー、リリース認証の拒否を決して迂回しません。

| コード | 意味 |
|------|---------|
| 0 | 成功 |
| 1 | 運用失敗 |
| 2 | 使い方、または無効なマシン設定 |
| 3 | 必要なネットワーク結果、または保持ランタイムが使えない |
| 4 | 完全性または所有の拒否 |
| 5 | 検査は完了し、操作が要る。利用可能な更新など |

## ヘルプと補完

`aidlc --help` は公開コマンドちょうど 6 つを出します。各公開コマンドには副作用のないコマンドヘルプもあります。`config`、`doctor`、`version`、`update`、`use`、`uninstall` 向けの `aidlc <command> --help`（または `-h`）です。config レベルのヘルプは方針セクション 6 つすべてを指名し、`aidlc config <section> --help` はセクション固有のヘルプを残します。`aidlc help --all` は隠した `engine` と `system` 名前空間を見せ、ファイル一覧全体は `aidlc engine --help` / `aidlc system --help` を指します。
インストーラは、公開ルートレジストリから生成した Bash、Zsh、Fish、PowerShell ファイルを、ユーザー単位の AI-DLC データルートの `completions/` ディレクトリへ置きます。公開の補完生成動詞はありません。

## トランザクションと復旧

プロジェクトとマシンの変更は、先のファイルシステム上でステージし、候補を検証し、原子的な rename でコミットします。計画した状態に対して検出した並行変更は、新しいバイトを上書きせず中止します。捨てられた所有プロセス専用のステージングは、ロックと所有の検査のあとだけ掃きます。

中断したコミットのロールバックを安全に完了できないときは、証拠をマシン導入ルートまたはプロジェクトルートの下の、名前付き `.aidlc-recovery-*` 隔離に残します。`aidlc doctor` が報告します。必要なファイルを回収し、AI-DLC の変更が走っていないことを確かめてから、列挙したディレクトリだけ手で消してください。自動のステージング掃除は隔離を決して消しません。

Windows の uninstall は、再開できる継続を使います。実行中の実行ファイルは自分のコマンドシムを消せないからです。その後のコマンドは、ほかの仕事の前に、有効な未完了継続を再開します。

<a id="copy-channel"></a>

## コピー経路

手動コピー用の配布物は `aidlc-copy-runtime-X.Y.Z.tar.gz` です。同じリリースの `runtime/<harness>/` ルート全体をコピーし、ハーネス、`aidlc/`、ルート統合ファイルを揃えてください。必要なランタイムは Bun で、ネイティブの `aidlc` は不要です。

```bash
tag=vX.Y.Z
tmp="$(mktemp -d)"
runtime_asset="aidlc-copy-runtime-${tag#v}.tar.gz"
runtime_checksum="${runtime_asset}.sha256"
source_repo="${AIDLC_RELEASE_REPOSITORY:-awslabs/aidlc-workflows}"
release_workflow="${AIDLC_RELEASE_WORKFLOW:-$source_repo/.github/workflows/release.yml}"
gh release download "$tag" --repo "$source_repo" --dir "$tmp" \
  --pattern "$runtime_asset" \
  --pattern "$runtime_checksum" \
  --pattern aidlc-release.intoto.jsonl
gh attestation verify "$tmp/$runtime_asset" \
  --bundle "$tmp/aidlc-release.intoto.jsonl" \
  --repo "$source_repo" \
  --signer-workflow "$release_workflow" \
  --source-ref "refs/tags/$tag"
(cd "$tmp" && sha256sum -c "$runtime_checksum")
tar -xzf "$tmp/$runtime_asset" -C "$tmp"
RUNTIME_ROOT="$tmp/runtime"
cp -R "$RUNTIME_ROOT/claude/." your-project/
```

このアーカイブは再生成した `dist/` の Bun 版から構築し、同梱 TypeScript を Bun で実行します。ネイティブインストーラーと更新コマンドは `dist-release/` 由来の `aidlc-runtime-X.Y.Z.tar.gz` を使います。通常、利用者が後者を直接取得する必要はありません。

2.8.x のネイティブクライアントがメタデータを読み自己更新できるよう、コピー用アーカイブは `version.json` と `checksums.txt` に含めません。版付きの `.sha256` sidecar でバイト列を検証し、リリースの出所証明は両ファイルを対象にします。

ネイティブ実行ファイルを利用できる場合は、トランザクションで適用し所有情報を記録する `aidlc config` を推奨します。

フレームワーク開発者は代わりにソースをクローンし、依存を入れ、無視されるローカル出力を実体化できます。

```bash
bun install --frozen-lockfile
bun scripts/package.ts
```

これで Bun 起動の `dist/<harness>/`、ネイティブの `dist-release/<harness>/`、プラグイン投影がローカルにできます。生成ルートはどちらもコミットしません。直接の `bun .../tools/*.ts` 呼び出しは、ソース／開発とデバッグの仕組みのままで、第二のネイティブライフサイクル面ではありません。

## アンインストール

```bash
aidlc uninstall
aidlc uninstall --purge --yes
```

uninstall はインストーラ所有のコマンドと保持した版をすべて外しますが、プロジェクトのディレクトリツリーは決して変えません。`--purge` がないときは、マシン設定、更新キャッシュ、ピン登録、既定ハーネスを残します。`--purge` はそれらのマシン記録も外します。

uninstall は確認が要り、root 所有、パッケージマネージャ所有、または混在所有のコマンドを拒みます。Windows では、実行中のコマンドが終了したその後の検証済み掃除を予定し、次のコマンドで中断した継続を再開します。
