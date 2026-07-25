# Reliability Design — Unit: docs-bridge

> nfr-design (3.3) / Unit: docs-bridge / 2026-07-24
> 入力: nfr-requirements/reliability-requirements.md（R-DB-1〜4）

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| R-DB-1（throw ゼロ / 同梱 map はビルド時防衛） | 公開4メソッドを reader-core と同型の withResult ラッパーで包む。map はビルド時 data-lint + TS 型（satisfies BridgeMap）で検証 |
| R-DB-2（docs 縮退） | excerpt 取得は独立 try ブロック — 失敗しても静的エントリの {ok} は変えず warnings に積む |
| R-DB-3（決定性） | map は Object.freeze でロード後不変。excerpt はファイル内容依存（docs 更新で変わるのは正 — 決定性はプロセス内で保証） |
| R-DB-4（ローカルゲート接続） | data-lint は Vitest テストとして実装（`bun run check` が実行）。docs clone 不在は describe.skipIf + コンソール警告 — **skip は本 Unit 単体時のみ許容。build-and-test（3.6）では docs clone を前提に必須化**（domain-entities.md の但し書きどおり） |

## 回復パターン

docs リポジトリが後から clone された場合: 次のプロセス起動（または次の resolve 呼出 — 都度読取なので）で自然に excerpt が付く。リトライ機構は不要。
