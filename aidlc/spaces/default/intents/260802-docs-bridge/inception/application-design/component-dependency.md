# Component Dependency — Docs i18n Bolt 4

> Intent: `260802-docs-bridge` · application-design · 2026-08-03  
> 上流: [components.md](./components.md) · codekb `dependencies.md`

## Delta dependency graph

```text
dashboard
  │ postMessage open-official-doc
  ▼
vscode-extension ──► Docs Shell (same webview app)
  │
  └── (existing) api-core ──► official-docs / docs-bridge / reader-core

NEW edges: none
REMOVED product edges: StageCard/Bridge → excerpt Accordion (UI-only)
FORBIDDEN: dashboard → official-docs direct import (unchanged)
FORBIDDEN: new message types parallel to open-official-doc
```

## Integration with existing components

| Existing | Integration |
|----------|-------------|
| OpenOfficialDocLink / open-official-doc.ts | Reuse for Bridge primary CTA |
| StageCard excerpt Accordion | Disable / do not render (US-B4-01) |
| docs-bridge StageDoc.excerpt | May remain on wire; not mounted |

## Brownfield fit

Matches codekb TX-3b and component-inventory gap “Bridge excerpt non-mount + Open in Docs primary”.
