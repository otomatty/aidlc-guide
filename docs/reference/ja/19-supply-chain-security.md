# リリースのサプライチェーン

AI-DLC のリリースは、`awslabs/aidlc-workflows` の独立した 2 つのワークフローで作成します。
stable タグには `.github/workflows/release.yml`、定期実行または手動実行の preview には
`.github/workflows/preview-release.yml` を使います。どちらもリポジトリが提供する
`GITHUB_TOKEN` を使い、公開のために GitHub App、個人アクセストークン、別のリポジトリ、
リポジトリのシークレットは必要ありません。preview と、再利用できる結果を持たない stable リリースが呼び出す Full Suite のライブテストは、既存の `ai-pr-review` 環境の `AWS_AI_PR_REVIEW_ROLE_ARN` シークレットを使い、呼び出されたワークフローのライブジョブがこれを解決します。呼び出し側は `secrets: inherit` を渡します。これがないと、呼び出された実行ではその環境シークレットが空として解決されていました。

## リリースの開始条件

厳密な `vX.Y.Z` 形式のタグをプッシュすると、リリースワークフローが始まります。
最初のジョブは、次の条件をすべて満たさなければリリースを拒否します。

- イベントの ref が、プッシュしたタグである。
- チェックアウトしたコミットが、タグの参照先である。
- タグの参照先が `main` に含まれている。
- タグが `v` と `core/tools/aidlc-version.ts` のバージョンを連結した値と一致する。

stable の公開には、タグを付けた正確なコミットに対する、リリース目的の Full Suite の合格が必要です。これは「stable リリースに Full Suite の結果は不要」とした 2026-09-21 の決定を覆すもので、メンテナーが 2026-09-26 に変更しました。`Find Full Suite evidence` ジョブ（`actions: read`）は、タグ付きコミットに対する成功した Preview Release の実行と、`main` 上で成功した手動の `full-suite.yml` ディスパッチを探し、その `full-suite-result` をダウンロードして、条件を満たす最初のものを再利用します。証拠として数えるのは、`main` 上のこれらのレビュー済みワークフローからのものだけです。他のブランチやイベントでの実行、検証用の成果物、別のコミットや別の実行の結果は条件を満たしません。条件を満たすものがなければ、リリースは preview と同様に、`contents: read`、`id-token: write`、`secrets: inherit` を付けてタグ付きコミットに対して `full-suite.yml` を呼び出します。探索が失敗した場合はスイートの実行にフォールバックします。続いて `Require a passing Full Suite` が結果をダウンロードして `scripts/ci-full-suite-evidence.ts check` を実行します。これは、タグ付きの `sha`、生成した `runId`、`purpose: "release"`、`verificationFamily: "all"`、`coveragePolicy: "required-hosted-live-shards-v3"`、`passed: true`、無効化された leg がないこと、そして省略されスキップされたのがちょうど `deterministic` と `production_guards` であることを要求します。宣言された他のジョブはすべて成功していなければなりません。この実行が呼び出したスイートも成功している必要があります。`publish` と `release` はこのゲートを必要とし、検証済みコミットを再確認します。ビルドとライフサイクルの検査はスイートと並行して実行されます。`main` の外にあるタグは、Full Suite がテスト済みかどうかに関係なく、stable ワークフローのソース検証で失敗します。

明示的な手動の `full-suite.yml` ディスパッチでは、マージ前に候補のライブジョブを検証する `live_verification=true`、または候補に対して認証情報を使わないすべてのジョブを実行する `full_verification=true` を設定できます。2 つは同時に指定できず、どちらの入力も再利用の呼び出し側からは使えません。計画処理は `workflow_dispatch` と、チェックアウトしたソースと手動で選んだワークフローの head（`github.sha`）の完全一致を要求します。通常の実行は、マージされていないブランチを含め要求された ref を受け付け、解決した不変の SHA を使って必須ジョブをすべて実行します。候補ブランチからのディスパッチは、信頼できる stable リリースの証拠にはなりません。特権付きでブランチへのプッシュや PR を契機に自動実行する仕組みはありません。

ライブ検証は、同じ隔離されたライブ準備、環境が所有するロール、低権限のブローカークライアントを使います。ネイティブ、deterministic、production-guard のジョブは意図的に省略します。その成果物は `full-suite-live-verification-result` という名前で、`purpose: "live-verification"` と `complete: false` を記録します。成功した結果には、ライブジョブの成功と、省略分が明示的にスキップされていることが必要です。stable リリースのワークフローは、`main` 上の検証実行のものであっても、この成果物を使いません。

フル検証は、候補に対してネイティブ、deterministic、production-guard、Windows のリリース契約ジョブを実行し、認証情報を受け取るジョブは決して実行しません。3 つの `live_prepare_*` ジョブと `live_linux`、`live_macos`、`live_windows` をスキップするため、マージされていないコードがそれらの認証情報に到達できる場所で実行されることはありません。Full Suite のすべてのチェックアウトは `persist-credentials: false` を設定するため、候補のコードがディスク上でリポジトリのトークンを見つけることもありません。`verification_family` と `verification_test` のフィルターは拒否します。その成果物は `full-suite-verification-result` という名前で、`purpose: "full-verification"`、`complete: false`、そして `omittedLegs` にちょうどその 6 つのジョブを記録します。成功した結果には、他のすべてのジョブの成功と、その 6 つがスキップされていることが必要です。候補がマージされた後でも、これを使うリリースワークフローはありません。

手動検証では、さらに `verification_family` として `claude-sdk`、`claude-tui`、`codex`、`opencode` を選べます。既定値は `all` です。範囲を絞った実行も同じ完全一致の head 認可を保ち、選んだファミリーの既存のシャードだけを実行し、Windows のリリース契約カバレッジが明示的にスキップされていることを要求します。結果には `verificationFamily` とその省略分を記録します。リリース目的の実行は範囲を絞った選択を拒否し、`passed` やジョブの状態とは独立に `verificationFamily: "all"` を要求します。特定のファミリーでは、`verification_test` でリポジトリ内の正確なファイルを選べます。探索処理は未知のファイルや一致しないファイルを拒否し、元のシャードの識別子と宣言されたプラットフォームを保持します。準備はそれらのプラットフォームでだけ実行します。結果には `verificationTest`、`verificationPlatforms`、省略したホスト型ジョブを記録します。集約処理はそれらの省略分がスキップされていることと、選んだジョブが成功していることを要求します。ソースのゲートと結果の集約処理はどちらも、リリース目的の実行でのこの選択を拒否します。

POSIX の準備処理は、ピン留めした公式の Node 配布物を取得し、そのプレフィックス全体を検証済みの依存関係アーカイブとともに運びます。認証情報を持つジョブは、準備済みのバイト列を展開してコピーするだけで、依存関係のインストーラーは実行しません。Node と CLI の起動は、ランナーのディレクトリを保護した後に低権限の ID で行います。収集処理はその macOS アカウントの launchd ドメインを退役させ、実行中のプロセスが残っている間はコピーを拒否します。

ライブのマトリクスは、各ジョブに対応プラットフォームごとに 1 ファイルを割り当てます。Linux、macOS、Windows のライブジョブには、それぞれ 12、6、6 の別々の同時実行上限があります。各ロールセッションは実行ステップの直前に 3,600 秒を要求します。ジョブは 80 分、テストステップは 70 分、ライブのファイルと実行は 3,600 秒まで許可されます。モデルの作業は 5 分のクリーンアップ予備時間の時点で止まるため、常にセッションが有効な間に終わり、その後に証拠の収集が続きます。タイムアウトはカバレッジの失敗になります。
既存の IAM ロールの有効期間と、認証情報を分離する境界は変わりません。

機能追加、修正、文書、リファクタリング、テストの PR では、リリースのメタデータを更新しません。
リリース準備の PR で、前回のリリース以降にマージされた利用者向けの変更をまとめ、
タグを作る前にバージョン、README のバッジ、変更履歴の項目を一緒に更新します。
ワークフローはソースファイルを変更しません。

## ビルドと検証

正確なタグとソースコミットを検証した後、stable ワークフローは次の処理を行います。

1. すべてのハーネス向け配布物を再生成し、出力の決定性を検証する。
2. 型検査、lint、ShellCheck、PSScriptAnalyzer を実行する。
3. Linux、macOS、Windows 向けのネイティブバイナリをビルドする。
4. ネイティブ実行とインストーラーのスモークテストを実行する。
5. マニフェスト外の手動コピー用 `aidlc-copy-runtime-X.Y.Z.tar.gz` とその `.sha256` sidecar、マニフェストに含むネイティブ用 `aidlc-runtime-X.Y.Z.tar.gz`、インストーラー、`version.json`、`checksums.txt` を作成する。
6. 一時配置したリリースファイルの一覧とチェックサムを検証する。
7. `publish` が何かを証明する前に、そのコミットに対する Full Suite の合格を要求する。以前の結果を再利用するか、ステップ 1〜6 と並行してスイートを実行する。

stable ワークフローは、ソースのテスト階層をこの Full Suite を通じてだけ実行します。必須の PR チェックは、プッシュのたびに Linux のスモーク、ユニット、決定的な統合のカバレッジと production-guard の検査を提供し、マージキューはクロス OS のネイティブ端末と OS 隔離の重点検査を追加します。クロスプラットフォームの E2E とホスト型のライブカバレッジは Full Suite で実行します。Full Suite は毎晩の preview が呼び出し、stable の公開がタグ付きコミットに対して要求します。stable ワークフローは、生成出力、ネイティブバイナリ、インストーラー、ライフサイクルのフロー、チェックサム、リリース成果物の来歴を独立に検証します。

リリースマニフェストはタグ ref と正確なソースコミットを記録します。両ランタイムアーカイブの名前はリリースのバージョンを含みます。手動コピーの利用者は `aidlc-copy-runtime-X.Y.Z.tar.gz` をダウンロードし、ネイティブインストーラーは `aidlc-runtime-X.Y.Z.tar.gz` を選びます。2.8.x のクライアントが前方互換の更新発見を保てるよう、コピー版のアーカイブはマニフェストと主チェックサム一覧の外に置き、その sidecar とリリースの来歴で独立に認証します。

## 来歴の証明

`publish` ジョブは、ビルド、ライフサイクル、前回リリースからの更新の各ジョブと Full Suite のゲートが成功してからだけ
`id-token: write` と `attestations: write` を受け取ります（preview の `publish` は更新ジョブを待ちません。そこでは更新ジョブは報告だけを行います）。GitHub は一時配置した
成果物のビルド来歴を生成します。エクスポートした来歴の証明バンドルは
`aidlc-release.intoto.jsonl` として同梱します。

preview ワークフローは `Europe/Lisbon` の毎日 22:00 に `main` を対象に定期実行し、手動ディスパッチも受け付けます。定期実行と手動実行は `release-preview` ワークフローの同時実行グループで直列化され、実行中の処理は取り消されません。後続の各実行はリリース一覧を読み直します。計画処理は、ソースコミットが最新の公開済み preview から変わっていない場合、またはその preview がこの実行のソースの子孫にあたる新しいコミットからビルドされていた場合（再試行やキューで待っていた古い実行）、公開用のビルドチェーンをスキップします。そのためチャネルが後退することはありません。そのソースに対する契約検査と Full Suite は引き続き実行され、公開が重複排除された場合でも、最終結果はそれらの成功を要求します。同じ UTC 日付に `main` がさらに進んだ場合は、次のビルドカウンターで別の preview を公開できます。

実行は、その実行を開始したコミットをテストして公開します。`main` には絶えずマージが入り、ランナーが契機から大きく遅れて実行を拾うこともあります（Preview Release 36485041152 では 22 分）。そのため計画、公開、リリースが要求するのは、コミットがまだ `main` 上にあること（現在の先端の祖先であること）だけで、先端であることは要求しません。実行の来歴はそのコミットを示すため、より新しいコミットに切り替わることはありません。revert は `main` の履歴からコミットを取り除かないため、preview の開始後に revert されたコミットも Full Suite の認証情報でテストされ、プレリリースとして公開されることがあります。取り下げるには、その Preview Release の実行を取り消すか、公開後にプレリリースを削除します。これはメンテナーの決定です（2026-09-29）。

計画処理は `core/tools/aidlc-version.ts` から現在の stable の `x.y.z` を読み、計画時の UTC 日付と、既存のタグやリリース記録が占有する id を使って `<x.y.(z+1)>-preview.<YYYYMMDD>.<N>` を割り当てます。次の patch はメモリー内で計算し、リリースのメタデータは編集しません。下書きや孤立タグも id を予約するため、再試行の計画や同日の後続の公開では、占有済みの id を越えて `N` を進めます。残った `aidlc-staging-*` の下書きは、公開処理が次の候補を一時配置する前に、引き続き調査と削除が必要です。

計画処理は前回の preview 以降の変更からリリースノートを生成します。契約検査は、通常のリリースビルドチェーンの前に、承認されたコミットをゲートします。Full Suite は先に実行されますが、ゲートにはなりません。スイートが失敗しても preview はビルド・公開され、そのノートは冒頭に警告を置き、末尾に Full Suite の失敗レポートを載せます。Full Suite は別に実行され、Preview Release を失敗させることなく、自身の失敗状態を保持します。preview の Full Suite ディスパッチジョブだけが、その実行を開始して見守るために `actions: write` を追加し、`Release tests` ジョブは証拠をダウンロードしてジョブを一覧するために `actions: read` を追加します。preview は PR CI のテストマトリクスを繰り返しません。
PR CI と Full Suite は同じ `deterministic-tests.yml` ワークフロー定義を異なるマトリクスで使います。PR では Linux のスモーク／12 のユニットシャード／統合、毎晩のカバレッジでは Linux・macOS・Windows のスモーク／12 のユニットシャード／統合／E2E です。
統合と隔離された E2E は、新しいランナープロセスを持つ別々のジョブで実行します。各呼び出しは、渡されたコミットの新しいチェックアウトをテストし、無害化した証拠を保持します。以前のテスト結果で実行を代替することはありません。
`AIDLC_BUILD_VERSION` は、配布ツリー、バイナリ、`version.json`、バージョン付きの両ランタイムアーカイブ、同梱インストーラーに preview id を埋め込み、ソースツリーは stable の `x.y.z` のバージョンを保ちます。そのため同梱インストーラーは、`latest` を再探索せず、自身を含むリリースを既定にします。preview の公開処理は staging の下書きを検証し、ソースのリポジトリとコミットを記録した注釈付きタグを作ってから、`make_latest: false` で下書きをプレリリースとして公開します。そのため stable の `latest/download` による探索は変わりません。

stable と preview の公開は、それぞれ保護された `release` 環境と無人の `preview` 環境を使います。preview 環境は同じ `main` のデプロイ方針を保ちますが、必須レビュアーは設定しません。マージの承認と契約検査が人間と決定的な検証のゲートであり、Full Suite の失敗は公開を止めるのではなく preview のノートで報告されます。stable の実行は別の同時実行グループを使います。preview の公開処理は、公開前に候補全体を一時配置してバイト単位で検証し、リポジトリのリリースが mutable / immutable のどちらでも動作します。

対応する GitHub CLI が利用できる場合、インストーラーはそのバンドルを使って
`checksums.txt` を検証し、次の情報と結び付けます。

- `awslabs/aidlc-workflows`。
- stable バージョンでは `.github/workflows/release.yml`、preview バージョンでは
  `.github/workflows/preview-release.yml`。
- stable リリースではバージョンタグ、preview では `refs/heads/main`。
- `version.json` に記録された正確なソースコミット。

GitHub CLI がない場合や古い場合も、インストールは続行できます。この場合もオンライン転送は
HTTPS に限定し、ソースの識別情報と SHA-256 の検証は必須です。ただし、クライアントは
Sigstore バンドルの真正性を検証しません。

## 公開

最後の `release` ジョブは保護された `release` 環境で実行し、`contents: write` を受け取ります。
リリースに人間の承認が必要なら、その環境に必須レビュアーを設定します。承認後、ジョブは
証明付きの候補をダウンロードし、タグとチェックサムを再確認して、GitHub Release を作成します。

```bash
gh release create "$RELEASE_TAG" build/release/* \
  --verify-tag \
  --title "AI-DLC ${RELEASE_TAG#v}" \
  --generate-notes
```

その後、ローカルの成果物名と GitHub Release API が返す成果物名を比較します。
アップロードに不足や余分なファイルがあると、ワークフローは失敗します。

それ以前のジョブの権限はすべて `contents: read` のままです。呼び出された Full Suite のライブジョブも、preview と同様に `ai-pr-review` ロールのためだけに `id-token: write` を受け取ります。
保存された認証情報にリリースの書き込み権限を与えることはなく、環境のゲートを通る前に公開権限を受け取るジョブもありません。

## リリースを作成する

1. 次を更新するリリース準備の PR をマージする。
   - `core/tools/aidlc-version.ts`。
   - README のバージョンバッジ。
   - 対応する `CHANGELOG.md` の見出し。
2. リリース準備の PR が必須のブランチチェックに合格したことを確認し、`main` 上でマージされた正確なコミットを選ぶ。そのコミットの preview が成功しているか、`main` 上で `ref=<sha>` を指定した手動の `full-suite.yml` ディスパッチがあれば、リリースが再利用する `full-suite-result` が残る。どちらもなければ、リリースが自ら Full Suite を実行し、数時間長くかかる。
3. 選んだコミットから対応するタグを作成し、プッシュする。そのコミットはもう `main` の先端でなくてもよいが、`main` に含まれていなければならない。

   ```bash
   RELEASE_SHA="<release-preparation-commit-sha>"
   RELEASE_VERSION="X.Y.Z"
   git fetch --no-tags origin \
     "+refs/heads/main:refs/remotes/origin/main" &&
   git cat-file -e "${RELEASE_SHA}^{commit}" &&
   git merge-base --is-ancestor "$RELEASE_SHA" origin/main &&
   test "$(
     git show "${RELEASE_SHA}:core/tools/aidlc-version.ts" |
       awk -F'"' '/^export const AIDLC_VERSION = "/ { print $2 }'
   )" = "$RELEASE_VERSION" &&
   git tag "v$RELEASE_VERSION" "$RELEASE_SHA" &&
   git push origin "v$RELEASE_VERSION"
   ```

4. `Release` ワークフローを確認する。タグとソースを検証し、タグ付きコミットに対する Full Suite の合格を要求し（再利用または実行）、決定的なパッケージング、静的検査、ネイティブのスモークカバレッジ、クロスプラットフォームのビルド、インストーラーのライフサイクルテスト、チェックサム、来歴の検証を実行する。
5. GitHub Release にバイナリ、インストーラー、`aidlc-copy-runtime-X.Y.Z.tar.gz`、その `.sha256` sidecar、
   `aidlc-runtime-X.Y.Z.tar.gz`、`version.json`、`checksums.txt`、来歴の証明バンドルが含まれていることを確認する。

リリースの作成前に公開が失敗した場合は、失敗したワークフローを再実行します。
Full Suite の失敗は公開を止めます。不安定なテストが原因なら失敗したジョブを再実行し、そうでなければ失敗を修正して新しいリリースを準備します。
部分的に作成されたリリースがある場合は、調査して削除してから再実行します。
公開済みの成果物を通知なく差し替えてはいけません。新しいパッチリリースで修正してください。
