# Unit ↔ Story Map — Docs i18n Bolt 3

> ステージ: units-generation / 2026-08-02  
> 上流: [unit-of-work.md](./unit-of-work.md) · [unit-of-work-dependency.md](./unit-of-work-dependency.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md) · [components.md](../application-design/components.md) · [component-methods.md](../application-design/component-methods.md) · [services.md](../application-design/services.md) · [component-dependency.md](../application-design/component-dependency.md) · [decisions.md](../application-design/decisions.md)

## Story → unit(s)

| Story | Primary unit | Supporting | Notes |
|-------|--------------|------------|-------|
| US-B3-01 | docs-navigation | — | Mapped openOfficialDoc + Shell land |
| US-B3-02 | docs-navigation | — | Label accessible name |
| US-B3-03 | docs-navigation | — | Unmapped `{locale}` → Shell top |
| US-B3-04 | docs-navigation | — | Map regression（existing STAGE_DOC_MAP） |
| US-B3-05 | docs-navigation | — | Legacy open off |
| US-B3-06 | docs-navigation | — | C1–C7 + demo-record |

## Cross-cutting stories

None across multiple **units** — single-unit Bolt. Cross-package slices are within `docs-navigation`（U1–U4）.

## Within-unit story slices (topology-neutral)

Numbers are labels, not implementation order — economic sequencing is Delivery Planning 2.8.

### docs-navigation

1. Payload + shared-types（US-B3-01/03；U1）  
2. Extension handler + locale preference（US-B3-01；U2；ADR-B3-001/003）  
3. StageCard label + emit + stage-map wire（US-B3-02/03/05；U3；ADR-B3-002）  
4. DocsShell locale deep-link one-shot（US-B3-01/03；U4）  
5. Verify: map lock + check matrix + demo（US-B3-04/06）

## Coverage check

| Check | Status |
|-------|--------|
| Every Must story assigned | Yes — US-B3-01…06 |
| Every unit has ≥1 story | Yes — docs-navigation |
| Won't stories assigned | No — correctly omitted（B4/B5/Bolt2 locale） |
