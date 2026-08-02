# Unit Dependency DAG — Docs i18n Bolt 3

> ステージ: units-generation / 2026-08-02  
> 上流: [unit-of-work.md](./unit-of-work.md) · [components.md](../application-design/components.md) · [component-methods.md](../application-design/component-methods.md) · [services.md](../application-design/services.md) · [component-dependency.md](../application-design/component-dependency.md) · [decisions.md](../application-design/decisions.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md)  
> **Topology only** — no recommended build order / critical path (Delivery Planning 2.8).

## Prose DAG

```text
docs-navigation
```

- Single unit with **no edges**（Q3=A）.  
- Bolt 1/2 Docs Shell + STAGE_DOC_MAP are **prerequisites outside this DAG**, not sibling units.  
- Runtime hop StageCard → api-core → official-docs is an integration detail inside `docs-navigation`, not a second unit.

## Integration points

| From | To | Contract |
|------|-----|----------|
| docs-navigation (StageCard) | api-core | `GET /api/official-docs/stage/:stageSlug` → `StageDocRef \| null` |
| docs-navigation (dashboard) | vscode-extension | openOfficialDoc-style postMessage（payload mapped/unmapped） |
| docs-navigation (extension) | DocsShell | deep-link target `{ locale, path?, anchor? }` one-shot |
| docs-navigation | shared-types | `OpenOfficialDocPayload`（name → FD） |
| dashboard | official-docs | **Forbidden** direct import（dependency-direction.test.ts） |

## Parallel development opportunities

- With one unit and empty `depends_on`, there is **no multi-unit parallelism** in this Bolt's DAG.  
- Within-unit slice parallelism (contract vs UI vs host) is an economic choice for Delivery Planning 2.8, not additional DAG edges.

No cycles.

## Machine-readable edges

```yaml
units:
  - name: docs-navigation
    kind: ui
    depends_on: []
```
