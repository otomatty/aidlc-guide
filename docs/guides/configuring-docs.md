# ステージ docs の接続先を設定する

> 対象: Confluence / Notion / GitHub など、社内ドキュメントへ「docs を開く」を向けたい人  
> 関連: [Dashboard で現在地と成果物を読む](./reading-workflow.md)

## このガイドでできるようになること

`aidlc-guide.config.json` でステージごとの開き先を決め、詳細パネルの **docs を開く** から所定ページへ飛ぶ。

## 設定ファイル

ワークスペースルートの [`aidlc-guide.config.json`](../../aidlc-guide.config.json)（全ステージのキーを同梱済み）。

| キー | 用途 |
|------|------|
| `docsRepoPath` | excerpt（docs 抜粋）を読むルート。相対パスは **config ファイルの場所** 基準 |
| `docsBaseUrl` | （任意）`stageDocs` が空のステージ向け。bridge-map の相対パスと結合するベース |
| `stageDocs` | ステージ slug → **絶対 URL**（`http(s)://…`）。空文字 = 未設定 |
| `projectLinks` | ヘッダーに出す追加リンク `{ "label", "target" }[]` |

変更後は拡張を Reload（または Dashboard を開き直し）すると `/api/docs-settings` 経由で反映されます。config はプロセス起動時に一度読まれます。

## 「docs を開く」の優先順位

1. `stageDocs[<slug>]` に非空の `http(s)` URL がある → それを開く（Confluence 向け）  
2. なければ `docsBaseUrl` + bridge-map の相対パス（GitHub blob など）  
3. どちらも無ければ、拡張内ではワークスペース上のファイルをエディタで開く  
4. ブラウザ副経路では 1 か 2 が無いとリンクが出ない

## ユースケース: Confluence

各ステージのページ URL を `stageDocs` に貼る。

```json
{
  "docsRepoPath": ".",
  "docsBaseUrl": null,
  "stageDocs": {
    "intent-capture": "https://confluence.example.com/wiki/spaces/AIDLC/pages/101/Intent+Capture",
    "code-generation": "https://confluence.example.com/wiki/spaces/AIDLC/pages/205/Code+Generation",
    "build-and-test": "https://confluence.example.com/wiki/spaces/AIDLC/pages/206/Build+and+Test"
  },
  "projectLinks": [
    { "label": "チーム wiki", "target": "https://confluence.example.com/wiki/spaces/AIDLC/overview" }
  ]
}
```

使わないステージは `""` のままで構いません。`http(s)` 以外の値は読み込み時に無視され、警告が付きます。

## ユースケース: GitHub 上の同一リポジトリ

全ステージを同じ tree に載せるなら `docsBaseUrl` だけで足りることがあります。

```json
{
  "docsRepoPath": ".",
  "docsBaseUrl": "https://github.com/ORG/REPO/blob/main/",
  "stageDocs": {},
  "projectLinks": []
}
```

個別に差し替えたいステージだけ `stageDocs` を書けば、そちらが勝ちます。

## 確認手順

1. config を保存する  
2. IDE で Reload Window（または Dashboard を閉じて開き直す）  
3. 任意のステージを開き **docs を開く** をクリック  
4. 期待どおりの Confluence / GitHub ページがブラウザ（またはエディタ）で開く

## うまくいかないとき

| 症状 | 確認すること |
|------|----------------|
| リンクが出ない | その slug の `stageDocs` が空で、かつ `docsBaseUrl` も null になっていないか（ブラウザ副経路） |
| 古い URL のまま | Reload したか。別ワークスペースの config を見ていないか |
| excerpt だけ出ない | `docsRepoPath` がディレクトリとして存在するか（開き先 URL とは独立） |
