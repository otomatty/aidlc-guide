# Unit Dependency DAG — Docs i18n Bolt 2

> ステージ: units-generation / 2026-08-01  
> 上流: [unit-of-work.md](./unit-of-work.md) · [components.md](../application-design/components.md) · [component-methods.md](../application-design/component-methods.md) · [services.md](../application-design/services.md) · [component-dependency.md](../application-design/component-dependency.md) · [decisions.md](../application-design/decisions.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md)  
> **Topology only** — no recommended build order / critical path (Delivery Planning 2.8).

## Prose DAG

```text
official-docs ──► docs-shell
```

- **official-docs** has no dependencies (roots of this Bolt).
- **docs-shell** depends on **official-docs** for wire semantics (`OfficialDocsPage`, TOC, notice/anchor meaning). Runtime hops through api-core are an integration detail inside that edge, not a third unit.

## Integration points

| From | To | Contract |
|------|-----|----------|
| official-docs | docs-shell (via api-core) | `resolvePage` / `listToc` → `OfficialDocsPage` / `OfficialDocsToc`; HTTP mapping per component-methods (200+notice vs 404≠missing_ja) |
| docs-shell | official-docs | Consumes wire only; no direct package import |
| shared-types | both | Existing DTO names (FR-B2-4.3) |

## Parallel development opportunities

- With only one edge, **no mutual independence** between the two units: docs-shell work that asserts live wire needs official-docs contracts/behaviors available.
- Fixture-driven official-docs tests can proceed without UI; UI stubs can mock `OfficialDocsPage` while library finishes — that is an economic/parallelism choice for 2.8, not a second DAG edge.

No cycles.

## Machine-readable edges

```yaml
units:
  - name: official-docs
    kind: library
    depends_on: []
  - name: docs-shell
    kind: ui
    depends_on: [official-docs]
```

## Review

**Reviewer:** aidlc-architecture-reviewer-agent
**Verdict:** READY — see full review in [unit-of-work.md § Review](./unit-of-work.md#review).
