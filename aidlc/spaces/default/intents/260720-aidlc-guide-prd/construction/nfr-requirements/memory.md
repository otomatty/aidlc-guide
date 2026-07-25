<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-25T00:00:00Z — kind 別 produces（ui は perf/security/tech-stack、spec は security/tech-stack のみ）に従い、非該当の NFR 軸は文書を作らずスキップ; 「N/A 文書を作る」より「そもそも produces に無い」を優先
- 2026-07-25T00:00:00Z — 実行体を持たない spec Unit（ops-guides）の「セキュリティ要件」は記述義務として定義（ガイドの記述ミスが実際の情報漏洩につながるため）

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-07-25T00:00:00Z — NFR-2/3 の予算配分をレビュー指摘で2度修正（audit 経路の超過・getNextStep 未計上）; 予算表は「検算行」を必ず持たせ、合計が上位予算に収まることを明示する運用に変更

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
