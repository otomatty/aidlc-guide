# リリースのサプライチェーン

AI-DLC のリリースは、`awslabs/aidlc-workflows` の独立した 2 つのワークフローで作成します。
stable タグには `.github/workflows/release.yml`、定期実行または手動実行の preview には
`.github/workflows/preview-release.yml` を使います。どちらもリポジトリが提供する
`GITHUB_TOKEN` を使い、GitHub App、個人アクセストークン、別のリポジトリ、
リポジトリのシークレットは必要ありません。

## リリースの開始条件

厳密な `vX.Y.Z` 形式のタグをプッシュすると、リリースワークフローが始まります。
最初のジョブは、次の条件をすべて満たさなければリリースを拒否します。

- イベントの ref が、プッシュしたタグである。
- チェックアウトしたコミットが、タグの参照先である。
- タグの参照先が `main` に含まれている。
- タグが `v` と `core/tools/aidlc-version.ts` のバージョンを連結した値と一致する。

機能追加、修正、文書、リファクタリング、テストの PR では、リリースのメタデータを更新しません。
リリース準備の PR で、前回のリリース以降にマージされた利用者向けの変更をまとめ、
タグを作る前にバージョン、README のバッジ、変更履歴の項目を一緒に更新します。
ワークフローはソースファイルを変更しません。

## ビルドと検証

ワークフローは次の処理を行います。

1. すべてのハーネス向け配布物を再生成し、出力の決定性を検証する。
2. プロジェクトのテストスイート、型検査、lint、ShellCheck、PSScriptAnalyzer を実行する。
3. Linux、macOS、Windows 向けのネイティブバイナリをビルドする。
4. ネイティブ実行とインストーラーのスモークテストを実行する。
5. マニフェスト外の手動コピー用 `aidlc-copy-runtime-X.Y.Z.tar.gz` と `.sha256`、マニフェストに含むネイティブ用 `aidlc-runtime-X.Y.Z.tar.gz`、インストーラー、`version.json`、`checksums.txt` を作成する。
6. 一時配置したリリースファイルの一覧とチェックサムを検証する。

リリースマニフェストはタグ ref と正確なソースコミットを記録します。両アーカイブ名は版を含み、手動コピーは `aidlc-copy-runtime-X.Y.Z.tar.gz`、ネイティブインストーラーは `aidlc-runtime-X.Y.Z.tar.gz` を使います。2.8.x のクライアントが引き続き更新を発見できるよう、コピー版はマニフェストと主チェックサム一覧の外に置き、sidecar とリリースの出所証明で独立に認証します。

## 来歴の証明

`publish` ジョブは、ビルドとライフサイクルの各ジョブが成功してから
`id-token: write` と `attestations: write` を受け取ります。GitHub は一時配置した
成果物のビルド来歴を生成します。エクスポートした来歴の証明バンドルは
`aidlc-release.intoto.jsonl` として同梱します。

preview は Europe/Lisbon の毎日 22:00 の定期実行と手動実行に対応します。`release-preview` の同時実行制御で直列化し、実行中の処理は取り消しません。後続はリリース一覧を読み直し、最新プレビューと同じソースコミットならスキップします。同じ UTC 日付でも main が進めば次のカウンターで公開できます。

計画処理は `core/tools/aidlc-version.ts` の安定版 x.y.z を読み、`<x.y.(z+1)>-preview.<YYYYMMDD>.<N>` を割り当てます。UTC 日付と既存タグ・リリースが占有する id を使い、次の patch はメモリー内で計算します。ソースのリリース情報は編集しません。下書きや孤立タグの id も予約済みとして、再試行や同日の追加公開で飛び越します。残った `aidlc-staging-*` draft は、次の候補を配置する前に調査・削除が必要です。

計画処理は前回以降の変更からリリースノートを生成し、承認対象コミットを CI で検証してから通常のビルドへ渡します。`AIDLC_BUILD_VERSION` を介し、配布ツリー・バイナリ・`version.json`・両ランタイムアーカイブ・同梱インストーラーに preview id を埋め込みます。ソースの安定版番号は変更しません。同梱インストーラーは latest を再探索せず、その版を既定にします。公開処理は staging draft を検証し、ソース repo とコミットを記録した注釈付きタグを作り、`make_latest: false` で公開します。

stable は保護された `release` 環境、preview は必須レビュアーのない `preview` 環境で同じ main デプロイ方針を使います。マージ承認と呼び出し可能な CI が人間・決定的検証のゲートです。stable は別の同時実行グループです。preview は候補全体を staging してバイト照合してから公開し、リポジトリのリリースが mutable / immutable のどちらでも動作します。

対応する GitHub CLI が利用できる場合、インストーラーは証明バンドルを使って
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

それ以前のジョブの権限はすべて `contents: read` のままです。保存された認証情報に
リリースの書き込み権限を与えることはなく、環境のゲートを通る前に公開権限を受け取るジョブもありません。

## リリースを作成する

1. 次を更新する PR をマージする。
   - `core/tools/aidlc-version.ts`。
   - README のバージョンバッジ。
   - 対応する `CHANGELOG.md` の見出し。
2. 対応するタグを作成し、プッシュする。

```bash
git switch main
git pull --ff-only
git tag vX.Y.Z
git push origin vX.Y.Z
```

3. `Release` ワークフローを確認する。
4. GitHub Release にバイナリ、インストーラー、`aidlc-runtime-X.Y.Z.tar.gz`、
   `version.json`、`checksums.txt`、来歴の証明バンドルが含まれていることを確認する。

リリースの作成前に公開が失敗した場合は、失敗したワークフローを再実行します。
部分的に作成されたリリースがある場合は、調査して削除してから再実行します。
公開済みの成果物を通知なく差し替えてはいけません。新しいパッチリリースで修正してください。
