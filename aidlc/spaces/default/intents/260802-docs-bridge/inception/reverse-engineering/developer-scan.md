# Developer Code Scan — Modify delta (Bolt 4)

> Stage: reverse-engineering · Intent: `260802-docs-bridge` · HEAD: `ee2fc24` · 2026-08-03  
> Mode: **Modify** on existing CodeKB from `260730-docs-i18n` (2026-07-31 / `7148a19`)  
> Focus: Bridge / official-docs / `openOfficialDoc` surfaces for US-06

## Packages (delta since prior CodeKB)

| Package | Status vs 2026-07-31 | Notes for Bolt 4 |
|---------|----------------------|------------------|
| `official-docs` | **New** | Locale resolve, TOC, page, stage-map, coverage tests |
| `vscode-extension` | Extended | `open-official-doc.ts`, `official-docs-root.ts`, dashboard-panel handler |
| `dashboard` | Extended | Docs Shell, `OpenOfficialDocLink`, locale, StageCard still mounts `doc.excerpt` |
| `api-core` | Extended | `/api/official-docs/*` routes |
| `shared-types` | Extended | `OfficialDocs*`, `open-official-doc` message types |
| `docs-bridge` | Largely unchanged | Still supplies StageDoc + excerpt for Legacy Bridge path |

## Bridge / StageCard (current behavior)

- `StageCard.tsx`: if `doc.excerpt !== null`, mounts excerpt in Accordion (`data-testid="docs-excerpt"`) — **dual-canonical risk for US-06**
- Official path on StageCard uses `OpenOfficialDocLink` (must not use `docsOpenHref` / `open-doc`)
- Legacy `docsOpenHref` / IDE open still present for non-official paths

## openOfficialDoc contract (Bolt 3 — reuse for Bolt 4 CTA)

- Message: `{ type: "open-official-doc", locale, path?, anchor? }`
- Host: `packages/vscode-extension/src/open-official-doc.ts` validates + posts deep-link into Docs Shell
- Dashboard: `docs-shell-inject` / `onDocsShellDeepLink`

## Bolt 4 touchpoints (expected)

- UI: Legacy Bridge / StageCard excerpt presentation → degrade (non-mount) + **Open in Docs** primary
- Host: reuse existing `openOfficialDoc` — no parallel landing
- Domain: `docs-bridge` excerpt API may remain for other consumers; product UI must not mount as article

## Quality signals

- `packages/official-docs/tests/*` — resolve/toc/manifest/stage-map/coverage
- `packages/vscode-extension/tests/open-official-doc.test.ts`
- Root gate still `bun run check`
