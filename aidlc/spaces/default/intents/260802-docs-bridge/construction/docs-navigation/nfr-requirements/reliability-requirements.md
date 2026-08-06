# Reliability Requirements — Unit: docs-navigation (Bolt 4)

> nfr-requirements / docs-navigation (ui) / 2026-08-04  
> Q5 = A — **N/A stub** (ui unit; local single-user extension)

## Status

Not applicable as a service SLO. Failure modes covered in functional design / security:

- Invalid `open-official-doc` payload → host rejects (Bolt 3 reuse)
- API returns excerpt → UI still does not mount (FR-B4-1.2)
- Map / API error on CTA → no silent fallback to external browser / legacy open-doc
- US-B4-S1 aids absent → Must DoD still passes

## Review

**Verdict:** READY (N/A)
