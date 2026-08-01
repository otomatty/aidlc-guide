# Tech Stack Decisions — Unit: official-docs

> nfr-requirements / official-docs (library) / 2026-07-31

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | Monorepo standard |
| Package | `@aidlc-guide/official-docs` new workspace pkg | ADR-001 |
| FS safety | `@aidlc-guide/core-utils` `guardPath` | Single enforcement |
| Results | Existing ReadResult / withResult style | Match reader-core |
| Tests | Vitest + 95% branch | practices / NFR-3 |
| Not used | HTTP client, React, chokidar (unless later watch — out of MVP) | Keep pure |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
