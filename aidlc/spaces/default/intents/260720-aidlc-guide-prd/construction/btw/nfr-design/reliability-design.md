# Reliability Design — Unit: btw

> nfr-design (3.3) / Unit: btw / 2026-07-23
> 入力: nfr-requirements/reliability-requirements.md（R-BTW-1〜5）+ functional-design/business-logic-model.md

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| R-BTW-1（全失敗で exit≠0 + 1行） | `main()` を単一 try/catch で包み、`BtwError {code, message}` に正規化して stderr 1行 + `process.exit(code)`。想定外例外も同 catch で「internal error: <message>」に変換（生スタックは `--debug` 時のみ） |
| R-BTW-2（部分状態なし） | 書込 API 不在（security-design S-BTW-3 の構造的禁止）による自動成立 — 追加機構なし |
| R-BTW-3（冪等） | 状態を持たないため自動成立。再実行テストのみ |
| R-BTW-4（両OS） | OS 分岐は `plan()` 1関数に集約（分岐の散在禁止）。スモーク: 各OSで {通常 cwd, 空白入り cwd, `&` 入り cwd} × {btw, --fork, -p} |
| R-BTW-5（劣化案内つき失敗） | `BtwError` に `hint?: string` フィールド。fork 解決失敗時は `hint = "本線での /branch をご検討ください（探索先: <計算パス>）"` を必ず設定 |

## タイムアウト

`-p`（同期実行）はタイムアウトを設けない — Claude の長考は正当であり、中断はユーザーの Ctrl-C に委ねる（シグナルは子へ透過）。
