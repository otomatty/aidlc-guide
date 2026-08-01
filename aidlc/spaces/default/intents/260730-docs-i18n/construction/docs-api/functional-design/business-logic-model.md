# Business Logic Model — Unit: docs-api

> functional-design / docs-api (library) / 2026-07-31  
> 上流: components.md · component-methods.md · services.md · official-docs FD · requirements.md · stories.md

## Purpose

api-core handlers exposing official docs over the existing transport (postMessage GET / HTTP).

## Routes

| Method/path | Delegates | FR |
|-------------|-----------|-----|
| GET `/api/official-docs/:locale/*` | resolvePage | FR-U2.6 |
| GET `/api/official-docs/toc/:locale` (or list via convention) | listToc | FR-U2.2 |
| GET `/api/official-docs/manifest` | readManifest | FR-U2.4 |

Exact toc/manifest path shape may alias into page responses; pin in code-gen.

## Flow

```text
dashboard/host → handleRead(url) → parse locale/path → official-docs.* → ReadResult JSON
```

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
