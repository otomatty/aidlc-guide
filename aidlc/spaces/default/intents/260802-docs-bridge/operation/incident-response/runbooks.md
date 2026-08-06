# Runbooks — Docs i18n Bolt 4

> incident-response / 2026-08-06  
> 上流: [alarms.md](../observability-setup/alarms.md) · [dashboards.md](../observability-setup/dashboards.md) · [rollback-runbook.md](../deployment-pipeline/rollback-runbook.md) · [security-design](../../construction/docs-navigation/nfr-design/security-design.md) · [reliability-design](../../construction/docs-navigation/nfr-design/reliability-design.md) · [deployment-architecture](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md)  
> Q1 = A · Q3 = A

## RB-B4-1 — Excerpt accordion remounted (`docs-excerpt` visible)

1. Confirm StageCard does **not** render Accordion for `doc.excerpt` (FR-B4-1 / UI-only).  
2. Re-run `packages/dashboard/tests/components.test.tsx` non-mount case.  
3. Do **not** delete API excerpt field as a Must fix (ADR-B4-002).

## RB-B4-2 — CTA not `Open in Docs` / not primary

1. OpenOfficialDocLink visible + `aria-label` must be `Open in Docs`; Button `variant="default"`.  
2. Re-run `open-official-doc.test.tsx` a11y case.  
3. Do not invent a new host message type.

## RB-B4-3 — CTA opens external browser / open-doc

1. IDE path must post `{ type: "open-official-doc", … }` only.  
2. Re-run dashboard + extension open-official-doc suites.  
3. Check host handler still wired (Bolt 3 reuse).

## RB-B4-4 — Host ignore / Shell land broken

1. Invalid payload → ignore (Bolt 3 host).  
2. Re-run extension open-official-doc tests.  
3. Shell land issues → treat as Bolt 3 regression path, not new Bolt 4 type.

## RB-B4-5 — Rollback release

Follow [rollback-runbook.md](../deployment-pipeline/rollback-runbook.md).

## Review

**Verdict:** READY
