# External Dependency Map — Docs i18n Bolt 2

> ステージ: delivery-planning / 2026-08-02  
> 上流: [bolt-plan.md](./bolt-plan.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [unit-of-work.md](../units-generation/unit-of-work.md) · [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) · [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md) · [mockups.md](../refined-mockups/mockups.md) · [components.md](../application-design/components.md)  
> Q5 = A — 実質外部依存なし（ローカル完結）

## Gated items

| Item | Owner | Lead time | Blocks Bolt | Mitigation |
|------|-------|-----------|-------------|------------|
| *(none external)* | — | — | — | Content trees + manifest already in-repo from product Bolt 1 / PR #26 |

## Local-only gates (not external teams)

| Item | Owner | Blocks | Note |
|------|-------|--------|------|
| `bun run check` green (incl. coverage floor) | aidlc-developer-agent + human | Construction Bolt 1 DoD | Must |
| Extension Docs Shell manual scenarios record | Human / developer | Construction Bolt 2 DoD (FR-B2-5.2) | Screenshots optional |
| Human walking-skeleton gate | User | After Bolt 1 | team.md |

## Explicitly not dependencies

| Item | Why out |
|------|---------|
| Upstream re-snapshot of aidlc-workflows docs | OOS / not required for this intent (Q5≠B) |
| Cloud / CMS / network fetch | NFR-B2-2 / project local-only |
| Multi-team hand-offs | team-formation SKIP |
