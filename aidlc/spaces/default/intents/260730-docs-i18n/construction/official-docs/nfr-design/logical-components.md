# Logical Components — Unit: official-docs

> nfr-design / official-docs (library) / 2026-07-31

| Component | Responsibility |
|-----------|----------------|
| `manifest.ts` | readManifest |
| `resolve.ts` | resolvePage + missing_ja + anchor |
| `toc.ts` | listToc |
| `stage-map.ts` | mapStageToDoc static data |
| `roots.ts` | locale content root helpers |

Depends on: `core-utils`, `shared-types`. Consumers: `api-core` only (in-process).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
