# Cost Analysis — Docs i18n Bolt 3

> feedback-optimization / 2026-08-02  
> 上流: [deployment-log.md](../deployment-execution/deployment-log.md) · [slo-config.md](../observability-setup/slo-config.md) · [dashboards.md](../observability-setup/dashboards.md) · local-only DECIDED

## Cloud spend

**$0 incremental** — no new AWS resources for Bolt 3 (StageCard → openOfficialDoc → Docs Shell).

## Engineering toil (soft cost)

| Item | Impact |
|------|--------|
| `timings.test.tsx` flake | Blocks confident full `bun run check` (pre-existing) |
| Manual Extension demo FR-B3-6.2 | One-time human cost per release |
| Host locale not bootstrapped on panel open | Defaults `"en"` until LocaleControl / inject |

## Optimization opportunities

1. Quarantine or fix timings fake-timer suite (repo hygiene — out of Bolt 3 Must).  
2. Keep focused Bolt 3 vitest filter for local iteration.  
3. Optional: inject `officialDocsLocale` from host `globalState` on panel open.

## Review

**Verdict:** READY
