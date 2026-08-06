# External Dependency Map — Docs i18n Bolt 4

> ステージ: delivery-planning / 2026-08-04  
> 上流: [bolt-plan.md](./bolt-plan.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [mockups.md](../refined-mockups/mockups.md) · [components.md](../application-design/components.md) · [unit-of-work.md](../units-generation/unit-of-work.md) · [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) · [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md) · [team-practices.md](../practices-discovery/team-practices.md)  
> Q5 risks accepted in-repo — 実質クラウド／外部チーム依存なし

## Gated items

| Item | Owner | Lead time | Blocks Bolt | Mitigation |
|------|-------|-----------|-------------|------------|
| — | — | — | — | None required |

## Local-only gates (not external)

| Item | Notes |
|------|-------|
| Bolt 3 `open-official-doc` + Docs Shell on `main` | Prerequisite land (not a unit edge); verify before codegen |
| Functional Design CTA accessible name | Pins FR-B4-2.4 before Code Generation |
| `bun run check` | US-06 UI/contract tests (non-mount + CTA emit) |
| Extension Demo | Legacy Bridge → Open in Docs → Shell; demo-record.md |
| Worktree + PR → `main` | Q2=1 / team.md Way of Working |

## Explicit non-dependencies

- Upstream docs re-snapshot / B5 (#31)  
- Cloud / CMS / third-party APIs  
- External team hand-offs  
- Browser Dashboard path（NFR-B4-3 — Extension Webview only）  
- Workflows engine / terminal inject / locale rework  
