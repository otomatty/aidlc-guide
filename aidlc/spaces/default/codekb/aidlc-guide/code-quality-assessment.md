# Code Quality Assessment — AIDLC Guide

> Reverse-engineering synthesis for intent `260730-docs-i18n`  
> Repo: `aidlc-guide` · Scan HEAD: `7148a19` · Date: 2026-07-31

## Testing and Coverage

| Area | Assessment |
|------|------------|
| Framework | Vitest dual projects (`node` + `dashboard` jsdom) |
| Approx test files | dashboard 27 · reader-core 17 · dashboard-server 6 · docs-bridge 5 · mcp-server 5 · btw 5 · core-utils 5 · api-core 4 · shared-types 2 · vscode-extension 2 |
| Coverage | Configured (v8); **95%** floor on `packages/reader-core/src/parse/**` |
| Excludes | Process-boundary entrypoints (btw CLI, dashboard-server server/cli, mcp index, dashboard `main.tsx`) |
| Strengths | Structural dependency-direction tests; property tests (fast-check); process-boundary smoke for server/mcp |
| Weaknesses | Extension host suite thin (2 files); fewer api-core tests relative to orchestration importance |

**Verdict:** Core parse/read path quality is strong. Host integration and future docs-locale paths will need new tests (catalogue, locale switch, path containment for bundled trees).

## Linting, Types, and CI

| Control | Detail | Assessment |
|---------|--------|------------|
| Biome | Root `biome.json`; restricted imports for FS writes & package walls | Strong structural safety |
| Typecheck | `tsc --noEmit` + dashboard & vscode-extension projects in `check` | Strong |
| Single gate | `bun run check` = biome + tsc + vitest coverage + audit-shard script + `bun audit` | Aligns with project practice |
| CI | GHA matrix 3 OS; frozen lockfile | Good intent; workflow self-notes first remote run acceptance risk |
| Pre-push | Optional manual hook | Local gate remains source of truth |

## Documentation Quality

| Asset | Quality |
|-------|---------|
| `packages/README.md` | Authoritative placement / dependency map — excellent |
| Per-package package.json descriptions | Present |
| mcp-server / btw READMEs | Present |
| Inline design comments (api-core, docs-bridge, dashboard services) | Dense and useful |
| Product `docs/guides/` | Present (usage) |
| Official `docs/guide` + `docs/reference` | Missing — content gap, not doc-of-code gap |

## Technical Debt Register (from scan + architect view)

| ID | Signal | Severity for docs-i18n | Mitigation direction |
|----|--------|------------------------|----------------------|
| D1 | `docs/guide/` & `docs/reference/` absent | **Blocker** for M1 | M5 upstream snapshot first |
| D2 | Naming collision `docs/guides` vs `docs/guide` | High confusion | Distinct API routes & UI labels |
| D3 | bridge-map → `.claude/aidlc-common`, not official trees | High | Redirect/degrade excerpts (M6); optional map updates |
| D4 | No locale infrastructure | High | Design locale preference + dual tree loader |
| D5 | Committed webview build artifacts (large) | Medium (NFR) | Size budget; avoid shipping unused locales in first paint |
| D6 | CI “not yet verified” caveat | Low–medium | Treat `bun run check` as truth until green remote |
| D7 | Fixture path drift (`docs/guide/...` in tests vs production maps) | Medium | Normalize fixtures when snapshot lands |
| D8 | Extension test thinness | Medium | Add host open-doc + webview message tests with locale paths |
| D9 | `docsRepoPath = "."` | Medium | Explicit layout for bundled dual-locale roots |

## Architectural Risk Alignment

| Risk area | Coverage vs risk |
|-----------|------------------|
| Path containment / read-only | Well enforced (core-utils + Biome) — preserve for docs trees |
| First-paint performance | Designed (workflow vs matrix) — docs site must not regress NFR-2 |
| Docs content correctness | Weak today (no official trees) — quality shifts to content pipeline + snapshot review |
| Multi-host parity | api-core shared — new docs routes must ship on HTTP and postMessage alike |

## Overall Quality Verdict

The brownfield codebase is **architecturally disciplined** (clear package DAG, transport-agnostic core, strong parse coverage). For intent `260730-docs-i18n`, quality risk is less about spaghetti and more about **missing content, naming collisions, and packaging/NFR**. Prefer extending Guides/viewer/api-core patterns over introducing a parallel docs stack.
