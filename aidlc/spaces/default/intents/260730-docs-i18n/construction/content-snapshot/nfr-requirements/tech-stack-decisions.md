# Tech Stack Decisions — Unit: content-snapshot

> nfr-requirements (3.2) / Unit: content-snapshot (kind: packaging) / 2026-07-31  
> 入力: [technology-stack.md](../../../../codekb/aidlc-guide/technology-stack.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [team-practices.md](../../../inception/practices-discovery/team-practices.md)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content format | Markdown trees under `docs/guide\|reference/<locale>/` | practices Q5=A · FR-U1 |
| Locales | `en` / `ja` only | practices Q4=A |
| Version record | `docs/official-docs.manifest.json` | FR-U1.2 |
| Ingest tooling | bun script and/or committed trees | Monorepo already bun-first |
| Not used | CMS, S3, CDN, i18n message catalogs for body | Out of scope / NFR |

## Explicit non-choices

- No new language runtime for ingest  
- No Docker registry for docs  
- Product `docs/guides/` remains separate stack (existing `/api/guides`)

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-07-31

Stack is brownfield-consistent; no new platform introduced for packaging.
