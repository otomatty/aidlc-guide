# Reliability Requirements — Unit: btw

> nfr-requirements (3.2) / Unit: btw / 2026-07-23
> 入力: business-logic-model.md（エラーハンドリング表）+ business-rules.md（BR-6）+ requirements.md（NFR-4/6）

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| R-BTW-1 | 全失敗モード（CLI不在 / セッション解決不能 / spawn失敗 / 未対応OS / 引数不正）で**非ゼロ exit + 理由1行**。黙殺・ハング・生スタックトレースなし（BR-6） | 各失敗モードの CLI テスト |
| R-BTW-2 | 部分状態を残さない: 書き込みゼロ（S-BTW-3）のため失敗時のクリーンアップ自体が不要（設計による堅牢性） | — 構造保証 |
| R-BTW-3 | 冪等: 同じコマンドの再実行は安全（新しいセッションが増えるだけで壊れるものがない） | 再実行テスト |
| R-BTW-4 | 両OS動作（Windows Git Bash / macOS）: spawn 経路・パス処理が両方で機能（NFR-4 / US-06 AC の OS別スモーク）。スモークには**シェルメタ文字を含む cwd（空白・`&` 等）のケースを必ず含める**（Windows の `cmd /c start` 再パース対策 — レビュー指摘） | OS別スモーク |
| R-BTW-5 | `--fork` の解決不能は**劣化案内つき失敗**: エラーに計算パス + `/branch` 代替を必ず含める（ユーザーが行き止まりにならない — NFR-6 の fail-soft 精神） | エラーメッセージ検証 |

## 依存の可用性

Claude Code CLI 不在は起動時チェックで fail fast（E3）。Claude CLI 側の障害（認証切れ等）は btw の責務外 — 透過（exit code 中継）で表現する。
