# 依存更新と品質チェック

## 開発時のコマンド

`bun install --frozen-lockfile` で依存を導入します。Bun の版はルートの
`package.json` の `packageManager` に固定し、すべての workflow がそこを読みます。

| コマンド                | 内容                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- |
| `bun run check`         | CI と pre-push が呼ぶ品質ゲートの全体                                           |
| `bun run lint`          | oxlint（dashboard は @shadcn/lint 含む）、canonical Tailwind クラス、actionlint |
| `bun run lint:fix`      | oxlint の安全な自動修正                                                         |
| `bun run format`        | oxfmt による整形                                                                |
| `bun run format:check`  | oxfmt の整形検査                                                                |
| `bun run typecheck`     | 全パッケージの型チェック                                                        |
| `bun run test:coverage` | Vitest と既存のカバレッジ基準                                                   |
| `bun run audit`         | bun.lock の既知の脆弱性を監査                                                   |

検査コマンドはソースを書き換えません。oxlint と canonical Tailwind クラス検査の
error は失敗します。warning は残していません。Tailwind IntelliSense の
`suggestCanonicalClasses`（`break-words` → `wrap-break-word`、
`data-[parked]:hidden` → `data-parked:hidden` など）はエディタでも error です。
自動修正は `lint:fix` または `format` を明示的に実行します。
`format` は Lint の修正を行わないため、必要なら両方を実行してください。
`.vscode/settings.json` と `.editorconfig` が保存時の設定を共有します。

Lint は oxlint（`.oxlintrc.json`）が担当します。パッケージごとの `node:fs` 書き込み禁止
（`no-restricted-imports`）と dashboard の `@shadcn/lint` ルールもここにあります。
canonical Tailwind クラス（`scripts/check-canonical-classes.ts`）は、値が無い
`data-[name]:` と `break-words` / `order-none` / `max-w-[calc(100vw-2rem)]` /
`min-w-[96px]` / `grid-cols-[1fr_auto]` / `[&_[data-slot=…]]:` を拒否します。
整形はコード・JSON・CSS・自前の Markdown・YAML のすべてを oxfmt（`.oxfmtrc.json`）が担当します。
oxfmt は Prettier 互換の出力で、コード・JSON・CSS は Rust 実装、Markdown・YAML は同梱の Prettier に委譲します。
対象範囲は `.oxfmtrc.json` の `ignorePatterns` が定義します。対象はコード全般に加えて `.github/` の YAML、
ルートと packages の README、`docs/guides/`、`docs/maintenance/` です。
上流ミラー、生成物、テストフィクスチャ、AI-DLC の記録は整形しません。
Markdown 内のコードフェンスも oxfmt では書き換えません（`embeddedLanguageFormatting: off`）。
エディタでは oxc 拡張（`oxc.oxc-vscode`）が同じ設定で保存時整形を行い、Biome / Prettier 拡張は
`.vscode/settings.json` でワークスペース内では無効にしています。

actionlint は `scripts/actionlint-release.json` に版と OS 別 SHA-256 を固定しています。
初回は公式 GitHub Release から取得し、`node_modules/.cache/actionlint/` に保存します。
キャッシュも毎回検証し、一時ディレクトリへ展開して実行します。Windows/macOS/Linux の
x64/arm64 と、それぞれに付属する `tar` を使います。初回取得にはネットワークが必要です。
PATH にあるツールによって検査が変わらないよう、任意の ShellCheck/Pyflakes 連携は無効です。

actionlint 1.7.12 は GitHub の `concurrency.queue` に未対応です。
[upstream issue #680](https://github.com/rhysd/actionlint/issues/680) が解決するまで、
ラッパーが workflow/job の両方で値を検証し、そのキーの未対応エラーだけを除外します。
`single`/`max` 以外の値と、`max` とキャンセルの併用は失敗します。他の構文エラーは除外しません。

## Dependabot

`.github/dependabot.yml` は Bun と GitHub Actions を毎週火曜 09:30 JST に確認します。
公開後7日の待機期間を設け、同時に開く通常更新 PR は Bun 5件、Actions 2件までです。
React・テスト・Tailwind・整形ツールの minor/patch を関連グループで更新し、major は個別にレビューします。
自動承認・自動マージは行いません。

Bun の PR は `dependencies`、Actions の PR は `dependencies` と `release:skip` を付けます。
両ラベルを先にリポジトリへ作成してください。存在しないカスタムラベルは Dependabot に無視されます。
`release:skip` がなければ Actions の更新も既定の patch リリースになります。

```powershell
gh label create dependencies --color 0366d6 --description "Dependency updates" --repo otomatty/aidlc-guide
gh label create release:skip --color 6e7781 --description "Merge without releasing a new version" --repo otomatty/aidlc-guide
```

既にあるラベルの作成エラーは無視できます。整形・テストツールだけの Bun 更新は、差分を確認して
`release:skip` に変更できます。Vite/esbuild など配布物を変える依存は devDependencies でも出荷対象です。
依存の major 更新は、本製品の `release:major` を自動的に意味するものではありません。
本製品の公開契約が変わるかでリリースラベルを決めます。

2026-09-07 時点で、[Dependabot は Bun の通常更新に対応し、セキュリティ更新には未対応](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories#bun)です。
`dependency-audit.yml` は毎日 09:43 JST と手動実行で `bun run audit` を実行します。
通常の品質ゲート内の監査も継続します。監査が失敗したら Actions のログで対象を確認し、
修正版を明示的に選んで更新 PR を作成し、`bun run check` を通してください。
定期実行が知らせるのは検出結果で、自動修正 PR ではありません。Actions の通知設定も確認してください。

root `package.json` の `overrides` は脆弱性対策などの例外です。依存更新時には元の依存が修正済みかを確認し、
不要になった override を削除してロックファイルと監査を再確認します。例外を増やす場合は PR に理由を記録します。
oxlint 更新時は新規に有効になるルールの指摘を同じ PR で確認してください。
Bun 本体と actionlint の版は Dependabot の更新対象外です。更新時は公式リリースを確認し、
Bun は `packageManager`、actionlint は版と全対象 OS の公式チェックサムを一緒に変更します。

## shadcn のスタイルシートを手元に固定する

Dashboard が npm パッケージ `shadcn` 4.21.0 から読んでいたファイルは `dist/tailwind.css` です。
`exports["./tailwind.css"]` がこのファイルを指し、`globals.css` は `shadcn/tailwind.css` として
import していました。CLI のコマンドはスクリプトからも画面のソースからも呼んでいません。
コンポーネントのソースは `packages/dashboard/src/shared/ui` にあり、`components.json` はスタイルの
記録として残します。`@shadcn/react` と lint の `@shadcn/lint` は別パッケージなので依存に残します。

`shadcn@4.21.0` は `fast-glob` と `micromatch` を経由して `braces@3.0.3` を引き込みます。
`braces` 3.0.3 以下は [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
（CVE-2026-93687）の対象です。深くネストしたブレースパターンで再帰がスタックを使い切り、プロセスが
終了します。修正済みの版はありません。このロックファイルで `braces` へ到達する経路は、この CLI だけでした。

対処は、ロック済み 4.21.0 の `dist/tailwind.css` と MIT ライセンスをリポジトリに置き、`shadcn` 依存を
消して `bun.lock` を更新することです。root の `overrides` と監査の抑制は使いません。画面・文言・通知は
変わらないので、更新情報の追記は不要です。

| パス                                                                     | 役割                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/dashboard/src/shared/styles/vendor/shadcn-4.21.0/tailwind.css` | `dist/tailwind.css` のバイトコピー。SHA-256 `bc7d83425702955b4cb67cb14ede9d603f9d912376d57a2d81d661094d2a782a`                                                                          |
| 同じディレクトリの `LICENSE.md`                                          | パッケージ同梱の MIT ライセンス。本文は変えない                                                                                                                                         |
| 同じディレクトリの `PROVENANCE.md`                                       | 版、npm integrity、両ファイルの SHA-256                                                                                                                                                 |
| ビルド出力の `shadcn-4.21.0-LICENSE.md`                                  | `vite build` が `LICENSE.md` をバイトのまま出す。通常ビルドは `packages/dashboard/dist`、webview ビルドは `packages/vscode-extension/media/dashboard`。後者は VSIX の `media/**` に入る |

`globals.css` はこのローカル CSS を `@import` します。置き場所のディレクトリ名に `dist` は使いません。
`.gitignore` がその名前を無視し、コミットから漏れるためです。出所のパスは PROVENANCE に記録します。

`.oxfmtrc.json` の `ignorePatterns` はこの CSS を整形から外しています。整形や手編集をするとバイト一致の
検証が落ちます。

取り直すときは同じ変更に次を含めます。

1. 新しい版の `dist/tailwind.css` と `LICENSE.md` をバイトのまま置き、PROVENANCE の integrity と SHA-256 を更新する。`shadcn` を依存へ戻すのは、その版の推移的依存に脆弱な `braces` が無いことを `bun pm why braces` と `bun audit` で確認してからです。
2. `packages/dashboard/src/shared/styles/shadcn-tailwind.test.ts` の variant、keyframes、ハッシュの期待値を合わせる。
3. `bun install` の差分が、意図したパッケージの削除に収まっていることを見る。範囲外の依存は上げません。
4. `bun run build:dashboard` と `bun run build:dashboard:webview` の CSS を変更前の本番出力と比べ、両方の出力に `shadcn-4.21.0-LICENSE.md` があることを確認する。

## main の保護を有効にする

必須チェックは 3 OS の `check`、3 OS の `doctor-contract`、`workflows-compatibility`、`release-labels` の8つです。2026-09-16 時点では、専用 App の Actions variable / secret と main の ruleset は未設定です。テンプレートを更新しただけではマージを防止しません。

現在の自動バージョン更新は main へ2ファイルを直接 push します。保護だけを先に有効にすると出荷が止まります。
この変更は専用 GitHub App を使う経路とルールのテンプレートを用意します。App を作成するまでは
従来の `GITHUB_TOKEN` を使用し、保護ルールの有効化は行いません。

1. main に専用 App を使うリリース経路と必須チェックのワークフローが導入済みであることを確認します。
   PR のリリースラベルは変更内容に従って選びます。App の準備だけを理由に `release:skip` へ変更する必要はありません。
2. GitHub の個人設定で、このリポジトリ専用の GitHub App を作成します。Webhook は無効、
   Repository permissions は Contents の Read and write のみとし、Metadata の Read は既定のままにします。
   このアカウントだけにインストール可能とし、インストール対象は `otomatty/aidlc-guide` だけに限定します。
3. Client ID をリポジトリの Actions variable `RELEASE_APP_CLIENT_ID` に登録し、生成した秘密鍵を
   Actions secret `RELEASE_APP_PRIVATE_KEY` に登録します。ルールに使う数値の App ID も控えてください。Client ID・App ID・Installation ID は別の値です。
   秘密鍵を Git に保存しないでください。
4. 次の実際のリリースで `Create the release App token` と push/publish の成功を確認します。
   App のトークンは push ジョブだけが保持し、Bun やプロジェクトのスクリプトを実行するジョブには渡しません。
5. 下記のテンプレートへ App ID を埋め、保護ルールを適用します。
6. 次の PR で8つの必須チェックが揃うまでマージできないことと、リリースのバージョン更新が
   App による例外として成功することを確認します。

App の push は追加の workflow を起動します。バージョン更新は既存の変更済み判定により再 bump せず、
公開はタグ単位で直列化し、公開済み Release を再作成しません。
`RELEASE_APP_CLIENT_ID` を設定した後に鍵が欠落・不正なら、トークン作成を失敗させます。

`main-quality` は PR と8つのチェックを必須にします。個人開発で自分の PR を承認できないため、
承認者数は0です。レビューコメントの解決と squash merge を必須にし、main の最新変更に対して検査します。
バイパスは専用 App だけに付与します。GitHub Actions 全体や管理者を例外に追加しません。
GitHub のバイパス自体は変更ファイルを制限しないため、App の秘密鍵と push ジョブの変更もレビュー対象です。

`main-history` は例外なしで削除と force-push を禁止します。専用 App にも適用されます。
チェックの `integration_id: 15368` は検査を実行する GitHub Actions の ID です。
`bypass_actors[0].actor_id` に入れる自分の App ID とは別の値です。

```powershell
# App の設定と実際のリリース成功を確認した後に実行します。
$releaseAppId = 123456 # 自分の App ID に置換
$qualityRule = Get-Content -Raw .github/rulesets/main-quality.json | ConvertFrom-Json
$qualityRule.bypass_actors[0].actor_id = $releaseAppId
$qualityRule | ConvertTo-Json -Depth 20 | gh api --method POST repos/otomatty/aidlc-guide/rulesets --input -
gh api --method POST repos/otomatty/aidlc-guide/rulesets --input .github/rulesets/main-history.json
gh api repos/otomatty/aidlc-guide/rules/branches/main
```

テンプレートの App ID `0` は置換必須の未設定値です。テンプレートをそのまま適用しないでください。
上記は初回作成用です。再適用時は `gh api repos/otomatty/aidlc-guide/rulesets` で名前と ID を確認し、
同名ルールの `/rulesets/ID` に `PUT` して更新してください。重複したルールを作成しないでください。

障害時は `main-quality` の該当 ID を確認し、一時的に無効化してから原因を修正します。
`main-history` の force-push/削除禁止は維持してください。

```powershell
gh api --method PUT repos/otomatty/aidlc-guide/rulesets/QUALITY_RULE_ID -f enforcement=disabled
```
