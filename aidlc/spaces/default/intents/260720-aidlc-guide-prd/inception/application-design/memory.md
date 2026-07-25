<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-23T00:00:00Z — NFR-2(3秒起動)の機構を「キャッシュ」でなく段階的初回描画に定義: /api/workflow はstate1枚のみ(Now strip即描画)、593ファイル走査(Matrix)は背景構築→WS matrix-ready; 初回のクリティカルパスから全走査を外す
- 2026-07-23T00:00:00Z — --host中はドライバー自身も回答記入不可(ADR-04)のトレードオフを受容し、運用回避策をC8運用ガイドの必須収録項目として義務化; ADRの受容トレードオフは必ず受け皿成果物にトレースする

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-07-23T00:00:00Z — Mob専用サーバでなくdashboard-serverの--hostモードを選択(ADR-04); 実装単一化とセキュリティ既定の一元化を、モブ中の回答記入不可という運用制約より優先

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
