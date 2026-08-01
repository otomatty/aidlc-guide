# Technology Stack — AIDLC Guide

> Reverse-engineering synthesis for intent `260730-docs-i18n`  
> Repo: `aidlc-guide` · Scan HEAD: `7148a19` · Date: 2026-07-31

## Languages and Runtimes

| Technology | Version (approx) | Role |
|------------|------------------|------|
| TypeScript | ^5.9.3 | Primary language across packages |
| bun | 1.3.6 (CI pin) | Package manager, workspaces, dashboard-server runtime, scripts |
| Node (VS Code embedded) | engines VS Code ^1.85.0 | Extension host runtime (DECIDED exception to “bun-only” shipping for CLI paths) |

## Application Frameworks

| Name | Version (approx) | Used by | Purpose |
|------|------------------|---------|---------|
| React / react-dom | ^19.2.0 | dashboard | UI |
| Vite | ^7.1.0 | dashboard | SPA build; `webview` mode → extension media |
| esbuild | ^0.25.0 | vscode-extension | Host bundle → `dist/extension.js` |
| @modelcontextprotocol/sdk | ^1.29.0 | mcp-server | MCP stdio server |
| zod | ^4.4.3 | mcp-server | Tool input validation |

## UI and Content Rendering

| Name | Version (approx) | Purpose |
|------|------------------|---------|
| Tailwind CSS + @tailwindcss/vite | ^4.3.3 | Dashboard styling |
| @base-ui/react / shadcn / lucide-react | various | UI primitives |
| marked | ^16.4.2 | Markdown lexer → React (MarkdownSurface) |
| mermaid | ^11.16.0 | Diagram fences |
| highlight.js | ^11.11.1 | Code fence highlighting |

**Not present:** `react-i18next`, `lingui`, `@formatjs`, or other i18n message libraries. Locale UX for docs-i18n will be greenfield (likely content-tree switching, not ICU message catalogs — unless UI chrome needs strings).

## Data / FS / Watch

| Name | Version (approx) | Purpose |
|------|------------------|---------|
| chokidar | ^4.0.3 | reader-core file watch |
| Workspace markdown / JSON maps | — | Intent records + bridge maps |

## Quality Toolchain

| Name | Version (approx) | Purpose |
|------|------------------|---------|
| Biome | ^2.3.14 (schema 2.5.5) | Lint + format (LF, width 100) |
| Vitest + @vitest/coverage-v8 | ^4.1.10 | Unit/component tests + coverage |
| Testing Library + jsdom | ^16 / ^27 | Dashboard component tests |
| fast-check | ^4.9.0 | Property tests (e.g. timings) |
| TypeScript `tsc --noEmit` | via check | Type gate (root + dashboard + extension projects) |
| @vscode/vsce | — | Package VSIX |

## CI / Platform

| Piece | Detail |
|-------|--------|
| GitHub Actions | `.github/workflows/check.yml` — ubuntu / windows / macos; `bun install --frozen-lockfile` → `bun run check` |
| Local gate | Root script `check` is source of truth |
| Optional | `scripts/hooks/pre-push` → `bun run check` (manual install) |

## Stack Implications for Docs i18n

| Decision area | Stack fit |
|---------------|-----------|
| Offline markdown site in extension | Fits existing Vite webview + marked/mermaid stack |
| Dual locale trees | No i18n lib required for page bodies; need content layout + API |
| Bundle size | mermaid already large in committed media; en+ja markdown adds VSIX weight — NFR concern |
| Sync vs upstream | Outside runtime stack; scripts/CI/docs ops |
| Cloud CMS | Explicitly out of stack and out of scope |
