# Security Design — Unit: btw

> nfr-design (3.3) / Unit: btw / 2026-07-23
> 入力: nfr-requirements/security-requirements.md（S-BTW-1〜5）+ functional-design/business-rules.md

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| S-BTW-1（常に plan） | `basePlanArgs = ["--permission-mode","plan"]` を単一定数にし、全 SpawnPlan 生成関数がこれを必ず連結（テストは定数の包含を全モードで検証）。plan なしの spawn 関数を作らない |
| S-BTW-2（インジェクション防止） | `Bun.spawn([cmd, ...args])` の配列 API のみ使用。`shell: true` 相当・テンプレート文字列でのコマンド組み立てをコード規約で禁止（Biome の `noGlobalEval` 系 + コードレビュー）。Windows の `cmd /c start` 経路はユーザー入力を渡さない構造（渡すのはセッション ID = FS 由来のみ）+ R-BTW-4 のメタ文字スモーク |
| S-BTW-3（書込ゼロ・内容非読取） | fs API は `readdir`/`stat`/`which` のみ import。write 系 API の import を Biome の restricted-imports で検知（構造的禁止） |
| S-BTW-4（資格情報非関与） | 環境変数の読取・転送をしない（子プロセスは環境を継承するだけで btw は触れない） |
| S-BTW-5（エラーに内容を含めない） | エラーメッセージ組み立てをヘルパー1関数に集約し、引数型を `{path?, reason}` に制限（セッション本文を渡せない型設計） |

## 信頼境界

ユーザー入力（`-p` プロンプト・cwd）→ btw → Claude CLI。btw は入力を解釈せず引数配列で透過。listen なし・特権なし。
