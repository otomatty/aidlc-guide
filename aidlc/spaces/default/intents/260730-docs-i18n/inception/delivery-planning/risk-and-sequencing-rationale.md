# Risk & Sequencing Rationale — Docs i18n

> ステージ: delivery-planning / 2026-07-31  
> Heuristic: walking-skeleton-first + value (M5→M1/M2) · light WSJF intuition（数値表は最小）  
> 上流: bolt-plan.md · unit-of-work-dependency.md · stories.md · requirements.md · team-practices.md · components.md · mockups.md · unit-of-work.md · unit-of-work-story-map.md

## Why this order

| Bolt | Value | Time criticality | Risk reduction | Size | Why early/late |
|------|-------|------------------|----------------|------|----------------|
| B1 | High (unlocks all UI) | High | Highest (API collision, guardPath, layering) | L | Skeleton + M5 content |
| B2 | High (S-docs-1 complete) | High | Medium (locale edge cases) | M | Immediately after spine |
| B3 | Medium-High (driver flow) | Medium | Medium (host command) | M | Needs Shell |
| B4 | Medium (canonical body) | Medium | Low-Medium (regress excerpt) | S | Needs Shell |
| B5 | Low for MVP Done | Low | Low | S | Should / cuttable |

## DAG respect

Topology from 2.7:

```text
content-snapshot → diff-report
official-docs → docs-api → docs-shell → docs-navigation
```

B1 bundles the left spine + content in one economic slice (allowed deviation from “one unit at a time” — justified by walking-skeleton-first and practices M5→M1/M2). Does **not** invert edges: docs-navigation never precedes docs-shell; diff-report never precedes content-snapshot.

## Walking skeleton argument (Cockburn)

Prove the risky integration (new package + new API namespace + Webview) before investing in locale matrix, deep links, and Bridge. Aligns with team.md Walking Skeleton **on** and US-02 “Bolt” note.

## Value argument

Scope backlog: empty content (I1) blocks demo — content-snapshot in B1. S-docs-1 needs Shell+locale (B1–B2). Deep link / Bridge are Must but secondary to readable docs.

## Risks tackled earliest

1. `/api/guides` collision (FR-U2.6) — B1  
2. `guardPath` / NFR-2 — B1  
3. Upstream docs missing — B1 mitigation via fixtures (see external-dependency-map)  
4. NFR-3 95% — B2 when locale branches land  

## Explicit non-goals for sequencing

- No Operation-phase Bolts  
- No browser Dashboard path Bolt  
- No auto-MT pipeline Bolt  
