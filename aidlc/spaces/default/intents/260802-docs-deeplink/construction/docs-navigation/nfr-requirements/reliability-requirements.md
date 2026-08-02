# Reliability Requirements — Unit: docs-navigation (Bolt 3)

> nfr-requirements / docs-navigation (ui) / 2026-08-02  
> Q5 = A — **N/A stub** (ui unit; local single-user extension)

## Status

Not applicable as a service SLO. Failure modes covered in functional design / security:

- Invalid payload → host rejects (no Shell inject with bad path)
- Unmapped slug → Shell top with locale only (degraded, not crash)
- Map / API error → existing error surfacing; no silent fallback to `open-doc` on mapped StageCard path

## Review

**Verdict:** READY (N/A)
