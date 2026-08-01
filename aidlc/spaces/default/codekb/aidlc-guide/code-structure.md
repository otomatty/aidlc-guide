# Code Structure — AIDLC Guide

> Reverse-engineering synthesis for intent `260730-docs-i18n`  
> Repo: `aidlc-guide` · Scan HEAD: `7148a19` · Date: 2026-07-31

## Repository Layout

```text
aidlc-guide/
├── packages/                 # bun workspaces ("packages/*")
│   ├── shared-types/         # Wire contracts (no runtime deps)
│   ├── core-utils/           # guardPath, withResult, bounded reads
│   ├── docs-bridge/          # bridge-map / agent-map + resolve APIs
│   ├── reader-core/          # Intent-record parse, matrix, watch
│   ├── api-core/             # Handlers, hub, service factory
│   ├── dashboard/            # Vite React SPA (browser + webview build)
│   ├── dashboard-server/     # Bun HTTP/WS host + static SPA
│   ├── vscode-extension/     # Primary host; media/dashboard webview out
│   ├── mcp-server/           # MCP stdio host
│   └── btw/                  # Plan-mode Claude Code launcher CLI
├── docs/                     # Product guides, PRD, reviews (not official guide/)
├── aidlc/                    # Method memory, intents, codekb
├── .claude/                  # AI-DLC engine shell, stages, agents
├── package.json              # workspaces + check script
├── biome.json
├── vitest.config.ts
└── aidlc-guide.config.json   # docsRepoPath: "."
```

Authoritative placement rules: `packages/README.md`.

## Package Responsibilities and Patterns

| Package | Internal shape (typical) | Patterns |
|---------|--------------------------|----------|
| `shared-types` | Flat / domain type modules | Wire-only; pure helpers; no I/O |
| `core-utils` | Small primitive modules | Single containment API |
| `docs-bridge` | `createBridge()`, static JSON maps, persona parse | Map-owner; excerpt slicing |
| `reader-core` | `parse/`, matrix, audit, timings, watch | UI/transport-free; chokidar optional |
| `api-core` | `routeRead` / `handleRead`, hub, AnswerWriter | Transport-agnostic application layer |
| `dashboard` | `components/`, `viewer/`, `services/`, `store/` | React 19; fetch via `getResult`; PanelShell |
| `vscode-extension` | Activation, commands, webview bridge, path normalize | Host adapter; esbuild bundle |
| `dashboard-server` | Bun serve + WS upgrade | Host adapter for browser/Mob |
| `mcp-server` | Tool registration + zod | Host adapter for agents |
| `btw` | CLI spawn | No package deps |

### Naming conventions (dashboard / TS)

- Components: `PascalCase.tsx`
- Hooks: `use*.ts`
- Other modules: `kebab-case.ts`
- Export only what consumers need

### Build outputs

| Artifact | Producer | Consumer |
|----------|----------|----------|
| `packages/vscode-extension/dist/extension.js` | esbuild | VSIX |
| `packages/vscode-extension/media/dashboard/*` | Vite `webview` mode | Extension webview (committed build) |
| Dashboard browser dist | Vite default | `dashboard-server` static |

## Docs / i18n Touchpoints in Tree

| Path / module | Role today | Docs-i18n relevance |
|---------------|------------|---------------------|
| `packages/docs-bridge/src/**` + `bridge-map.json` | Stage/term → `.claude/aidlc-common/...` | Retarget or redirect; naming collision with `docs/guide` |
| `packages/dashboard/src/viewer/*` | Markdown + Mermaid | Host for official docs pages |
| `packages/dashboard/src/**/Guides*` | Product guide UI | Catalogue pattern for guide/reference |
| `packages/dashboard/src/**/lazy-markdown.ts` | Defer mermaid | Keep for large dual-locale trees |
| `packages/api-core` `/api/guides*`, `/api/stage*`, `/api/glossary*` | Current docs APIs | Need locale-scoped official docs APIs (gap) |
| `packages/vscode-extension` open-doc / path containment | IDE file open | Deep links from StageCard (scope M4) |
| `docs/guides/` | Product usage | Do **not** confuse with `docs/guide/` |
| `docs/guide/`, `docs/reference/` | **Missing** | Snapshot intake (M5) |

## Test Layout

- Node project: `packages/*/tests/**`
- Dashboard (jsdom): `packages/dashboard/tests/**`
- Structural dependency-direction tests in dashboard + reader-core
- Coverage floors especially on `reader-core/src/parse/**` (95%)

## Classification Summary

| Class | Examples |
|-------|----------|
| Domain libraries | reader-core, docs-bridge, core-utils, shared-types |
| Application services | api-core |
| Presentation | dashboard |
| Host adapters | vscode-extension, dashboard-server, mcp-server |
| Tooling CLIs | btw, root scripts |
| Method / workspace data | `aidlc/`, `.claude/` (framework; not app runtime packages) |
