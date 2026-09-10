# はじめに — インストールから初回 Setup まで

> 対象: 初めて AIDLC Guide を使う開発者  
> 関連: [Dashboard で現在地と成果物を読む](./reading-workflow.md) · [調べ物は MCP / btw に逃がす](./side-questions.md)

## このガイドでできるようになること

1. VS Code / Cursor に拡張を入れる
2. 開発するフォルダで AI-DLC をセットアップする
3. Dashboard を開いて「今いるステージ」が見える

## 前提

| 項目           | 内容                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| IDE            | VS Code または Cursor                                                                                             |
| ワークスペース | 開発するフォルダ。AI-DLC 未導入でもセットアップ画面から設定できます。State Version **8** が対象、**7** は閲覧互換 |
| bun            | MCP / `btw` / LAN 共有で使う。Dashboard 表示だけなら拡張ホストの Node で足りる                                    |
| ビルド成果     | 開発者なら `bun run package:extension` で作った `.vsix`                                                           |

インテントがまだ無い場合、Dashboard は空状態とインテント一覧を出します。`/aidlc` で最初のインテントを作ってから再開してください。

## 手順

### 1. 拡張を入れる

リポジトリを clone したうえで:

```bash
bun install
bun run package:extension
```

期待される結果: `packages/vscode-extension/aidlc-guide-0.1.0.vsix` ができる。

**VS Code**

```bash
code --install-extension packages/vscode-extension/aidlc-guide-0.1.0.vsix
```

**Cursor** — コマンドパレット → _Extensions: Install from VSIX…_ → 上記 `.vsix` を選ぶ。

入れ直したあとは **Developer: Reload Window** を一度実行する。

開発中だけなら F5（Extension Development Host）でもよい。その場合は `bun run build:extension` で足り、VSIX は不要です。

### 2. ワークスペースを開く

開発するフォルダをルートとして開きます。`aidlc/` は事前に用意しなくても構いません。既存プロジェクトは `aidlc/` があるルートを開いてください。複数フォルダのワークスペースでは先頭のフォルダが対象です。

### 3. Setup を実行する（初回 1 回）

1. 未設定のフォルダでは、セットアップ画面が自動で開きます。
2. 利用するツールを選び、「インストールして設定」をクリックします。本体がある場合は「このプロジェクトを設定」と表示されます。
3. Claude Code / Cursor から公式ドキュメントを参照したい場合は「文書参照を有効にする」をクリックします。Bun が必要な任意の設定です。
4. 画面下部の完了ボタンでダッシュボードへ進みます。Intent がまだなくても完了できます。

初回導入では公式 2.8.1 のインストーラーで本体をユーザー領域に配置し、`aidlc config` で選択したツール向けの設定を作成します。インストール済みの本体は再利用します。設定後の診断で追加対応が必要な場合は、実行結果に表示されます。既存の設定との競合や実行中ワークフローによる拒否は、強制上書きせずそのまま表示します。

文書参照を登録した場合は Claude Code / Cursor の AI セッションを再起動してください。本体の導入には Bun / Node.js は不要です。

完了状態はフォルダごとに記録され、次回は自動表示しません。文書参照をスキップしても完了できます。途中で画面を閉じただけの場合は次回に再表示します。手動で開くにはコマンドパレットの **`AIDLC Guide: Setup`** を使います。

MCP だけ後から入れたいときは **`AIDLC Guide: Register MCP`** でも同じマージができます。

### 4. Dashboard を開く

次のいずれか:

- コマンドパレット → **`AIDLC Guide: Open`**
- ステータスバーの `AIDLC Guide` / 現在ステージ名をクリック

期待される結果: Webview にヘッダー・Now strip・ステージ一覧・成果物マトリクスが出る。

## うまくいかないとき

| 症状                         | 確認すること                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| まだ Intent がない           | 設定は完了できます。利用するツールのチャットで `/aidlc`、Codex では `$aidlc` から開始します |
| 設定ボタンが押せない         | ワークスペースが制限モードの場合は、VS Code の信頼設定を確認します                          |
| インストール・設定に失敗する | 「実行結果・診断の詳細」を確認します。公式手順へのリンクも利用できます                      |
| Dashboard が真っ白 / 古い UI | VSIX を入れ直して Reload Window                                                             |
| bun が無いと怒られる         | MCP / btw / LAN 用。パスに `bun` があるか `bun --version`                                   |

## 次に読む

- 画面の見方 → [Dashboard で現在地と成果物を読む](./reading-workflow.md)
- Confluence などに docs を繋ぐ → [ステージ docs の接続先を設定する](./configuring-docs.md)
- モブで見せる → [Live Share 運用](./live-share.md) / [ブラウザ / LAN](./browser-dashboard.md)
