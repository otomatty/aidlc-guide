# Build Instructions — Docs i18n (Bolt 1)

## Prerequisites

- **bun** on PATH (`bun --version`)
- Workspace install: `bun install` from repo root
- No cloud services; content is workspace-local under `docs/`

## Install

```bash
bun install
```

## Typecheck

Root project + dashboard (official-docs / api-core compile via root `tsc`):

```bash
bunx tsc --noEmit
bunx tsc --noEmit -p packages/dashboard
```

Optional extension check (not required for Bolt 1 skeleton DoD):

```bash
bunx tsc --noEmit -p packages/vscode-extension
```

## Build (dashboard / extension)

```bash
bun run build:dashboard:webview
bun run build:extension
```

Bolt 1 demo path: open Docs Shell in the extension webview after `build:extension`.

## Content packaging (no compile step)

Verify trees exist (US-01 / US-07):

```bash
ls docs/guide/en docs/reference/en docs/guide/ja
bun -e "console.log(JSON.parse(require('fs').readFileSync('docs/official-docs.manifest.json','utf8')))"
```

Required manifest fields: `sourceVersion`, `source`, `capturedAt`.

## Diff CLI stub (Should)

```bash
bun scripts/official-docs-diff.ts
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Missing `@aidlc-guide/official-docs` | Ensure workspace package under `packages/official-docs` and `bun install` |
| Dashboard imports official-docs | Forbidden — fix import; `dependency-direction` test fails |
| Route 404 on `/api/official-docs` | Confirm api-core route registration and workspace `docs/` root |
| Empty TOC | Ensure `docs/guide/en` and `docs/reference/en` have `.md` files |
