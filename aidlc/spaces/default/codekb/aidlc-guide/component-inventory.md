# Component Inventory — AIDLC Guide

> Reverse-engineering synthesis for intent `260730-docs-i18n`  
> Repo: `aidlc-guide` · Scan HEAD: `7148a19` · Date: 2026-07-31

## Priority Components (Docs / Workflow Core)

| Component | npm name | Type | Responsibility | Depends on | Health |
|-----------|----------|------|----------------|------------|--------|
| vscode-extension | `aidlc-guide` | Host (primary) | Webview host; in-process api-core; commands; path containment for open-doc/open-file | api-core (+ related) | **Healthy** — thin tests (at-risk for host integration) |
| dashboard | `@aidlc-guide/dashboard` | UI SPA | Read-only dashboard; markdown/mermaid; Guides panel; dual transport client | shared-types only (runtime app deps: React stack) | **Healthy** |
| api-core | `@aidlc-guide/api-core` | Application services | Transport-agnostic handlers, hub, AnswerWriter; joins reader + bridge | docs-bridge, reader-core, shared-types | **Healthy** |
| docs-bridge | `@aidlc-guide/docs-bridge` | Domain library | Slug/term/agent → docs mapping; excerpts; zero 3p runtime deps | core-utils, shared-types | **Healthy** — maps point at `.claude`, not official `docs/guide` |
| reader-core | `@aidlc-guide/reader-core` | Domain library | Read-only intent records: parse, matrix, audit, timings, watch | core-utils, shared-types, chokidar | **Healthy** — strongest coverage |
| shared-types | `@aidlc-guide/shared-types` | Contracts | Wire types & pure helpers | (none) | **Healthy** |

### Relationship emphasis (docs-i18n base)

```text
vscode-extension
  ├─ embeds → dashboard (media build)
  └─ in-process → api-core
                    ├─ reader-core  (workflow / artifacts)
                    └─ docs-bridge  (stage / glossary / agents)
dashboard ──wire──► api-core (via host or dashboard-server)
dashboard ✗ reader-core (forbidden)
```

This stack is the brownfield base for bundling official docs en/ja: UI viewer + transport + FS guards already exist; content trees and locale API do not.

## Supporting Components

| Component | npm name | Responsibility | Health |
|-----------|----------|----------------|--------|
| core-utils | `@aidlc-guide/core-utils` | `guardPath`, `withResult`, bounded FS reads — single containment enforcement | **Healthy** |
| dashboard-server | `@aidlc-guide/dashboard-server` | Bun HTTP/WS + static SPA; Mob LAN secondary surface | **Healthy** |
| mcp-server | `@aidlc-guide/mcp-server` | Five read-only MCP tools over reader-core + docs-bridge | **Healthy** |
| btw | `@aidlc-guide/btw` | Launch read-only (plan mode) Claude Code side session | **Healthy** |

## UI Subcomponents Relevant to Docs

| Subcomponent | Package | Role | Docs-i18n reuse |
|--------------|---------|------|-----------------|
| MarkdownSurface / viewer | dashboard | Render md + mermaid + highlight | Primary docs viewer |
| GuidesPanel / GuidesButton | dashboard | Product guide catalogue | Pattern for official TOC |
| lazy-markdown | dashboard | Keep mermaid off first paint | Required for large trees |
| Stage / NextStep UI | dashboard | Workflow orientation + deep links | M4 deep links into docs site |
| PanelShell | dashboard | Side panel chrome | Locale switcher placement candidate |

## Configuration Components

| Artifact | Role |
|----------|------|
| `aidlc-guide.config.json` | `docsRepoPath` (currently `.`) |
| `bridge-map.json` / `agent-map.json` | Stage/term/agent metadata + paths |
| Root `package.json` / `check` | Single quality gate |

## Inventory Gaps (Not Components Yet)

| Missing piece | Needed for scope |
|---------------|------------------|
| Official docs content package or tree (`docs/guide`, `docs/reference`) | M1, M5 |
| Locale preference store / switcher | M2 |
| Locale-scoped docs API routes | M1, M2 |
| Upstream diff-report tooling | S1 (Should) |
| i18n message catalog library | Not required if docs are full markdown trees; UI chrome strings still TBD |

## Health Rating Legend

| Rating | Meaning |
|--------|---------|
| Healthy | Clear boundary, tests or structural enforcement present |
| At-risk | Works but thin tests / migration debt |
| Degraded | Broken or missing for intended use |

docs-bridge is **Healthy** as a map owner but **at-risk relative to docs-i18n goals** because production paths and product naming (`guides` vs `guide`) diverge from the intended official trees.
