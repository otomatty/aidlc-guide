# API Documentation — AIDLC Guide

> Reverse-engineering synthesis for intent `260730-docs-i18n`  
> Repo: `aidlc-guide` · Scan HEAD: `7148a19` · Date: 2026-07-31

## Transport Model

`packages/api-core` exposes a **transport-agnostic** read router (`routeRead` / `handleRead`) plus one write handler. Hosts bind the same handlers differently:

| Host | Transport | Notes |
|------|-----------|-------|
| `vscode-extension` | Webview `postMessage` ↔ host | Host runs handlers in-process; pushes as `{ type: "push", message }` |
| `dashboard-server` | HTTP GET/POST + WebSocket | Bun server; static SPA |
| `mcp-server` | MCP tool calls (stdio) | Bypasses HTTP; uses reader-core + docs-bridge directly |

Wire DTOs live in `@aidlc-guide/shared-types` (`ReadResult`, `StageDoc`, `TermDoc`, `MarkdownDoc`, `WsMessage`, answer types).

Unknown `/api/*` → `UNKNOWN_ROUTE` (HTTP 404 / `unknown-route`).

## HTTP / postMessage Read API (`api-core`)

| Method | Path | Role | Domain deps |
|--------|------|------|-------------|
| GET | `/api/workflow` | Stage-1 first paint: state + next-step + serverMode | reader-core |
| GET | `/api/timings` | Stage timing views (off critical path) | reader-core |
| GET | `/api/matrix` | Full matrix or `{ building: true }` | reader-core |
| GET | `/api/io-paths?stage=&unit=` | Stage I/O markdown path listing | reader-core |
| GET | `/api/artifact?path=` | Guarded artifact read under record dir | reader-core + guardPath |
| GET | `/api/intents` | Intent list | reader-core |
| GET | `/api/links` | Project links from bridge config | docs-bridge |
| GET | `/api/docs-settings` | `docsBaseUrl` + `stageDocs` overrides | docs-bridge / config |
| GET | `/api/guides` | Catalogue of `docs/guides/*.md` | FS under product guides |
| GET | `/api/guides/:name` | Single usage guide markdown | FS |
| GET | `/api/agents/:id` | Agent persona | docs-bridge agent-map |
| GET | `/api/agents/:id/knowledge/:name` | Agent knowledge markdown | workspace FS |
| GET | `/api/stage/:slug` | Stage doc + optional excerpt | docs-bridge |
| GET | `/api/glossary/:term` | Term doc | docs-bridge |

### Write API

| Method | Path | Role |
|--------|------|------|
| POST | `/api/answer` | Sole write surface (AnswerWriter) |

Dashboard `services/api.ts` GET helpers intentionally focus on reads; answer posting is a separate path.

## WebSocket / Push Messages

Published via api-core hub (browser native WS; extension host forwards):

| Message (conceptual) | Purpose |
|----------------------|---------|
| `matrix-ready` | Background matrix build finished |
| `change` | Audit / matrix cell updates |
| `live-status` | Degraded / live status signals |

Typed as `WsMessage` in shared-types.

## Docs-Bridge Public Surface

Library API (not HTTP):

- `createBridge()` → `getConfig`, `resolveStage`, `resolveTerm`, `projectLinks`
- Static inventory (scan): ~32 stages, ~9 terms, ~15 agents
- Current stage `docPath` values under `.claude/aidlc-common/stages/...`
- Config: `aidlc-guide.config.json` → `docsRepoPath: "."`

## MCP Tools (`mcp-server`)

All read-only:

| Tool | Intent |
|------|--------|
| `explain-stage` | Stage methodology text via bridge |
| `glossary` | Term resolve |
| `next-steps` | Workflow orientation |
| `read-artifact` | Guarded artifact read |
| `status` | Current workflow status |

## Extension Commands (`vscode-extension`)

| Command | Purpose |
|---------|---------|
| `aidlc-guide.open` | Open dashboard webview |
| `aidlc-guide.setup` | Setup flow |
| `aidlc-guide.registerMcp` | Register MCP server |
| `aidlc-guide.askBtw` / `.askOneShot` | BTW side session |
| `aidlc-guide.shareLan` | LAN share (dashboard-server path) |

Activation: `workspaceContains:aidlc/`.

Webview file/doc opens must pass `normalizeWebviewPath` / `docTarget` / `fileRefTarget` (path containment).

## Gaps for Docs i18n

| Needed capability | Current API | Gap |
|-------------------|-------------|-----|
| Locale-scoped official docs catalogue | `/api/guides` (product only) | No `/api/...` for `docs/guide` + `docs/reference` with `en`/`ja` |
| Language preference | Read settings partial via docs-settings | No persisted locale preference contract |
| In-app docs site navigation | Stage/glossary + open-doc | Deep link to bundled site pages not yet modeled |
| Upstream sync report | — | Out of runtime API; ops/script concern (Should S1) |

Naming caution: keep product **`/api/guides`** distinct from future official **guide/reference** routes to avoid `guides` vs `guide` collisions.
