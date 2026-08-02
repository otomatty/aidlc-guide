# Logical Components — Unit: official-docs (Bolt 2)

> nfr-design / official-docs (library) / 2026-08-02  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [security-requirements.md](../nfr-requirements/security-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [performance-requirements.md](../nfr-requirements/performance-requirements.md) · [scalability-requirements.md](../nfr-requirements/scalability-requirements.md) · [reliability-requirements.md](../nfr-requirements/reliability-requirements.md)

## Components

| Component | Responsibility | Bolt 2 focus |
|-----------|----------------|--------------|
| `manifest.ts` | readManifest | unchanged |
| `resolve.ts` | resolvePage: keep-path, missing_ja, anchorApplied | **primary** |
| `toc.ts` | listToc (locale-scoped) | highlight consumers |
| `roots.ts` | locale content root helpers | coverage floor |
| `markdown.ts` | heading/anchor helpers | coverage floor |
| `stage-map.ts` | mapStageToDoc | OOS deep-link; keep API |

## Dependencies

- Depends on: `core-utils` (`guardPath`), `shared-types`  
- Consumers: `api-core` in-process only（dashboard ✗ direct import）

## Diagram

```text
shared-types ← official-docs → core-utils.guardPath
                    ↑
                 api-core (pass-through)
```

## Review

**Verdict:** READY — see [security-design.md § Review](./security-design.md#review).
