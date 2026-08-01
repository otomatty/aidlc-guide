# Unit ↔ Story Map — Docs i18n

> ステージ: units-generation / 2026-07-31  
> 上流: unit-of-work.md · unit-of-work-dependency.md · stories.md · requirements.md · components.md · component-methods.md · services.md · component-dependency.md · decisions.md

## Story → Unit assignment

| Story | Priority | Primary unit(s) | Notes |
|-------|----------|-----------------|-------|
| US-01 | Must | content-snapshot | Manifest + en trees |
| US-02 | Must | official-docs, docs-api, docs-shell | Cross-cutting reader spine |
| US-03 | Must | docs-shell (+ official-docs resolve) | Locale keep-path |
| US-04 | Must | docs-shell (+ official-docs missing_ja) | Notice |
| US-05 | Must | docs-navigation (+ official-docs map) | Deep link |
| US-06 | Must | docs-navigation | Bridge degrade |
| US-07 | Must | content-snapshot | ≥1 ja page; PR process constraint |
| US-08 | Should | diff-report | Cuttable |
| US-09 | Should | docs-navigation | Optional glossary on Bridge |

## Cross-cutting stories

| Story | Spans | Integration concern |
|-------|-------|---------------------|
| US-02 | official-docs + docs-api + docs-shell | Vertical slice / walking skeleton (economics in 2.8) |
| US-05 | docs-navigation + official-docs map + docs-shell land | Payload + map + Shell applyDeepLink |

## Within-unit story notes (not global order)

| Unit | Stories (logical cohesion) |
|------|----------------------------|
| content-snapshot | US-01 → US-07 bootstrap files |
| official-docs | Resolve/NFR tests supporting US-02/03/04/05 |
| docs-api | Route + collision tests for US-02 |
| docs-shell | US-02 chrome → US-03 → US-04 |
| docs-navigation | US-05 then US-06 (US-09 optional) |
| diff-report | US-08 alone |

## Coverage verification

| Check | Result |
|-------|--------|
| Every Must/Should story assigned | Yes (US-01–US-09) |
| Every unit has ≥1 story | Yes |
| Won’t / Could not forced into Must units | Yes (U7 Could omitted) |
