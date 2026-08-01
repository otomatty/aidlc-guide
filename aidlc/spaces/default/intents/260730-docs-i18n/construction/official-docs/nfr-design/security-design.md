# Security Design — Unit: official-docs

> nfr-design / official-docs (library) / 2026-07-31

| Control | Design | Maps to |
|---------|--------|---------|
| Containment | All reads via `guardPath(localeRoot, rel)` | S-OD-1/2 |
| Reject shape | Result `path_rejected` (no throw of raw paths to UI) | S-OD-2 |
| No network | Package has zero HTTP deps | S-OD-3 |
| Coverage | Vitest branch ≥95% on resolve/load | S-OD-5 |

AWS: N/A.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
