<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-25T00:00:00Z — Construction の質問は「genuine gap のみ」の原則どおり全9ユニットで質問ゼロ（上流の requirements/application-design/refined-mockups が判断を出し切っていた）; 代わりにレビュー指摘で埋めた
- 2026-07-25T00:00:00Z — 複数ユニットが同じサーバ挙動を語る場合、後発ユニットは「所有表」で先行ユニットの所有を明示し再仕様化しない（mob-mode が dashboard-server の bind/403/broadcast を再定義しかけた失敗から）

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-07-25T00:00:00Z — 予算（NFR-2/3）をユニット横断で分解する際、後発ユニットが先行ユニットの予算表に無い項目を引用しかける事故が2回発生; 引用先に行が無ければ先行側に行を足してから引用する運用に統一

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
