# Security Requirements — Unit: btw

> nfr-requirements (3.2) / Unit: btw / 2026-07-23
> 入力: business-rules.md（BR-1/5/6 + バリデーション）+ business-logic-model.md + requirements.md（NFR-1）+ project.md Mandated/Forbidden

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| S-BTW-1 | 起動する全セッションは `--permission-mode plan`（読み取り専用）。plan 以外の起動経路をコードに持たない（BR-1/NFR-1） | SpawnPlan 生成の unit テスト（args に必ず含まれる） |
| S-BTW-2 | spawn は**引数配列**のみ。シェル文字列連結でコマンドを組まない（`-p` のユーザー入力がシェルに解釈されない — コマンドインジェクション防止） | plan() テスト（特殊文字入りプロンプトで args が無傷） |
| S-BTW-3 | 書き込みゼロ: ファイル・環境・レジストリに一切書かない。読むのは `~/.claude/projects/` のファイル名と mtime のみ（JSONL の**内容は読まない** — 会話ログには機微情報があり得るため触れない） | resolve() 実装検査 + fs モックで write 呼び出しゼロ確認 |
| S-BTW-4 | 資格情報を扱わない・保存しない・ログしない（Claude CLI 自身の認証に委譲） | コードレビュー |
| S-BTW-5 | エラーメッセージにセッション内容を含めない（パス・ID のみ可） | エラーパステスト |

## 脅威メモ（軽量 — ローカル単一ユーザー CLI）

攻撃面は「`-p` 引数経由のインジェクション」1点が実質すべて（S-BTW-2 で遮断）。ネットワーク listen なし・特権不要・規制データなし（C-R1）。これ以上の統制（SAST 等）は practices-discovery の devsecops 判断どおり不採用（`bun audit` はローカルゲートで全 Unit 共通）。
