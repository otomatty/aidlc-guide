# Risk & Sequencing Rationale — Docs i18n Bolt 2

> ステージ: delivery-planning / 2026-08-02  
> 上流: [bolt-plan.md](./bolt-plan.md) · [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) · [unit-of-work.md](../units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [mockups.md](../refined-mockups/mockups.md) · [components.md](../application-design/components.md)  
> Heuristic: **hybrid walking-skeleton-first + risk-first** (Q1=A). Not pure WSJF; job size is small and equal (M/M).

## Why this order

| Factor | Argument |
|--------|----------|
| Topology | `docs-shell` depends_on `official-docs` — UI Bolt cannot precede library without mocks (Q3=A rejects parallel) |
| Risk | NFR-B2-1 coverage floor and missing_ja/anchor branches live in official-docs; failing these makes UI polish meaningless |
| Walking skeleton | team.md: Bolt 1 solo gated. Construction Bolt 1 proves FS→resolve→wire shape before UI invests (Q6=A) |
| Value | S-docs-1 user value completes in Bolt 2; shipping Bolt 1 alone does not finish the experience — accepted trade for risk containment |

## WSJF-style (lightweight)

| Bolt | Value | Time criticality | Risk reduction | Size | Implied priority |
|------|-------|------------------|----------------|------|------------------|
| 1 official-docs | Med (enables S-docs-1) | Med | **High** (coverage / contract) | M | First |
| 2 docs-shell | **High** (user-visible) | Med | Med | M | Second |

Score narrative: risk-reduction on Bolt 1 outweighs front-loading UI value.

## DAG alignment

Order **matches** topological order from units-generation. No deviation to justify.

## Key risks tackled earliest

1. Coverage floor not wired into `bun run check`  
2. 404 inferred as missing_ja (ADR-B2-001 seam)  
3. keep-path / anchorApplied drift between resolve and UI  

## Cuttable

- US-B2-S1 (h1) — Should; may slip without failing Must DoD of Bolt 2
