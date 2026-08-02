# Runbooks — Docs i18n Bolt 3

> incident-response / 2026-08-02  
> 上流: [alarms.md](../observability-setup/alarms.md) · [dashboards.md](../observability-setup/dashboards.md) · [rollback-runbook.md](../deployment-pipeline/rollback-runbook.md) · [security-design](../../construction/docs-navigation/nfr-design/security-design.md) · [code-summary](../../construction/docs-navigation/code-generation/code-summary.md)  
> Q1 = A · Q3 = A

## RB-B3-1 — Mapped StageCard opens external browser / workspace file

1. Confirm VS Code path: StageCard uses `OpenOfficialDocLink` (not `docsOpenHref` / `open-doc`).  
2. Host must receive `{ type: "open-official-doc", locale, path, anchor? }`.  
3. Re-run focused suite: `open-official-doc.test.ts` / `.tsx`, `components.test.tsx` StageCard case.  
4. If still wrong: check `dashboard-panel` wiring of `handleOpenOfficialDoc`.

## RB-B3-2 — Unmapped slug does not open Shell top

1. Unmapped payload omits `path`/`anchor`; host still injects deeplink with `locale` only.  
2. DocsShell should open at locale top (no path jump).  
3. Re-run unmapped host + payload + DocsShell cases.  
4. Do not invent a fake path.

## RB-B3-3 — Invalid payload persists locale or opens Shell

1. Expected: **ignore** — no `globalState` write, no inject (S-B3-DN-1).  
2. Reproduce with bad `locale` or empty mapped `path`.  
3. Re-run host invalid-input unit tests.  
4. Never “log-and-continue” past validation.

## RB-B3-4 — Deep-link locale not applied in Shell

1. Inject must include `locale`; reducer sets `docsShellDeepLink` + `officialDocsLocale`.  
2. DocsShell applies locale then one-shot clears deep-link.  
3. Re-run DocsShell FR-B3-4.3 / locale harness.  
4. Known gap: panel open without prior inject defaults `"en"` until LocaleControl or inject — not a pager; track separately if needed.

## RB-B3-5 — Accessible name missing stage

1. Control name must include stage display name (`Docs: <Stage>`).  
2. Re-run OpenOfficialDocLink a11y test.  
3. Fix `stageDisplayName` / label props only — do not edit `STAGE_DOC_MAP`.

## RB-B3-6 — Rollback release

Follow [rollback-runbook.md](../deployment-pipeline/rollback-runbook.md).

## Review

**Verdict:** READY
