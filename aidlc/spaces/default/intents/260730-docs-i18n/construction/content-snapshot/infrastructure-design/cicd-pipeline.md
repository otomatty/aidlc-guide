# CI/CD Pipeline — Unit: content-snapshot

> infrastructure-design / content-snapshot (packaging) / 2026-07-31

## Pipeline

| Stage | Action |
|-------|--------|
| PR | Existing GitHub Actions `bun run check` (hygiene/tests as wired) |
| Merge | squash to `main` (trunk) |
| Release | VSIX build includes committed docs trees — no separate docs deploy |

No CD to cloud. Snapshot updates are normal PRs (US-07 for ja).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
