# CI/CD Pipeline — Unit: official-docs

> infrastructure-design / official-docs (library) / 2026-07-31

| Gate | Expectation |
|------|-------------|
| `bun run check` | Unit tests + **branch coverage ≥95%** on resolve/load + Biome + tsc |
| PR | Same check on GitHub Actions matrix (existing workflow) |
| Deploy | None — library consumed in-process by api-core / VSIX |

Negative `guardPath` cases must stay in the check suite (NFR-2).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
