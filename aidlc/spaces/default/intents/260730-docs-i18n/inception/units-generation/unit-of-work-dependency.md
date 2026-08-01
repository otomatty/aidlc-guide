# Unit Dependency DAG — Docs i18n

> ステージ: units-generation / 2026-07-31  
> 上流: unit-of-work.md · components.md · component-methods.md · services.md · component-dependency.md · decisions.md · requirements.md · stories.md  
> **Topology only** — no recommended build order / critical path (that is Delivery Planning 2.8).

## Prose DAG

```text
content-snapshot ──────────────────────────► diff-report
       (no edge to libraries)

official-docs ──► docs-api ──► docs-shell ──► docs-navigation
```

- **content-snapshot** and **official-docs** have no edge between them (library uses fixtures or committed trees at integration time — sequencing economics in 2.8).
- **diff-report** depends only on snapshot material existing as a packaging input.
- **docs-navigation** requires **docs-shell** (deep link / Bridge land in Shell).

## Integration points

| From | To | Contract |
|------|-----|----------|
| content-snapshot | official-docs (runtime) | FS trees + `docs/official-docs.manifest.json` |
| official-docs | docs-api | In-process `resolvePage` / `listToc` / `readManifest` / `mapStageToDoc` |
| docs-api | docs-shell | `/api/official-docs/:locale/*` ReadResult |
| docs-shell | docs-navigation | Shell open + applyDeepLink; Bridge → Shell |
| docs-navigation | docs-api (via host) | `openOfficialDoc` `{locale,path,anchor?}` |
| content-snapshot | diff-report | Snapshot + upstream compare inputs |

## Parallel development opportunities

Sets with no mutual dependency (multiple valid topological orderings exist):

1. `{content-snapshot, official-docs}` — independent starts  
2. After `docs-api` exists: shell work is gated on api; navigation gated on shell  
3. `{diff-report}` parallel to reader UI stack once `content-snapshot` is available  

No cycles.

## Machine-readable edges

```yaml
units:
  - name: content-snapshot
    kind: packaging
    depends_on: []
  - name: official-docs
    kind: library
    depends_on: []
  - name: docs-api
    kind: library
    depends_on: [official-docs]
  - name: docs-shell
    kind: ui
    depends_on: [docs-api]
  - name: docs-navigation
    kind: ui
    depends_on: [docs-shell]
  - name: diff-report
    kind: packaging
    depends_on: [content-snapshot]
```
