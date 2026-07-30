# Intent Capture & Framing — 質問ファイル

> ステージ: intent-capture (Ideation 1.1) / 深度: Standard / スコープ: feature  
> 対象: AIDLC Guide のドキュメント機能を「外部参照なし・完全内蔵」へ寄せる変更  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。

---

## Q1. 解決したい問題

いまのドキュメント機能で、いちばん解消したい痛みはどれですか？

- A. Confluence / Notion / GitHub など外部 URL（`stageDocs` / `docsBaseUrl`）への依存をやめたい
- B. 別 clone の公式 docs リポジトリ（`docsRepoPath`）を用意しなくてよいようにしたい
- C. ブラウザ副経路でも「docs を開く」が外部設定なしで動くようにしたい
- D. 上記すべて（外部参照を廃し、開き先・excerpt・解説を内部だけで完結させたい）
- X. その他（具体的に記入）

[Answer]:

## Q2. 誰のための変更か

この変更の第一受益者は誰ですか？

- A. 初学者エンジニア（ステージ解説・docs 抜粋が設定なしで読める）
- B. ツール利用者全般（拡張・MCP・ブラウザ副経路のどこでも同じ内蔵 docs）
- C. モブ参加者（ブラウザ副経路で外部 URL 設定なしに docs を開ける）
- D. メンテナー（docs の編集・同期をこのリポジトリ内だけで完結させたい）
- X. その他（具体的に記入）

[Answer]:

## Q3. 「内蔵」の範囲

ドキュメント本文（excerpt / 開き先）をどこまで内蔵しますか？

- A. ワークスペース内の既存パスのみ（`.claude/aidlc-common/stages/…` を常に開く・読む。外部 URL 設定は削除）
- B. 拡張 / パッケージにステージ Markdown を同梱し、ワークスペース外でも excerpt が読める
- C. A を必須とし、B は余裕があれば（同梱は Should）
- X. その他（具体的に記入）

[Answer]:

## Q4. 既存設定の扱い

`aidlc-guide.config.json` の外部向けキー（`stageDocs` / `docsBaseUrl` / 外部向け `projectLinks`）をどうしますか？

- A. 削除する（設定ファイルからキー自体をなくす）
- B. 読み込みは残すが無視する（後方互換の死コード期間を短く取る）
- C. 内部パス専用に再定義する（`docsRepoPath` はワークスペースルート固定、`projectLinks` は相対パスのみ許可）
- X. その他（具体的に記入）

[Answer]:

## Q5. 成功の定義

この変更が成功したと言える状態はどれですか？（複数選択可）

- A. 外部 URL を一切設定しなくても「docs を開く」が全サーフェス（拡張 / ブラウザ）で動く
- B. excerpt（該当箇所抜粋）が設定なしで常に表示される
- C. `docs/guides/configuring-docs.md` が「内部管理」手順に書き換えられている
- D. PRD FR-5.2（外部 docs リポジトリパス指定）が内部管理前提に更新されている
- E. 既存の bridge-map 解説（目的・入出力・ゲート）はそのまま活かし、開き先だけを内部化する
- X. その他（具体的に記入）

[Answer]:

## Q6. やらないこと（スコープ外）

今回やらないことを確認します。どれをスコープ外としますか？（複数選択可）

- A. aidlc-workflows 本体（`.claude/` エンジン）の改修
- B. 新しいドキュメント編集 UI（WYSIWYG で公式 docs を書く機能）
- C. Confluence / Notion への双方向同期
- D. 上記すべてをスコープ外とする
- X. その他（具体的に記入）

[Answer]:

---

## Consolidated Summary Confirmation

全回答の要約を提示し、アーティファクト生成前の確認を求める。

（回答収集後に記入）

選択肢:
- Looks correct: この回答からアーティファクトを生成する
- Request changes: 生成前に回答を修正する

[Answer]:
