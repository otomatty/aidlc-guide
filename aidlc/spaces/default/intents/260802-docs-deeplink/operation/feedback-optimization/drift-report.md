# Drift Report — Docs i18n Bolt 3

> feedback-optimization / 2026-08-02  
> 上流: [deployment-architecture](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md) · [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [cd-config.md](../deployment-pipeline/cd-config.md) · [alarms.md](../observability-setup/alarms.md) · [code-summary](../../construction/docs-navigation/code-generation/code-summary.md)

## Infrastructure drift

**None** — no IaC / cloud stacks to drift.

## Design ↔ code drift notes

| Topic | Status |
|-------|--------|
| `STAGE_DOC_MAP` untouched | Locked — PASS |
| openOfficialDoc + locale-on-deeplink | Matches ADRs / BLM |
| Host `globalState` locale not seeded into webview on panel open | Known gap (lazy OK); not Must failure |
| AIDLC_ACTIVE_INTENT in GHA | Optional pin to `260802-docs-deeplink` |

## Review

**Verdict:** READY
