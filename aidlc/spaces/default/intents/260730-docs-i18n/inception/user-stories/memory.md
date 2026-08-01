<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-31T05:40:00Z — user-stories は Execute（UI・複数ペルソナ）。計画質問で切り方と Must 境界を先に固定する。
- 2026-07-31T06:00:00Z — 計画 Q1–Q5 は推奨値（A/C/A/C/A）。US-02 を walking skeleton Bolt として正直にマルチデイ扱い（split せず）。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-07-31T06:00:00Z — US-02 を API/UI 分割せず Bolt 注記で INVEST-Small 緊張を解消。NFR-7 フルは refined-mockups へ。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-07-31T06:00:00Z — US-05: payload に anchor があるがページに無い場合 → US-03 先例（page top）。Units で一行明記。
- 2026-07-31T06:00:00Z — US-02 guardPath reject の観測形（404/throw/empty）は Units で選択。
