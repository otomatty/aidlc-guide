# Components — Docs i18n Application Design

> ステージ: application-design / 2026-07-31  
> 計画: Q1–Q6 = A  
> 上流: [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [architecture.md](../../../codekb/aidlc-guide/architecture.md) · [component-inventory.md](../../../codekb/aidlc-guide/component-inventory.md) · [team-practices.md](../practices-discovery/team-practices.md)

## Design intent

Extend the brownfield modular monolith: add a **locale-scoped official-docs domain library**, wire **`/api/official-docs/:locale/*`** through **api-core**, and add **Docs Shell** UI in **dashboard** hosted by **vscode-extension**. No cloud / AWS services.

## New / changed components

| Component | npm / location | Type | Responsibility | Owns |
|-----------|----------------|------|----------------|------|
| **official-docs** | `@aidlc-guide/official-docs` (new) | Domain library | Locale resolve, content load under `docs/guide\|reference/<locale>/`, manifest read, stage→path static map, path containment via `guardPath` | Content roots, resolve rules, FR-U3.3 map data |
| **api-core** (extend) | `@aidlc-guide/api-core` | Application | HTTP-shaped handlers for official docs; no collision with `/api/guides` / `/api/docs-settings` | Route registration, ReadResult shaping |
| **dashboard** (extend) | `@aidlc-guide/dashboard` | UI | Docs Shell (RM1–RM5): TOC, body, LocaleControl, UntranslatedNotice, BridgeRedirectPanel, StageCard docs link | Webview UX; wire calls only |
| **vscode-extension** (extend) | `aidlc-guide` | Host | In-process api-core; `openOfficialDoc`-style command/postMessage; locale preference in workspaceState | Host commands, preference store |
| **docs-bridge** (narrow) | `@aidlc-guide/docs-bridge` | Domain | Keep glossary/nav aids (Should US-09); **stop** treating excerpts as canonical body | bridge-map terms/nav only |
| **shared-types** (extend) | `@aidlc-guide/shared-types` | Contracts | Wire types: official doc page, manifest, openOfficialDoc payload | DTOs |
| **core-utils** (reuse) | `@aidlc-guide/core-utils` | Primitives | `guardPath` single enforcement | Unchanged ownership |

## Unchanged (out of MVP host cut)

| Component | Note |
|-----------|------|
| reader-core | Intent records only — not official markdown trees |
| dashboard-server | May later expose same api-core routes; not S-docs-1 Must |
| mcp-server | No official-docs tools in Must |

## Public interfaces (summary)

### official-docs

- `readManifest(workspaceRoot) → Manifest`
- `resolvePage({workspaceRoot, locale, path}) → Page | MissingJa | NotFound | PathRejected`
- `listToc(workspaceRoot, locale) → TocTree`
- `mapStageToDoc(stageSlug) → {path, anchor?} | null`

### api-core routes

- `GET /api/official-docs/:locale/*` — body + metadata  
- `GET /api/official-docs/manifest` (or embed version in page responses) — non-empty `sourceVersion`  
- Existing `/api/guides`, `/api/docs-settings` unchanged

### dashboard surfaces

- Docs Shell route/panel  
- LocaleControl, DocsToc, Markdown body via existing viewer  
- StageCard `OpenOfficialDocLink`  
- BridgeRedirectPanel

### vscode-extension

- Handle openOfficialDoc `{locale, path, anchor?}`  
- Persist last locale  

## Boundaries

```text
dashboard ──wire──► api-core ──► official-docs ──► core-utils.guardPath
                         │              └── FS: docs/guide|reference/<locale>/
                         ├──► docs-bridge (glossary/nav only; no canonical body)
                         └──► reader-core (workflow; unchanged)
dashboard ✗ official-docs (direct import forbidden — same rule as reader-core)
```

## Story coverage

| Story | Components |
|-------|------------|
| US-01 | Repo trees + manifest (content); official-docs reads them |
| US-02 | dashboard Shell + api-core + official-docs |
| US-03/04 | LocaleControl + resolvePage MissingJa |
| US-05 | StageCard link + extension command + mapStageToDoc |
| US-06 | BridgeRedirectPanel; docs-bridge excerpt demoted |
| US-07 | Content under `docs/**/ja/**` (ops) |
| US-08/09 | Should tooling / optional glossary |
