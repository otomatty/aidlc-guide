# External Dependency Map — Docs i18n Bolt 3

> ステージ: delivery-planning / 2026-08-02  
> 上流: [bolt-plan.md](./bolt-plan.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [mockups.md](../refined-mockups/mockups.md) · [components.md](../application-design/components.md) · [unit-of-work.md](../units-generation/unit-of-work.md) · [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) · [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md)  
> Q5 = A — 実質外部依存なし

## Gated items

| Item | Owner | Lead time | Blocks Bolt | Mitigation |
|------|-------|-----------|-------------|------------|
| — | — | — | — | None required |

## Local-only gates (not external)

| Item | Notes |
|------|-------|
| `bun run check` | C1–C7 in-repo |
| Extension manual/E2E demo | intent-capture StageCard → Shell; record in demo-record.md |
| Bolt 1/2 merged code | Already on `main`（Docs Shell + STAGE_DOC_MAP） |

## Explicit non-dependencies

- Upstream docs re-snapshot  
- Cloud / CMS / third-party APIs  
- External team hand-offs  
- Browser Dashboard path（NFR-B3-2）
