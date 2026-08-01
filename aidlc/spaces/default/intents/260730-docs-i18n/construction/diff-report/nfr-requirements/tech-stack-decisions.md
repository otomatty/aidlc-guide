# Tech Stack Decisions — Unit: diff-report

> nfr-requirements / diff-report (packaging, Should) / 2026-07-31

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | bun script/CLI in monorepo | Existing toolchain |
| Diff | File/tree compare vs upstream checkout or git | FR-U6 Open Question on format → FD/B5 |
| Output | Markdown or text report (pin in code-gen) | Usable as translate-PR input |
| Cuttable | Yes — not in S-docs-1 Done | Q3 scope |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
