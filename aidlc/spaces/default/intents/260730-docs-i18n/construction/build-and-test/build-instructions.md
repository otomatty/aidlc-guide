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

## Diff report (Bolt 5 / US-08)

Requires an upstream checkout (or fixture) with `docs/guide` and/or `docs/reference`. Use a fixed `--now` so `generatedAt` stays stable across demo regenerations.

```bash
bun scripts/official-docs-diff.ts --upstream <aidlc-workflows-checkout>
# Deterministic fixture demo (committed sample: docs/reviews/official-docs-diff-demo.md):
bun scripts/official-docs-diff.ts \
  --upstream packages/official-docs/tests/fixtures/upstream-docs \
  --out docs/reviews/official-docs-diff-demo.md \
  --now 2026-08-06T04:00:00.000Z
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Missing `@aidlc-guide/official-docs` | Ensure workspace package under `packages/official-docs` and `bun install` |
| Dashboard imports official-docs | Forbidden — fix import; `dependency-direction` test fails |
| Route 404 on `/api/official-docs` | Confirm api-core route registration and workspace `docs/` root |
| Empty TOC | Ensure `docs/guide/en` and `docs/reference/en` have `.md` files |
