# Tech Stack Decisions — Unit: docs-navigation (Bolt 3)

> nfr-requirements / docs-navigation (ui) / 2026-08-02  
> 上流: [technology-stack.md](../../../../../codekb/aidlc-guide/technology-stack.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md)  
> Q3 = A

## Decisions

| Decision | Choice |
|----------|--------|
| Language / runtime | Existing TypeScript + bun |
| UI | Existing React / Vite dashboard (StageCard / OpenOfficialDocLink) |
| Host | Existing vscode-extension webview host (`openOfficialDoc` message) |
| Map / API | Existing `official-docs` STAGE_DOC_MAP + `GET /api/official-docs/stage/:slug` (api-core) |
| Shell landing | Existing Docs Shell deep-link inject (Bolt 2) |
| New deps / adapters | None |

## Explicit non-choices

| Rejected | Why |
|----------|-----|
| New host adapter package | Q3 = A — extend existing dashboard-panel |
| Browser-primary acceptance surface | NFR-B3-2 — VS Code / Cursor extension only |
| Runtime CMS / network fetch | NFR-B3-1 |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

Q3=A reflected. Minor: Decisions table has no Rationale column (non-blocking).
