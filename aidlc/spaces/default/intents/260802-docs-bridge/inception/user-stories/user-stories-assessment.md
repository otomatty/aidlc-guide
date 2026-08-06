# User Stories Assessment — Docs i18n Bolt 4

> Stage: user-stories · Intent: `260802-docs-bridge` · 2026-08-03

## Decision

**Execute**

## Rationale

Bolt 4 is user-facing UI contract work (Legacy Bridge / StageCard excerpt degrade + Open in Docs CTA). Multiple personas (driver primary, beginner secondary) and testable GWT acceptance criteria add value beyond FR tables alone.

## Factors

| Factor | Signal |
|--------|--------|
| User-facing | Yes — Dashboard Bridge / StageCard |
| Personas | Driver / mob (primary), beginner (secondary) |
| Complexity | Cross-package: dashboard UI + existing host `open-official-doc` |
| Alternative | Requirements alone insufficient for Construction AC |

## Key story areas

1. Excerpt non-mount (FR-B4-1)
2. Open in Docs primary CTA → `open-official-doc` (FR-B4-2)
3. Demo + check tests (FR-B4-3 / NFR-B4-2)
4. US-09 Should (FR-B4-4) — non-failing
