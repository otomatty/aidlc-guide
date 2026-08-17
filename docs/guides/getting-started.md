# はじめに — インストールから初回 Setup まで

> 対象: 初めて AIDLC Guide を使う開発者  
> 関連: [Dashboard で現在地と成果物を読む](./reading-workflow.md) · [調べ物は MCP / btw に逃がす](./side-questions.md)

## このガイドでできるようになること

1. VS Code / Cursor に拡張を入れる  
2. `aidlc/` があるワークスペースで Setup を通す  
3. Dashboard を開いて「今いるステージ」が見える

## 前提

| 項目 | 内容 |
|------|------|
| IDE | VS Code または Cursor |
| ワークスペース | aidlc-workflows **2.6.2**（State Version **8**）で `aidlc/` があること。State Version **7** は閲覧互換。それ以外は解析不可 |
| bun | MCP / `btw` / LAN 共有で使う。Dashboard 表示だけなら拡張ホストの Node で足りる |
| ビルド成果 | 開発者なら `bun run package:extension` で作った `.vsix` |

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

**Cursor** — コマンドパレット → *Extensions: Install from VSIX…* → 上記 `.vsix` を選ぶ。

入れ直したあとは **Developer: Reload Window** を一度実行する。

開発中だけなら F5（Extension Development Host）でもよい。その場合は `bun run build:extension` で足り、VSIX は不要です。

### 2. ワークスペースを開く

`aidlc/` と（任意で）`aidlc-guide.config.json` があるフォルダをルートとして開く。  
サブフォルダだけを開くとアクティブインテントを見つけられないことがあります。

### 3. Setup を実行する（初回 1 回）

1. コマンドパレット（Windows: `Ctrl+Shift+P` / macOS: `Cmd+Shift+P`）  
2. **`AIDLC Guide: Setup`**  
3. 表示されたチェック（bun・Intent など）を確認する  
4. 「MCP をこのワークスペースに登録」を押す（Claude Code で MCP を使う場合）

期待される結果: プロジェクトの `.mcp.json` に `aidlc-guide` がマージされる。Claude Code を再起動すると `/mcp` にサーバが現れる。

MCP だけ後から入れたいときは **`AIDLC Guide: Register MCP`** でも同じマージができます。

### 4. Dashboard を開く

次のいずれか:

- コマンドパレット → **`AIDLC Guide: Open`**
- ステータスバーの `AIDLC Guide` / 現在ステージ名をクリック

期待される結果: Webview にヘッダー・Now strip・ステージ一覧・成果物マトリクスが出る。

## うまくいかないとき

| 症状 | 確認すること |
|------|----------------|
| Setup で Intent が ✖ | `aidlc/spaces/*/intents/` にレコードがあるか。ちょうど 1 件なら `active-intent` が無くても有効になる |
| Dashboard が真っ白 / 古い UI | VSIX を入れ直して Reload Window |
| bun が無いと怒られる | MCP / btw / LAN 用。パスに `bun` があるか `bun --version` |

## 次に読む

- 画面の見方 → [Dashboard で現在地と成果物を読む](./reading-workflow.md)  
- Confluence などに docs を繋ぐ → [ステージ docs の接続先を設定する](./configuring-docs.md)  
- モブで見せる → [Live Share 運用](./live-share.md) / [ブラウザ / LAN](./browser-dashboard.md)
