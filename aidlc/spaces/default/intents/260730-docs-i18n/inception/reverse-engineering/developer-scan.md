# Developer Code Scan Results

> **Intent**: `260730-docs-i18n` (brownfield, Project Type Brownfield, Scope feature)  
> **Workspace**: `c:\Users\saedg\apps\aidlc-guide` (single-repo)  
> **Scan date**: 2026-07-31  
> **HEAD**: `7148a19`  
> **Scope note**: Full monorepo inventory; deep scan prioritized for docs/i18n-relevant packages.  
> **Out of scope for this artifact**: the 9 final codekb artifacts (architect synthesizes next).

---

## Developer Code Scan Results

### Packages Found

#### Priority (docs / i18n surface)

| Package | npm name | Type | Language | Purpose |
|---------|----------|------|----------|---------|
| `packages/vscode-extension` | `aidlc-guide` | VS Code / Cursor extension (primary surface) | TypeScript | Host for dashboard webview; in-process `api-core`; commands (open, setup, MCP register, btw, LAN share); path containment for webview `open-doc` / `open-file` |
| `packages/dashboard` | `@aidlc-guide/dashboard` | Vite + React SPA (UI) | TypeScript / TSX | Read-only dashboard UI; markdown/mermaid viewer; Guides panel; talks to server over GET/WS or VS Code postMessage — **never imports reader-core** |
| `packages/docs-bridge` | `@aidlc-guide/docs-bridge` | Library | TypeScript | Single owner of slug/term → docs mapping (`bridge-map.json` / `agent-map.json`); stage/term resolve + excerpt slicing; zero third-party runtime deps |
| `packages/reader-core` | `@aidlc-guide/reader-core` | Library | TypeScript | Read-only view of AI-DLC workspace records: state parse, matrix, audit, timings, watch (chokidar); UI/transport independent |
| `packages/api-core` | `@aidlc-guide/api-core` | Library | TypeScript | Transport-agnostic handlers, hub, service factory; GET routing + sole write (`POST /api/answer`); consumes docs-bridge + reader-core |
| `packages/shared-types` | `@aidlc-guide/shared-types` | Types / pure helpers | TypeScript | Wire contract only (~621 LOC); `ReadResult`, workflow/matrix/timings, `StageDoc`/`TermDoc`/`MarkdownDoc`, WS messages, answer types — **zero runtime deps** |

#### Other packages (brief)

| Package | npm name | Purpose |
|---------|----------|---------|
| `packages/core-utils` | `@aidlc-guide/core-utils` | Path containment (`guardPath`), `withResult`, `readBounded`, `mapBounded` — single enforcement point for FS reads |
| `packages/dashboard-server` | `@aidlc-guide/dashboard-server` | Bun HTTP/WS server + static SPA; CLI bin `aidlc-dashboard`; Mob LAN / browser secondary surface |
| `packages/mcp-server` | `@aidlc-guide/mcp-server` | MCP stdio server (`@modelcontextprotocol/sdk`); five read-only tools over reader-core + docs-bridge |
| `packages/btw` | `@aidlc-guide/btw` | CLI to launch a read-only (plan mode) Claude Code side session; no package deps |

**Dependency direction** (from `packages/README.md`):

```text
shared-types ← core-utils ← reader-core ← api-core ← dashboard-server / vscode-extension / mcp-server
                    ↑            ↑            ↑
                docs-bridge ─────┘       dashboard (wire only; no reader-core import)
```

---

### Build System

- **Type**: bun workspaces monorepo (`"workspaces": ["packages/*"]` in root `package.json`)
- **Package manager / runtime**: bun (lockfiles: `bun.lock`, `bun.lockb`); TypeScript `^5.9.3`
- **Config Files**:
  - Root: `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `bun.lock` / `bun.lockb`
  - Dashboard: `packages/dashboard/vite.config.ts` (mode `webview` → outDir `../vscode-extension/media/dashboard`, `base: "./"`)
  - Extension: `packages/vscode-extension/esbuild.mjs` → `dist/extension.js`; packaged via `@vscode/vsce`
  - Per-package: several `tsconfig.json` under packages; dashboard `components.json` (shadcn)
  - Workspace docs bridge config: `aidlc-guide.config.json` (`docsRepoPath: "."`)
- **Root scripts**:
  - `check` — single quality gate: `biome check . && tsc --noEmit` (+ dashboard & vscode-extension projects) `&& vitest run --coverage && bun scripts/check-audit-shards.ts && bun audit`
  - `test` / `lint` / `format`
  - `build:dashboard`, `build:dashboard:webview`, `build:extension`, `package:extension`, `dashboard`
- **Build Dependencies** (workspace graph):
  - `shared-types` → (none)
  - `core-utils` → `shared-types`
  - `docs-bridge` → `core-utils`, `shared-types`
  - `reader-core` → `core-utils`, `shared-types` (+ `chokidar`)
  - `api-core` → `docs-bridge`, `reader-core`, `shared-types`
  - `dashboard` → `shared-types` only (+ React/UI stack)
  - `dashboard-server` / `vscode-extension` → `api-core` (+ related)
  - `mcp-server` → `docs-bridge`, `reader-core`, `shared-types`, MCP SDK, zod
  - `btw` → (none)

---

### APIs Discovered

#### HTTP / transport-agnostic API (`packages/api-core`)

Routed by `routeRead` / `handleRead` (also used by VS Code postMessage transport):

| Method | Path | Role |
|--------|------|------|
| GET | `/api/workflow` | Stage-1 first paint: state parse + next-step + serverMode (no matrix) |
| GET | `/api/timings` | Stage timing views (off first-paint critical path) |
| GET | `/api/matrix` | Full matrix or `{ building: true }` until background scan finishes |
| GET | `/api/io-paths?stage=&unit=` | Stage I/O markdown path listing |
| GET | `/api/artifact?path=` | Guarded artifact read under record dir |
| GET | `/api/intents` | Intent list |
| GET | `/api/links` | Project links from bridge config |
| GET | `/api/docs-settings` | `docsBaseUrl` + `stageDocs` overrides |
| GET | `/api/guides` | Catalogue of `docs/guides/*.md` |
| GET | `/api/guides/:name` | Single usage guide markdown |
| GET | `/api/agents/:id` | Agent persona (from agent-map / persona markdown) |
| GET | `/api/agents/:id/knowledge/:name` | Agent knowledge markdown under workspace |
| GET | `/api/stage/:slug` | Stage doc via docs-bridge (`StageDoc` + optional excerpt) |
| GET | `/api/glossary/:term` | Term doc via docs-bridge |
| POST | `/api/answer` | **Sole write surface** (AnswerWriter) — not in dashboard `services/api.ts` GET helpers |

Unknown `/api/*` → `UNKNOWN_ROUTE` (`404`, `unknown-route`).

#### WebSocket push (`api-core` hub / dashboard-server)

- `matrix-ready`, `change` (audit / matrix cells), `live-status` (degraded), etc. (`WsMessage` in shared-types)
- Browser: native WebSocket; VS Code webview: host forwards as `{ type: "push", message }`

#### MCP tools (`packages/mcp-server`) — 5 read-only tools

- `explain-stage`, `glossary`, `next-steps`, `read-artifact`, `status`

#### Extension commands (`packages/vscode-extension`)

- `aidlc-guide.open`, `.setup`, `.registerMcp`, `.askBtw`, `.askOneShot`, `.shareLan`
- Activation: `workspaceContains:aidlc/`

#### Docs-bridge public surface

- `createBridge()` → `getConfig`, `resolveStage`, `resolveTerm`, `projectLinks`
- Static maps: 32 stages, 9 terms, 15 agents; all stage `docPath` values currently under `.claude/aidlc-common/stages/...` (not `docs/guide/`)

---

### Frameworks & Libraries

| Name | Version (approx) | Purpose |
|------|------------------|---------|
| TypeScript | ^5.9.3 | Primary language |
| bun | 1.3.6 (CI pin) | Runtime, workspaces, dashboard-server |
| React / react-dom | ^19.2.0 | Dashboard UI |
| Vite | ^7.1.0 | Dashboard build; webview mode for extension |
| Vitest + @vitest/coverage-v8 | ^4.1.10 | Tests + coverage floors |
| Biome | ^2.3.14 (schema 2.5.5) | Lint + format |
| marked | ^16.4.2 | Markdown lexer → React (MarkdownSurface) |
| mermaid | ^11.16.0 | Diagram fences in viewer |
| highlight.js | ^11.11.1 | Code fence highlighting |
| Tailwind CSS + @tailwindcss/vite | ^4.3.3 | Dashboard styling |
| @base-ui/react / shadcn / lucide-react | various | UI primitives |
| chokidar | ^4.0.3 | reader-core file watch |
| esbuild | ^0.25.0 | Extension host bundle |
| @vscode/vsce / @types/vscode | engines ^1.85.0 | Package / types |
| @modelcontextprotocol/sdk | ^1.29.0 | mcp-server |
| zod | ^4.4.3 | mcp-server validation |
| fast-check | ^4.9.0 | Property tests (e.g. timings) |
| Testing Library + jsdom | ^16 / ^27 | Dashboard component tests |

**Not present**: any i18n library (`react-i18next`, `lingui`, `@formatjs`, etc.) — no locale switcher or message catalogs in application code.

---

### Test Coverage

- **Test Directories**: `packages/*/tests/**` (node project); `packages/dashboard/tests/**` (jsdom project)
- **Approx test file counts**:
  - dashboard: 27 · reader-core: 17 · dashboard-server: 6 · docs-bridge: 5 · mcp-server: 5 · btw: 5 · core-utils: 5 · api-core: 4 · shared-types: 2 · vscode-extension: 2
- **Test Frameworks**: Vitest (dual projects: `node` + `dashboard`); RTL for React; fast-check for properties; process-boundary smoke via spawned Bun (dashboard-server / mcp-server)
- **Coverage Config**: **present** in `vitest.config.ts`
  - Provider: v8; include `packages/*/src/**/*.ts` + dashboard TSX
  - Thresholds: `packages/reader-core/src/parse/**` gated at **95%** branches/statements/functions/lines
  - Explicit excludes for process-boundary entrypoints (btw spawn/cli, dashboard-server server/cli, mcp index, dashboard `main.tsx`)
- **Structural tests**: dependency-direction tests in dashboard + reader-core; Biome `noRestrictedImports` for write-FS and package boundaries

---

### Code Quality Indicators

- **Linting**: Biome at repo root (`biome.json`)
  - Formatter: spaces=2, lineWidth=100, **LF** line endings
  - Linter: recommended preset + heavy `noRestrictedImports` overrides (btw / reader packages / dashboard write boundaries)
  - Ignores: `node_modules`, `dist`, `coverage`, `packages/vscode-extension/media`, `aidlc`, `docs`, `.claude`, `.cursor`
- **CI/CD**:
  - GitHub Actions: `.github/workflows/check.yml` — matrix `ubuntu-latest` / `windows-latest` / `macos-latest`; `bun install --frozen-lockfile` then `bun run check`
  - Workflow comment: historically “NOT YET VERIFIED” against a remote at authoring time — treat first remote run as acceptance
  - Local optional hook: `scripts/hooks/pre-push` → `bun run check` (manual install into `.git/hooks`; not auto-wired)
- **Documentation**:
  - `packages/README.md` — authoritative package placement / dependency-direction map
  - Per-package descriptions in `package.json`; mcp-server / btw READMEs
  - Product usage guides under `docs/guides/` (8 markdown files)
  - PRD / plans under `docs/prd`, `docs/superpowers`, etc.
  - Inline design comments dense in api-core / docs-bridge / dashboard services
- **Typechecking**: root `tsc --noEmit` plus explicit projects for dashboard and vscode-extension inside `check`

---

### Technical Debt Signals

1. **Missing upstream docs trees for this intent** — `docs/guide/` and `docs/reference/` **do not exist**. Confirms feasibility Conditional Go: official aidlc-workflows guide/reference snapshot is not yet in-repo. Current `docs/` has `guides/`, `prd/`, `perf/`, `reviews/`, `superpowers/` only.
2. **Naming collision: `docs/guides` vs `docs/guide`** — Product usage guides live at `docs/guides/` and are already wired (`GET /api/guides`, `GuidesPanel`). Intent docs i18n targets `docs/guide` + `docs/reference` (singular) for official methodology docs — easy to confuse in design/impl.
3. **bridge-map points at `.claude/aidlc-common/stages/*`, not `docs/guide`** — All 32 stage `docPath`s are under the framework shell. Learner-facing **Japanese** copy already lives in `bridge-map.json` / `agent-map.json` purpose strings — parallel to (not the same as) a future en/ja doc site.
4. **No i18n / locale infrastructure** — No locale preference, language toggle, or dual-tree content loader. Closest UI is markdown viewer (`MarkdownSurface` / `GuidesPanel` / artifact viewer) and deep-link open-doc in IDE.
5. **Committed webview build artifacts** — `packages/vscode-extension/media/dashboard/assets/*` is a large built SPA (mermaid chunks, etc.); Biome ignores this tree. Bundle size for shipping en+ja docs will need NFR attention (feasibility residual risk).
6. **CI workflow unverified caveat** — check.yml itself documents first-run acceptance risk; local gate (`bun run check`) is the source of truth per project practice.
7. **Fixture path drift** — Some tests still cite `docs/guide/0x-….md` deep links while production bridge-map uses `.claude/aidlc-common/...` and product guides use `docs/guides/` (e.g. dashboard fixtures, mcp-server tests). Harmless for green tests if mocked, but signals incomplete migration of path conventions.
8. **Extension test thinness** — Only 2 test files under vscode-extension vs rich dashboard/reader-core suites; host path containment is covered, but UI/host integration is thinner.
9. **docsRepoPath = `.`** in `aidlc-guide.config.json` — excerpts resolve against workspace root + bridge `docPath`; works for `.claude/...` today, but a dual-locale bundled tree will need a deliberate root/layout decision (content pipeline before Construction).

---

## Docs / i18n relevance (scan notes for architect)

### What already exists that docs-i18n can reuse

| Capability | Location | Relevance |
|------------|----------|-----------|
| Markdown + Mermaid viewer | `packages/dashboard/src/viewer/*` | Natural host for in-extension docs site pages |
| Guides catalogue UI | `GuidesPanel` / `GuidesButton` + `/api/guides` | Pattern for listing docs; currently **product** guides only |
| Stage/term deep links | docs-bridge + `docsOpenHref` / `openDocInIde` | External or workspace-file open; not an in-app bilingual site |
| Lazy markdown split | `lazy-markdown.ts` | Keeps mermaid off first paint — keep for large doc sets |
| Dual transport | browser fetch/WS + VS Code postMessage | Docs UI in webview can reuse same transport |

### What does **not** exist yet (gap for this intent)

- Bundled `docs/guide/**` and `docs/reference/**` (en/ja or en-only snapshot)
- Locale switcher UI / persisted language preference
- Content sync / diff-report pipeline vs upstream aidlc-workflows
- API routes for locale-scoped official docs (distinct from `docs/guides`)
- VSIX packaging of large static markdown trees

### Docs tree status (verified this scan)

| Path | Status |
|------|--------|
| `docs/guides/` | **Present** — AIDLC Guide product usage docs |
| `docs/guide/` | **Absent** |
| `docs/reference/` | **Absent** |
| `.claude/aidlc-common/stages/` | **Present** — current bridge-map deep-link targets (~37 md under aidlc-common) |

---

## Scan metadata

- **Scanner**: aidlc-developer-agent (RE Step 2 — Developer Code Scan)
- **Prioritized packages**: vscode-extension, dashboard, docs-bridge, reader-core, api-core, shared-types
- **Also inventoried**: core-utils, dashboard-server, mcp-server, btw
- **Method layers consulted**: `project.md` (Code Style / Decided); empty-section fallback not required for scan inventory
- **Next**: Architect synthesizes the 9 codekb artifacts from this scan + architecture analysis
