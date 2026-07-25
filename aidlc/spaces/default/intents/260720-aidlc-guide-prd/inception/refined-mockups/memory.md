<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is maintained by the orchestrator during stage execution. Add observations at the gate ritual, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-07-23T00:00:00Z — S-1第二要素(US-02/FR-4.6)を独立コンポーネントNextStepCalloutとして明示、US-03(自ステージ解説)と区画・データ源を分離; 「クリック=自ステージ解説」と混同しない設計に
- 2026-07-23T00:00:00Z — DetailPanelは非モーダルcomplementaryなのでRadix Dialog(modal)でなくFocusScope(trapped=false)+DismissableLayerを選択; フォーカストラップ無し・aria-modal無しで primitive と設計意図を整合

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-07-23T00:00:00Z — レビュー上限到達後にFinding5を修正(通常は上限で打切りだが、自己矛盾かつ修正が自明のため適用); 全成果物の設計整合を優先

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
