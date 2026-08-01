# Domain Entities — Unit: official-docs

> functional-design / official-docs (library) / 2026-07-31  
> 上流: component-methods.md · components.md · requirements.md · stories.md · unit-of-work.md

## Entities

### Manifest

| Field | Type | Rules |
|-------|------|-------|
| sourceVersion | string (non-empty) | FR-U1.2 |
| source | string | e.g. `aidlc-workflows` |
| capturedAt | ISO-8601 string | |

### Locale

Union: `"en" | "ja"` only (practices).

### DocPath

Workspace-relative path under locale content root, no `..` escape. Distinct from product `docs/guides/`.

### ResolvedPage

| Field | Type | Notes |
|-------|------|-------|
| localeRequested | Locale | Caller intent |
| localeServed | Locale | May be `en` when missing_ja |
| path | DocPath | |
| bodyMarkdown | string | |
| title | string? | From first h1 if parseable |
| notice | `"missing_ja"`? | FR-U2.5 |
| sourceVersion | string | From manifest |
| anchorApplied | `"scrolled" \| "top" \| "none"` | |

### TocTree

Hierarchical nodes: `{ id, title, path, children[] }` for guide + reference.

### StageDocRef

`{ path: string, anchor?: string }` — FR-U3.3 map value; null if unmapped.

## Aggregates / ownership

`@aidlc-guide/official-docs` owns resolve/load/map; does not own UI or HTTP framing.
