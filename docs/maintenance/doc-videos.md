# 公式ドキュメントの解説動画（メンテナ向け設計）

公式ドキュメント（日本語）の各ページに、ナレーション付きの約 3 分の解説動画を付ける仕組みの設計です。動画は本体の拡張に入れず、**データだけの別拡張（動画パック）**として配ります。

## 決定事項

| 項目         | 決定                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 対象         | 公式ドキュメントの日本語版。`guide` + `harness-engineering`（53 ページ）と `reference`（45 ページ）                                         |
| 長さ         | 要約で 1 本最大 3 分（台本は約 1,000 字まで）                                                                                               |
| 台本         | 英語の原文から、話し言葉の日本語で書く。日本語訳は用語をそろえるためだけに使う。Claude Code などのローカル AI CLI で作り、PR でレビューする |
| 音声         | Grok TTS（xAI）で字幕 1 つごとに WAV を作り、手元の ffmpeg で Ogg/Opus 12kbps モノラルにする。キーはメンテナの環境変数 `XAI_API_KEY` だけ   |
| 描画         | `packages/kamishibai`。絵は Webview の中で音声の再生位置に合わせてその場で描く。MP4 は同梱しない                                            |
| 配布         | 動画パックは別の拡張。日本語は `aidlc.aidlc-guide-videos-ja`（guide + harness-engineering）と、reference 用の別パックの 2 つ                |
| インストール | GitHub Releases から VSIX を手でダウンロードし、「VSIX からインストール」で入れる。本体から入れるコマンドは作らない                         |
| 信頼         | 発行者が `aidlc` のパックだけを読む。他の発行者のパックは受け付けない                                                                       |
| サイズ       | パック 1 つにつき 30MB 以下、1 ページ 330KB 以下                                                                                            |
| 保管         | 音声（`narration.opus`）は Git LFS。LFS が要るのはパックのビルドだけで、本体のビルドには要らない                                            |

## なぜこの形か

- **AAC は使えない。** VS Code の Webview は Wav・MP3・Ogg・Flac しか再生できず、AAC を再生できない。VS Code 内のブラウザも同じ Chromium で動くので、状況は同じ。Opus なら Webview の中で鳴る。
- **映像ファイルを持たない。** 1080p の MP4 だと 1 本 7〜15MB になる。絵コンテ・時刻表の JSON と音声だけなら 1 本約 280KB で済む。
- **本体と分ける。** 本体の VSIX を大きくせず、台本の手直しを本体のリリースと切り離すため。

## 動画パックの決まりごと

パックは `main` を持たない（コードを持たない）拡張です。`package.json` で次のように宣言します。

```jsonc
{
  "publisher": "aidlc",
  "name": "aidlc-guide-videos-ja",
  "extensionDependencies": ["aidlc.aidlc-guide"],
  "contributes": {
    "aidlcGuideVideoPacks": [
      { "id": "official-ja", "locale": "ja", "formatVersion": 1, "root": "media/videos" }
    ]
  }
}
```

`<root>/videos.manifest.json` にページの一覧を持ち、ページごとのディレクトリに決まった名前のファイル（`storyboard.json`、`timeline.json`、`narration.opus`、`captions.vtt`）を置きます。

検証と選択は `packages/official-docs/src/video-pack.ts` に集約しています。

| 関数                     | 役割                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `parsePackContributions` | 発行者の確認、宣言の形、未対応の `formatVersion` の判定                                      |
| `parseVideoPackManifest` | manifest の形、パス、ハッシュ、長さ、サイズの検証                                            |
| `videoFreshness`         | 本体が持つ英語原文のハッシュと比べて「古い」を判定する                                       |
| `selectVideo`            | 同じページを複数のパックが持つときの選び方。再生できる > 古くない > パックが新しい > ID の順 |
| `packBudgetViolations`   | サイズ予算の検査（パックのビルドで使う）                                                     |

本体はパックのコードを実行しません。描画の仕方は本体のテンプレートが決め、パックは文字・数値・音声だけを渡します。ファイルの読み込みはすべて、パックの `root` を基準に `guardPath` を通します。

## 本体のリリースとの関係

本体の更新確認は `releases/latest` を見て、`v<version>` というタグと `aidlc-guide-<version>.vsix` を探します（`packages/vscode-extension/src/update-release.ts`）。パックのリリースが「最新」になると本体の更新確認が壊れるので、パックは必ず次の形で出します。

- タグは `videos-ja-v*`
- `gh release create --latest=false` で作る

## 構成

| 場所                                                           | 役割                                                                                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/kamishibai`                                          | 描画エンジンとテンプレート（`title`・`points`・`flow`）。`storyboard.json` と `timeline.json` から動画を組み立てる（`loadVideo`）              |
| `packages/official-docs/src/video-pack.ts`、`video-library.ts` | パックの検証・選択と、`guardPath` を通したパックの読み込み                                                                                     |
| `packages/api-core`                                            | `GET /api/official-docs/:locale/videos/<docPath>`。本体が `videoPacks`（入っているパック）と `mediaUrl`（Webview で読める URL への変換）を渡す |
| `packages/vscode-extension/src/video-packs.ts`                 | 入っている拡張からパックを見つける。Webview はパックの `media/videos` だけを読める（`localResourceRoots`、CSP の `media-src`）                 |
| `packages/dashboard/src/features/docs/components/video`        | Docs 画面の動画カードとプレイヤー（プレイヤーは別チャンクで、押したときに読み込む）                                                            |
| `packages/doc-video`                                           | メンテナ用の CLI（時刻表・字幕・音声・パックの組み立て）。VSIX には入らない                                                                    |
| `packages/video-pack-ja`                                       | 日本語パック（guide + harness-engineering）の拡張。中身は `docs/videos/ja` から組み立てる                                                      |
| `docs/videos/<locale>/<section>/<page>/`                       | ページごとの原本：`script.md`（レビュー用の台本）、`storyboard.json`、`timeline.json`、`narration.opus`（Git LFS）、`captions.vtt`             |

## 使い方（メンテナ）

```bash
# 仮音声（字幕の頭で鳴るビープ音）で時刻表・字幕・音声を作る（TTS 導入前の確認用。ffmpeg が必要）
bun run video placeholder docs/videos/ja/guide/04-phases-and-stages

# パックの原本を検査する（bun run check にも含まれる）
bun run check:video-packs

# 日本語パックの VSIX を作る（音声の実体が要るので、先に git lfs pull）
bun run package:video-pack-ja
```

`narration.opus` がまだ無いページは**下書き**として扱います。台本と絵コンテは検査しますが、パックには入りません（台本を PR でレビューしてから音声を作る手順のため）。検証用サンプル `guide/04-phases-and-stages` も今は下書きで、手元で `bun run video placeholder` を実行すると仮音声ができてパックに入ります。

できた `packages/video-pack-ja/aidlc-guide-videos-ja-<version>.vsix` を「VSIX からインストール」で入れ、AIDLC Guide の Docs 画面で対象ページを開くと、本文の上に「解説動画」が出ます。

## 進め方

| 段階 | 内容                                                                                                                                                                           | 状態                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| P0-a | Kamishibai の TypeScript 化（`packages/kamishibai`）                                                                                                                           | 済み                           |
| P0-a | パックの決まりごとの型と検証（`video-pack.ts`）                                                                                                                                | 済み                           |
| P0-b | Grok TTS の声と音質のサンプル（1 ページ）                                                                                                                                      | 未着手（`XAI_API_KEY` が必要） |
| P0-c | 最小のパック拡張を作り、本体が見つけて Webview で再生できるか確かめる（VS Code と Cursor）                                                                                     | 実装済み。実機での確認待ち     |
| P1   | 作成用の CLI（`packages/doc-video`）の全段階。検証用の 3 ページ（`guide/00-introduction`、`guide/02-your-first-workflow`、`guide/04-phases-and-stages`）で作成から再生まで通す | 未着手                         |
| P2   | パックのリリース workflow、全ページへの展開                                                                                                                                    | 未着手                         |
