# Security Design — Unit: docs-navigation (Bolt 4)

> nfr-design / docs-navigation (ui) / 2026-08-04  
> 上流: [security-requirements.md](../nfr-requirements/security-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [scalability-requirements.md](../nfr-requirements/scalability-requirements.md) · [reliability-requirements.md](../nfr-requirements/reliability-requirements.md) · [performance-requirements.md](../nfr-requirements/performance-requirements.md)  
> Q2 = A · Q3 = A

## Requirement → mechanism

| Req ID | Mechanism | Component / seam |
|--------|-----------|------------------|
| S-B4-DN-1 | Host validates `open-official-doc` (**reuse Bolt 3**): locale ∈ {en,ja}; mapped path non-empty; fail → ignore | `open-official-doc.ts` |
| S-B4-DN-2 | No runtime remote fetch on CTA path | host + Shell reuse |
| S-B4-DN-3 | Primary CTA posts `open-official-doc` only; never openExternal / open-doc / docsOpenHref on IDE path | `OpenOfficialDocLink` / StageCard |
| S-B4-DN-4 | Dashboard forbids `@aidlc-guide/official-docs` import | dependency-direction.test |
| S-B4-DN-5 | UI never mounts `doc.excerpt` as article even if API returns it | StageCard omit Accordion |
| S-B4-DN-6 | Webview carries wire types only — no secrets | payload reuse |

## Trust boundary

```text
[Webview: StageCard + OpenOfficialDocLink]
   │  no excerpt mount
   │  postMessage open-official-doc
   ▼
[Host: validate — Bolt 3 reuse]
   ▼
[DocsShell inject — one-shot]
```

Webview untrusted. Host remains enforcement point (Q2=A).

## AWS / cloud

N/A — local-only (project Forbidden).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY
