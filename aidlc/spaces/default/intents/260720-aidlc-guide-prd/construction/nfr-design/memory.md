<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-25T00:00:00Z — 「設計しないという設計判断」も文書として残す（scalability が構造的 N/A の Unit でも、空欄でなく非該当の根拠と再訪トリガーを書く）
- 2026-07-25T00:00:00Z — 要件→機構の対応表形式を全 Unit で統一（各行が要件 ID を持ち、機構が具体的なモジュール名/API 名に落ちていることをレビューで検査可能にする）

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-07-25T00:00:00Z — 安全性に関わる不変条件（plan モード必須・書込1経路・containment 検査）は「単一の enforcement point + 型/lint による構造的禁止」で担保する方針を全 Unit で統一（規約の記述だけに頼らない）

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
