<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-22T00:00:00Z — Vitest採用はC-T1「ランタイムはbunのみ」に抵触しないと解釈; Vitestはdev-time devDependencyであり出荷ランタイムでない（テスト実行はbun上でも可）
- 2026-07-22T00:00:00Z — org.md Deployment（deploy-on-merge/staging/prod）はローカル専用ツールに不適用と判断しlocal-only再定義; 「リリース」=タグ/mergeで環境・CDなし、性能検証(NFR-2/3)で代替
- 2026-07-22T00:00:00Z — 「1ライブラリ・3サーフェス」を構造規約3点(reader-core一方向依存/パーサ単一隔離/型付きResult)としてハード化; 骨格Bolt硬化前にロック

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
