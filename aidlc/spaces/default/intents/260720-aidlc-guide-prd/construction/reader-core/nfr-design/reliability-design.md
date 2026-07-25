# Reliability Design — Unit: reader-core

> nfr-design (3.3) / Unit: reader-core / 2026-07-24
> 入力: nfr-requirements/reliability-requirements.md（R-RC-1〜5）+ functional-design/business-rules.md（5モード表）

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| R-RC-1（throw ゼロ） | 公開7メソッドの実装を `withResult(fn)` ラッパーで包む（内部 throw を {error, reason:"internal: <msg>"} に正規化する最終防衛線。既知エラーは各所で reason 付き early return） |
| R-RC-2（5モード局所縮退） | 縮退は「値に埋める」設計で統一: cell.error / warnings[] / unparseable フィールド（例外フローを持たないので縮退が合成可能 — 複数モード同時発生も自然に表現） |
| R-RC-3（書きかけ耐性） | パーサは「途中で切れた入力 = フィールド欠落」として G 規則の縮退分岐に自然合流（特別扱い不要な設計）。BOM は読取直後に strip |
| R-RC-4（watch 堅牢性） | chokidar の error イベントを購読し内部再購読（3回まで）。以降は `cb({type:"watch-warning", reason})` で通知（WatchEvent ユニオンの warning variant — domain-entities.md）。dispose はフラグでコールバック遮断してから close |
| R-RC-5（決定性） | 全列挙は明示ソート（units/stages/shards は名前昇順、audit はタイムスタンプ降順+シャード名タイブレーク）。FS の返却順に依存しない |

## 回復パターン

- **一時的な読取失敗**（エンジン書込み中）: そのスナップショットは縮退値、次の watch 通知で消費者が再読取 → 自然回復（リトライループを持たない — 監視が再試行の代替）。
- **watcher 死亡**: 内部再購読3回 → 失敗時は cb({type:"watch-warning", reason:"watcher-lost"}) を発火して消費者に「ライブ性喪失」を明示（WatchEvent ユニオン — domain-entities.md。黙って止まらない）。
