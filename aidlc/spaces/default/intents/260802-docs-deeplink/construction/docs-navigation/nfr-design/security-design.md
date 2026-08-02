# Security Design — Unit: docs-navigation (Bolt 3)

> nfr-design / docs-navigation (ui) / 2026-08-02  
> 上流: [security-requirements.md](../nfr-requirements/security-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [scalability-requirements.md](../nfr-requirements/scalability-requirements.md) · [reliability-requirements.md](../nfr-requirements/reliability-requirements.md)  
> Q2 = A · Q3 = A

## Requirement → mechanism

| Req ID | Mechanism | Component / seam |
|--------|-----------|------------------|
| S-B3-DN-1 | Host validates `open-official-doc` before persist+inject: `locale ∈ {en,ja}`; mapped `path` non-empty string; unmapped omits path/anchor. **On fail: ignore** — no persist, no Shell open/front, no inject (BLM F3; must not log-and-continue) | `handleOpenOfficialDoc` (vscode-extension) |
| S-B3-DN-2 | No runtime remote fetch on deep-link path; content remains local official-docs / Shell | host + Shell reuse |
| S-B3-DN-3 | Mapped StageCard activate posts `open-official-doc` only; never `docsOpenHref` / `open-doc` / `openExternal` | `OpenOfficialDocLink` / `StageCard` |
| S-B3-DN-4 | Dashboard forbids `@aidlc-guide/official-docs` import; map via `GET /api/official-docs/stage/:slug` | package boundary + `dependency-direction.test.ts` |
| S-B3-DN-5 | Webview carries wire types / locale / path only — no secrets | payload types (shared-types) |

## Trust boundary

```text
[Webview: OpenOfficialDocLink] --postMessage open-official-doc--> [Host: validate]
                                                                      │ persist locale
                                                                      ▼
                                                              [DocsShell inject]
                                                                      │
                                                                      ▼
                                                         AnchorApplier / LocaleControl
```

Webview is untrusted. Host is the enforcement point (Q2 = A).

## Legacy separation

| Surface | Message / path |
|---------|----------------|
| Mapped StageCard (this unit) | `open-official-doc` only |
| Non-official / legacy docs | existing `open-doc` / `docsOpenHref` unchanged |

## AWS / cloud

N/A — local-only.

## Non-applicable NFR inputs

scalability / reliability requirements are **N/A stubs** for ui kind — no service SLO controls here.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

S-B3-DN-1…5 mapped; F1 addressed (fail → ignore). Host is sole enforcement point.
