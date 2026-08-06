# Unit Dependency DAG — Docs i18n Bolt 4

> ステージ: units-generation / 2026-08-04  
> Intent: `260802-docs-bridge`  
> **Topology only** — no build order, critical path, or Bolt sequencing (→ Delivery Planning)

## Units

```yaml
units:
  - name: docs-navigation
    kind: ui
    depends_on: []
```

## Graph

```text
[docs-navigation]

External prerequisites (not units in this DAG):
  - Bolt 3 open-official-doc + Docs Shell land (complete)
  - Bolt 1–2 official-docs / locale (complete)
```

## Rationale

Q3=A: single unit; no parallel sibling units. Host↔UI hops are **intra-unit** integration details, not separate DAG nodes.

## Cycle check

No edges → acyclic by construction.
