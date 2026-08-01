# Dependencies — AIDLC Guide

> Reverse-engineering synthesis for intent `260730-docs-i18n`  
> Repo: `aidlc-guide` · Scan HEAD: `7148a19` · Date: 2026-07-31

## Internal Workspace Dependency Graph

```text
shared-types ← core-utils ← reader-core ← api-core ← dashboard-server / vscode-extension / mcp-server
                    ↑            ↑            ↑
                docs-bridge ─────┘       dashboard (wire only; no reader-core import)
```

| Package | Internal workspace deps |
|---------|-------------------------|
| `shared-types` | — |
| `core-utils` | shared-types |
| `docs-bridge` | core-utils, shared-types |
| `reader-core` | core-utils, shared-types (+ chokidar external) |
| `api-core` | docs-bridge, reader-core, shared-types |
| `dashboard` | shared-types only |
| `dashboard-server` | api-core (+ related) |
| `vscode-extension` | api-core (+ related) |
| `mcp-server` | docs-bridge, reader-core, shared-types |
| `btw` | — (no package deps) |

### Coupling notes

- **api-core** is the fan-in hub for dashboard hosts (extension + server).
- **docs-bridge** and **reader-core** are siblings under api-core — do not merge; different sources of truth (maps vs intent records).
- **dashboard → reader-core** is structurally forbidden; all workflow data arrives via wire.
- **mcp-server** may call reader-core and docs-bridge without going through api-core HTTP — acceptable host adapter pattern; keep tool semantics aligned with HTTP reads.

## External Runtime Dependencies (Selected)

| Dependency | Consumers | Risk / note |
|------------|-----------|-------------|
| react, react-dom | dashboard | UI core |
| marked, mermaid, highlight.js | dashboard | Docs rendering weight |
| chokidar | reader-core | Watch; process boundary |
| @modelcontextprotocol/sdk, zod | mcp-server | Agent surface |
| @types/vscode / VS Code API | vscode-extension | Host coupling |

Lockfiles: `bun.lock` / `bun.lockb`. Install: `bun install --frozen-lockfile` in CI.

## Dev / Tool Dependencies

| Dependency | Role |
|------------|------|
| typescript | Compile / typecheck |
| biome | Lint/format |
| vitest, @vitest/coverage-v8 | Tests |
| @testing-library/*, jsdom | Dashboard tests |
| fast-check | Property tests |
| vite, @tailwindcss/vite | Dashboard build |
| esbuild, @vscode/vsce | Extension package |
| bun (toolchain) | Scripts, server, tests |

Dev-time deps are treated as outside shipping runtime constraint C-T1 (project Decided).

## Content / Path Dependencies (Non-npm)

| Resource | Depended on by | Status |
|----------|----------------|--------|
| `aidlc/spaces/.../intents/*` | reader-core | Present when AI-DLC used |
| `.claude/aidlc-common/stages/*` | docs-bridge maps | Present |
| `docs/guides/*` | `/api/guides` | Present |
| `docs/guide/*`, `docs/reference/*` | **Intended** official docs | **Absent** — blocks M1 until M5 snapshot |
| `aidlc-guide.config.json` `docsRepoPath` | docs-bridge excerpts | `.` today; dual-locale layout decision pending |

## Dependency Direction Enforcement

- Biome `noRestrictedImports` for write-FS and package boundaries
- Structural tests in dashboard + reader-core
- Single `guardPath` enforcement — no ad-hoc `path.relative` containment

## Docs-i18n Dependency Impact

Adding official en/ja trees increases:

1. **VSIX / media size** (content + existing mermaid chunks)
2. **api-core / dashboard** surface area (new routes/UI) — should not add reader-core → dashboard edges
3. **Optional tooling deps** for upstream sync/diff (keep out of extension runtime if possible)

Prefer zero new runtime frameworks for locale if content is dual markdown trees keyed by locale path.
