# Business Rules — Unit: btw

> functional-design (3.1) / Unit: btw / 2026-07-23
> 入力: requirements.md（FR-3, NFR-1/4）+ unit-of-work.md U3 + components.md C7 + team-practices.md 規約

## ルール一覧

| ID | ルール | 出所 |
|----|--------|------|
| BR-1 | 起動するサイドセッションは**常に** `--permission-mode plan`（読み取り専用）。plan 以外での起動経路を持たない | FR-3.1 / NFR-1（本線・成果物を汚さない保証） |
| BR-2 | `--fork` のセッション ID 解決は「`projectSlug(cwd)`（`\` `/` `:` `.` を `-` 置換 — business-logic-model.md の変換規則）で導いたディレクトリの最新 JSONL」1点のみ。複数候補の対話選択はしない（解決不能なら fail + 計算パス表示 + `/branch` 案内） | FR-3.2（解決を隠蔽）/ US-07 / E3 |
| BR-3 | help・fork 実行時の注意に **JSONL フラッシュ制約を必ず明記**し、文脈必須ケースは本線内 `/branch` を第一案内する | FR-3.4 / C-T5（解決不能な外部制約の受容） |
| BR-4 | OS 判定は `process.platform` のみ。パス処理は `node:path`、`path.sep` 決め打ち禁止 | NFR-4 / team.md Code Style |
| BR-5 | btw 自身は aidlc 配下・リポジトリに**一切書き込まない**（ログファイルも作らない。出力は stdout/stderr のみ） | NFR-1 / project.md Forbidden |
| BR-6 | 失敗は常に非ゼロ exit + 理由1行（スクリプトから判定可能に）。黙殺・部分成功の偽装をしない | Construction 規約（エラーの黙殺禁止） |

## バリデーション

- `-p` の質問文字列: 空なら usage を出して exit 1。シェルエスケープは spawn の引数配列渡しで回避（文字列連結でコマンドを組まない — インジェクション防止、Construction セキュリティ規約）。
- `--fork` と `-p` の同時指定: 未サポートとして usage + exit 1（組合せ爆発を避ける）。
