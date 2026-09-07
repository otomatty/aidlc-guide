# AI-DLC の質問を内蔵文書で調べる

AIDLC Guide の「Register MCP」または Setup の「MCP と文書参照 Skill を登録」を実行し、Claude Code / Cursor の AI セッションを再起動します。

「AI-DLCとは」「承認ゲートでセンサーが失敗したらどうする？」「BoltとUnit of Workの違いは？」と質問すると、参照用 Skill が内蔵文書を検索し、該当する節の原文を読んで回答するよう案内します。回答には文書名、節名、同梱版、参照リンクを表示します。AI-DLC の intent をまだ作成していなくても検索できます。

自動選択はホストのモデルと Skill / MCP の有効化状態に依存します。文書を参照せず回答する場合は `/aidlc-guide-docs` で参照用 Skill を明示的に呼び出せます。ネットワーク検索や外部モデルへの問い合わせは検索サーバー側では行いません。

## 登録するもの

| 場所 | 内容 |
| --- | --- |
| `.mcp.json` | Claude Code の `aidlc-guide` MCP |
| `.cursor/mcp.json` | Cursor の同じ MCP |
| `.claude/skills/aidlc-guide-docs/SKILL.md` | Claude Code の自動参照手順 |
| `.cursor/skills/aidlc-guide-docs/SKILL.md` | Cursor の同じ手順 |

他の MCP 登録は保持します。参照用 Skill を利用者が編集した場合、再登録で上書きせず、該当パスを表示して登録を中断します。同梱の Skill 原本は `packages/mcp-server/skills/aidlc-guide-docs/SKILL.md` です。

## 検索と出典

`aidlc_docs_search` は既定で上位5件を返し、JSON 応答全体を推定800トークンに収めます。`aidlc_docs_read` は選択した節の原文を一度だけ返し、既定の推定上限は1,600トークンです。これらはモデル固有の正確なトークン数ではありません。

`source` に文書名、見出し階層、同梱版、原文ハッシュ、行範囲、参照 URL が入ります。英語原文のリンクは同梱時の upstream SHA に固定します。日本語訳と、このリポジトリ独自の案内ページはローカルファイルを参照します。

長い節は段落・表・コードブロックの境界でページ分割します。`truncated` と `nextCursor` がある場合は、同じ ID で続きを取得します。単一の表などが予算を超えると本文を途中で切らず `requiredTokens` を返します。最大指定値は24,000です。それでも読めない場合は全文を確認したと主張せず、ローカルファイルで確認します。子節の一覧は `mode="outline"` で取得できます。

用語集などの表は、行ごとにも検索できます。該当行を元の列見出しと一緒に取得するため、一つの定義を調べる際に表全体を読む必要はありません。`source.contextLines` が列見出しの位置を示します。

RFC と research 配下の調査資料は既定の検索対象外です。`include_non_normative=true` で明示的に検索でき、結果には文書種別が付きます。検索で根拠が見つからない場合は未確認と回答し、仕様や出典を推測で補いません。

## CLI で使う

ソース checkout のルートで実行します。

```powershell
bun packages/official-docs/src/cli.ts search "承認ゲートでセンサーが失敗した場合"
```

検索結果の `id` を `read` に渡します。

```text
bun packages/official-docs/src/cli.ts read "検索結果のid"
```

`--root` には `docs/` を含む配布ルートを指定できます。指定しなければ、コマンドの配布場所から同梱文書を解決します。インストール済み拡張では `dist/aidlc-docs.mjs` を Bun で実行できます。

## 索引と翻訳の更新

英語原文の同期コマンドは索引も再生成します。文書を直接編集した場合は次を実行してください。

```powershell
bun run build:docs-index
bun run check
```

索引は `docs/official-docs.index.json` に保存します。同期 PR と VSIX の両方に含まれ、品質ゲートが再生成結果との差分を検出します。原文取得時にも manifest と本文のハッシュを照合し、不整合があれば引用を拒否します。

日本語訳の確認情報は `docs/official-docs.translations.json` に保存します。キーは `guide/00-introduction.md` などの言語を含まない文書パス、値は `{ "enHash": "確認した英語原文のSHA-256", "jaHash": "確認した訳文のSHA-256" }` です。人が訳を確認してから両方のハッシュを記録し、索引を再生成してください。先頭の BOM を除去した UTF-8 本文を、改行変換せずハッシュ化します。

確認情報がない訳は未確認、記録とハッシュが違う訳は古いものとして扱います。その場合、検索・引用は英語原文にフォールバックし、回答を日本語で説明します。初期の確認表は空で、既存訳を自動的に確認済みとすることはありません。
