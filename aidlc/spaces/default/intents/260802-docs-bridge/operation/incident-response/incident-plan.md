# Incident Plan — Docs i18n Bolt 4

> incident-response / 2026-08-06  
> 上流: [alarms.md](../observability-setup/alarms.md) · [runbooks.md](./runbooks.md) · [rollback-runbook.md](../deployment-pipeline/rollback-runbook.md) · [reliability-design](../../construction/docs-navigation/nfr-design/reliability-design.md) · [dashboards.md](../observability-setup/dashboards.md) · [security-design](../../construction/docs-navigation/nfr-design/security-design.md) · [deployment-architecture](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md)  
> Q1 = A · Q2 = A

## Severity (local product)

| Sev | Meaning | Response |
|-----|---------|----------|
| S1 | Bridge/StageCard docs path unusable (excerpt as canonical again / never Shell) | Revert VSIX / git revert; RB-B4-1 / RB-B4-3 / RB-B4-5 |
| S2 | Wrong CTA label / emit / host ignore | Patch + focused vitest |
| S3 | Cosmetic / deferred demo-record / US-B4-S1 | Next PR |

## Process

1. Detect via CI red, focused Bolt 4 vitest fail, or user report.  
2. Triage with RB-B4-* runbooks.  
3. Fix or rollback.  
4. Optional short note in PR — no formal PIR unless S1.

## Cloud / AWS Incident Manager

**N/A** — local extension feature.

## Review

**Verdict:** READY
