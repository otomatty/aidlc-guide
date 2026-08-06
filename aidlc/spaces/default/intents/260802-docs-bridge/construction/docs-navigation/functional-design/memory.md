# Memory — functional-design / docs-navigation

## Interpretations

- 2026-08-04T10:27:00Z — Recommended defaults 1,1,1,1,1,1: CTA=`Open in Docs`, UI-only excerpt omit, solid primary, reuse OpenOfficialDocLink, US-B4-S1 optional, Demo-first
- 2026-08-04T10:27:00Z — "Legacy Bridge" treated as StageCard docs region / equivalent surface; no separate Bridge package component required
- 2026-08-04T10:27:00Z — ui kind → produce BLM + frontend-components only (no business-rules / domain-entities)

## Deviations

- (none)

## Tradeoffs

- 2026-08-04T10:27:00Z — Dropped Bolt 3 `Docs: <Stage Name>` on primary CTA in favor of Issue #30 wording; stage name remains available elsewhere on StageCard
- 2026-08-04T10:27:00Z — Kept API excerpt field (ADR-B4-002) vs deleting wire — smaller Must scope

## Open questions

- (none for FD — CTA string pinned)
