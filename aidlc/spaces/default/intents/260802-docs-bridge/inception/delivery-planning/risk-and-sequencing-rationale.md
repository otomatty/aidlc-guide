# Risk and Sequencing Rationale — Docs i18n Bolt 4

> ステージ: delivery-planning / 2026-08-04  
> 上流: [bolt-plan.md](./bolt-plan.md) · [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) · [unit-of-work.md](../units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [mockups.md](../refined-mockups/mockups.md) · [components.md](../application-design/components.md) · [team-practices.md](../practices-discovery/team-practices.md)

## Heuristic

**Value-first / risk-reduction hybrid** on a single-unit DAG.  
Not walking-skeleton-first for this bolt (team.md: Bolt 4 = regular US-06).  
DAG は単一 unit のため **topo 逸脱なし**。経済選択は「1 Construction Bolt に Must 全スライスを束ね、Demo-first で仮説を早く落とす」。

## Why one Bolt

| Factor | Argument |
|--------|----------|
| Value | Issue #30 DoD は excerpt 非マウント + Open in Docs → Shell — 分割するとデモ仮説が薄れる |
| Risk | Dashboard non-mount と host CTA reuse は同時に証明すべき（片方が緑でも体験は壊れる） |
| Job size | S–M 単一 unit；UI/host 2 Bolt 分割はゲートコスト > 並列利益（Q1=1） |
| DAG | `docs-navigation depends_on: []` — 他 unit 待ちなし；Bolt 3 land は外部前提 |

## WSJF-style (informal)

単一候補のためスコア比較なし。実質 score → ∞ for the only Bolt.

## Risks tackled in Bolt 1 (accepted, no buffer bolt — Q5=1)

1. CTA accessible name still open → pin in Functional Design before codegen (natural stage order)  
2. Dashboard vs host dual surface drift → Demo-first fixture then production path (Q4=1)  
3. US-B4-S1 cut late → optional slice after Must; absence does not block DoD (Q3=1)  
4. B3 `open-official-doc` contract drift → reuse host handler; regression in `bun run check`  
5. Excerpt still mounted via leftover test ids / a11y tree → US-B4-01 AC + NFR-B4-2 tests

## Alternatives rejected

| Option | Why not |
|--------|---------|
| Split UI vs host into 2 Bolts | Over-gated for solo AI; delays confidence hypothesis |
| Promote US-B4-S1 to Must | Contradicts scope Should / cuttable |
| Extra contingency bolt | Job size small; risks already gated by FD → codegen order |
