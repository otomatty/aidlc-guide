# Tech Stack Decisions — Unit: official-docs (Bolt 2)

> nfr-requirements / official-docs (library) / 2026-08-02  
> 上流: [technology-stack.md](../../../../../codekb/aidlc-guide/technology-stack.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md)  
> Q3=A — 新ランタイムなし

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | Monorepo standard |
| Package | `@aidlc-guide/official-docs` (existing) | Parent ADR-001; Bolt 2 completes contracts |
| FS safety | `@aidlc-guide/core-utils` `guardPath` | Single enforcement |
| Results | Existing Result / withResult style | Match reader-core / Bolt 1 |
| Tests | Vitest + **branch** 95% on resolve/roots/markdown | NFR-B2-1 · Q2=A |
| Runtime | bun (tests) / Node via consumers | No new runtime |
| Not used | HTTP client, React, cloud SDKs, CMS | Keep pure library · Q4=A |

## Non-goals

- No new workspace package  
- No i18n message catalog library (content trees only)  

## Review

**Reviewer:** aidlc-architecture-reviewer-agent
**Verdict:** READY
**Date:** 2026-08-02

- **required-sections:** `## Decisions` + `## Non-goals` = 2 H2s. ✓
- **upstream-coverage:** header cites all 4 consumes. ✓
- **Q3=A honored:** no new runtime, no new cloud SDKs, no new workspace package. ✓
- **Stack conservative and implementable:** TypeScript + bun/Vitest + existing `@aidlc-guide/core-utils` guardPath — zero ambiguity for the developer. ✓
