# Component Dependency — Docs i18n

> ステージ: application-design / 2026-07-31  
> 上流: components.md · architecture.md · component-inventory.md · requirements.md · stories.md · team-practices.md

## Dependency matrix

| ↓ depends on → | official-docs | api-core | dashboard | vscode-ext | docs-bridge | reader-core | core-utils | shared-types |
|----------------|:-------------:|:--------:|:---------:|:----------:|:-----------:|:-----------:|:----------:|:------------:|
| official-docs | — | | | | | | ✓ | ✓ |
| api-core | ✓ | — | | | opt* | ✓ | | ✓ |
| dashboard | ✗ | wire | — | wire | opt† | ✗ | | ✓ |
| vscode-extension | | in-proc | embeds | — | | | ✓‡ | ✓ |
| docs-bridge | | | | | — | | ✓ | ✓ |

\* api-core may still call docs-bridge for non-canonical glossary; not for official body.  
† dashboard may show bridge-map aids via existing wire routes — optional US-09.  
‡ extension already uses guardPath for open-file; official docs containment stays in official-docs / api-core.

**Forbidden:** `dashboard → official-docs` or `dashboard → reader-core` (direct).

## Communication patterns

| Edge | Pattern | Data |
|------|---------|------|
| dashboard ↔ host/api-core | Sync request/response | TOC, page markdown, manifest version |
| StageCard → host | Sync command | `{locale,path,anchor?}` |
| api-core → official-docs | In-process sync | ResolvedPage / TocTree |
| official-docs → FS | Sync bounded read | Files under locale root |
| Bridge → Docs Shell | In-UI navigation | Open canonical path |

No async event bus for MVP.

## Data flow

```text
[docs/official-docs.manifest.json]
[docs/guide|reference/<locale>/**]
        │
        ▼
  official-docs (resolve + guardPath)
        │
        ▼
     api-core ──GET /api/official-docs/:locale/*──► dashboard Docs Shell
        ▲                                              │
        │                              StageCard openOfficialDoc
        └──────── vscode-extension ◄───────────────────┘
                         │
                   workspaceState (locale)
```

## Shared resources

| Resource | Owner | Consumers |
|----------|-------|-----------|
| `docs/guide\|reference/<locale>/` | Repo / US-01 ingest | official-docs only (via guardPath) |
| `docs/official-docs.manifest.json` | Repo | official-docs → header `sourceVersion` |
| `docs/guides/` (product) | Existing guides feature | `/api/guides` — **must not** mix with official-docs |
| bridge-map.json | docs-bridge | Optional glossary (US-09); not canonical body |
| Locale preference | vscode-extension state | dashboard LocaleControl |

## Layering (unchanged + extension)

```text
shared-types ← core-utils ← official-docs ← api-core ← vscode-extension
                    ↑              ↑              ↑
                docs-bridge ──────┘         dashboard (wire only)
                reader-core ───────────────┘
```
