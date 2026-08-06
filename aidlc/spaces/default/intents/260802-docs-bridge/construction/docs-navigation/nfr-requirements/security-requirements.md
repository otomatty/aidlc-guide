# Security Requirements — Unit: docs-navigation (Bolt 4)

> nfr-requirements / docs-navigation (ui) / 2026-08-04  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [technology-stack.md](../../../../../codekb/aidlc-guide/technology-stack.md)  
> Q2 = A

## Requirements

| ID | 要件 | 出所 | 検証 |
|----|------|------|------|
| S-B4-DN-1 | Webview untrusted. Host validates `open-official-doc` (Bolt 3 reuse): `locale ∈ {en,ja}`; mapped `path` non-empty | ADR-B4-001 / BLM F4-2 | host unit / reuse tests |
| S-B4-DN-2 | No runtime remote fetch of official-docs on CTA path | NFR-B4-1 | code review / check |
| S-B4-DN-3 | Primary CTA MUST NOT use `openExternal` / `window.open` / `target=_blank` / legacy `open-doc` | FR-B4-2.2–2.3 | contract tests |
| S-B4-DN-4 | Dashboard MUST NOT import `@aidlc-guide/official-docs` | Bolt 3 inherit | dependency-direction.test |
| S-B4-DN-5 | Excerpt may remain on API wire; product UI MUST NOT mount as article (UI-only Must) | ADR-B4-002 / FR-B4-1 | `docs-excerpt` absent |
| S-B4-DN-6 | No secrets in Webview; locale / path / message types only | general | review |

## Trust boundary

```text
[Webview dashboard] --open-official-doc--> [Extension host] --inject--> [Docs Shell]
      untrusted           validate (reuse B3)                 trust Shell reuse
      no excerpt mount
```

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY
