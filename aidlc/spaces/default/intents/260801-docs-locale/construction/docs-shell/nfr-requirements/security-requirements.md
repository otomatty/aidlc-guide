# Security Requirements — Unit: docs-shell (Bolt 2)

> nfr-requirements / docs-shell (ui) / 2026-08-02  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [technology-stack.md](../../../../../codekb/aidlc-guide/technology-stack.md)

## Requirements

| ID | 要件 | 出所 | 検証 |
|----|------|------|------|
| S-B2-DS-1 | Must not import official-docs / reader-core | architecture | structural tests / Biome |
| S-B2-DS-2 | Untranslated UI only from `notice==="missing_ja"` | ADR-B2-001 | unit tests |
| S-B2-DS-3 | Notice exposed via `role="status"` | FR-B2-2.3 | a11y check |
| S-B2-DS-4 | No secrets in Webview; wire types only | general | review |

## Review

**Verdict:** READY  
**Date:** 2026-08-02
