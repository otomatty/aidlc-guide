# Security Requirements — Unit: docs-navigation (Bolt 3)

> nfr-requirements / docs-navigation (ui) / 2026-08-02  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [technology-stack.md](../../../../../codekb/aidlc-guide/technology-stack.md)  
> Q2 = A

## Requirements

| ID | 要件 | 出所 | 検証 |
|----|------|------|------|
| S-B3-DN-1 | Webview is untrusted. Host validates `open-official-doc` payload: `locale ∈ {en,ja}`; mapped `path` non-empty string | ADR-B3-001 / BLM F1–F2 | host unit tests |
| S-B3-DN-2 | No runtime remote fetch of official-docs content on deep-link path | NFR-B3-1 | code review / check |
| S-B3-DN-3 | Mapped StageCard path MUST NOT use legacy `open-doc` / `docsOpenHref` / `openExternal` | FR-B3-5.1 / ADR-B3-001 | C-matrix / structural tests |
| S-B3-DN-4 | Dashboard MUST NOT import `@aidlc-guide/official-docs` (map stays in official-docs / api-core) | ADR-B3-002 | `dependency-direction.test.ts` |
| S-B3-DN-5 | No secrets in Webview; wire types / locale / path only | general | review |

## Trust boundary

```text
[Webview dashboard] --postMessage--> [Extension host] --inject--> [Docs Shell]
         untrusted                      validate + persist              trust Shell reuse
```

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

Aligned with BLM F1–F2, NFR-B3-1, ADR-B3-001/002. Non-blocking: ADR pending-gate status is inception artifact concern (LOW).
