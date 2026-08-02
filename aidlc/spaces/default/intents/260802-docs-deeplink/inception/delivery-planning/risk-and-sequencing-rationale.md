# Risk and Sequencing Rationale — Docs i18n Bolt 3

> ステージ: delivery-planning / 2026-08-02  
> 上流: [bolt-plan.md](./bolt-plan.md) · [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) · [unit-of-work.md](../units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [mockups.md](../refined-mockups/mockups.md) · [components.md](../application-design/components.md)

## Heuristic

**Walking-skeleton-first**（Cockburn）+ team.md skeleton stance（Bolt 1 ソロ・ゲート）.  
DAG は単一 unit のため **topo 逸脱なし**。経済選択は「1 Bolt に全スライスを束ねて end-to-end を一度で証明する」。

## Why one Bolt

| Factor | Argument |
|--------|----------|
| Value | Issue #29 DoD は StageCard→Shell の連続体験 — 分割するとデモ仮説が薄れる |
| Risk | Host handler + payload discriminant + legacy-off は同時に証明すべき |
| Job size | Medium 単一 unit；2+ Bolt に割るとゲートコスト > 並列利益 |
| DAG | `docs-navigation depends_on: []` — 他 unit 待ちなし |

## WSJF-style (informal)

単一候補のためスコア比較なし。実質 score → ∞ for the only Bolt.

## Risks tackled in Bolt 1

1. openOfficialDoc 未配線のままレガシー open が残る  
2. unmapped `path:""` と mapped の判別曖昧  
3. locale が deep-link に載らず Shell 着地が en 固定  
4. check に label / legacy-off / no-fetch が抜けて緑のまま壊れる  

## Alternatives rejected

| Option | Why not |
|--------|---------|
| Split U1–U4 into 4 Bolts | Over-gated for solo AI; delays demo |
| UI-first with mocked host | Falsifies confidence hypothesis (real host path) |
