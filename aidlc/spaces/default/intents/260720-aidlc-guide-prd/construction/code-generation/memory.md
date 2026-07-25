<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-25T00:00:00Z — 実装中に見つかった「先行 Unit の契約に穴がある」ケース（`MatrixCell.count` にファイル名が無く成果物を開けない / `/api/intents` が無く US-15 の一覧導線が塞がる）は、後発 Unit 側で回避策を組まず、先行 Unit の型・エンドポイントを拡張して解消した。消費側の回避は契約の嘘を固定化する
- 2026-07-25T00:00:00Z — 派生値は保持しない（`count` を残して `files` を足すのではなく `count` を置換し、表示側で `files.length` を算出）。同じ事実の2つ目の置き場は必ず食い違う

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-07-25T00:00:00Z — WYSIWYG 第一候補 Milkdown/Crepe を実測（mermaid フェンスが図にならない / 2.2MB）で落とし、文書化された交代順（BlockNote → plain preview）に無い第4案（`marked.lexer()` による読み取り専用レンダラ）を採った。交代の3点セット（実装1ファイル + tech-stack 行 + ADR 追記）を全て実施し、BlockNote を実測せず構造論で外したことも明記した
- 2026-07-25T00:00:00Z — 「設計文書が並行取得を規定しているのに直列実装」をギャップとして申告したが、レビューで契約違反と判定され実装し直した。設計の要件→機構表は願望ではなく契約であり、未計測の見込みで機構を差し替えてはならない

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-07-25T00:00:00Z — 「手動受入項目」に逃がした検証を1件（bind 失敗が致命的であること）自動化したところ、潜在バグを発見した（bun のエラー文に errno が無く、ポート衝突時の `--port` 助言が一度も出ていなかった）。手動送りの理由が「レースの制御が要る」等の技術的困難であるときは、まず本当に困難かを確かめる
- 2026-07-25T00:00:00Z — 文書 Unit（kind: spec）の検証は「読む」ではなく「実行する」。ガイド記載のフックを実際に走らせて初めて、push 拒否からの復旧手順が復旧しない（成功形の出力で何も共有されない）ことと、その復旧コマンド自体が dirty tree で失敗することが判明した

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-07-25T00:00:00Z — 初回 `/api/workflow` が失敗した cold start では client 側が hostMode を知り得ない（`AppState.hostMode` が `boolean` のため不明を表現できない）。403 が実ゲートなので実害は限定的だが、`boolean | null` 化は契約変更のため後続パスで判断する
