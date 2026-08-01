# External Dependency Map — Docs i18n

> ステージ: delivery-planning / 2026-07-31  
> 上流: bolt-plan.md · requirements.md · stories.md · team-practices.md · unit-of-work.md · unit-of-work-dependency.md · unit-of-work-story-map.md · components.md · mockups.md

## Gated items

| ID | Dependency | Owner | Lead time | Blocks | Mitigation |
|----|------------|-------|-----------|--------|------------|
| E1 | Upstream aidlc-workflows `docs/guide` + `docs/reference` availability | Maintainer / snapshot job | Hours–days if clone lag | B1 content-snapshot completeness | Ship B1 with committed fixture trees + real manifest; replace/expand snapshot in same Bolt before gate |
| E2 | Human review of ja bootstrap / later translate PRs | Doc maintainer (P3) | Review cycle | US-07 ongoing (not B1 demo) | AI may draft ≥1 ja page; merge still human |
| E3 | openOfficialDoc final command/type string | Functional Design (internal) | Same Construction | B3 wire name only | Payload shape fixed in requirements; name pin in FD |

## Not external

| Item | Why internal |
|------|----------------|
| VS Code / Cursor host | Local extension |
| bun / Vitest / check gate | Repo toolchain |
| bridge-map / docs-bridge | In-monorepo |
| Cloud / AWS | Out of scope |

## Empty cloud row

No SaaS APIs, no data windows, no cross-team service hand-offs for runtime.
