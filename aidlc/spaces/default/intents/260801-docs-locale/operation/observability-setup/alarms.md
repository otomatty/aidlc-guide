# Alarms — Docs i18n Bolt 2

> observability-setup / 2026-08-02  
> 上流: local-only · NFR reliability N/A for ui/library

## Cloud alarms

**N/A.**

## Effective alarms

| Trigger | Action |
|---------|--------|
| GHA `check.yml` red | Block merge |
| NFR-B2-1 coverage floor fail | Block `bun run check` |
| Bolt 2 vitest fail | Fix before release |

## Review

**Verdict:** READY
