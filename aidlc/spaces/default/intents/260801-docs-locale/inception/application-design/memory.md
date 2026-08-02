<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-08-01T13:40:00Z — Bolt 2 application-design is delta-only on parent AD (official-docs + api-core + dashboard Docs Shell + shared-types). No new packages; AWS N/A per project DECIDED.
- 2026-08-01T13:46:00Z — Q1–Q5=A / Q6=D: resolve owns path/notice/anchor; UI wire-first; coverage on official-docs three files; three Bolt 2 ADRs.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-08-01T13:46:00Z — Did not re-ask AWS service mapping; project DECIDED local-only and parent AD already closed cloud as N/A.
- 2026-08-01T13:48:00Z — Reviewer NOT-READY F1/F2: added `listToc` + TOC highlight action and HTTP error→UI mapping (404≠missing_ja).

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-08-01T13:46:00Z — Delta ADRs (B2-001..003) instead of rewriting parent ADR-001..; keeps Bolt 1 decisions stable while pinning Bolt 2 contracts.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
