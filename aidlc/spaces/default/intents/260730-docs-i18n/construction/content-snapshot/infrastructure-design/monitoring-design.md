# Monitoring Design — Unit: content-snapshot

> infrastructure-design / content-snapshot (packaging) / 2026-07-31

## Monitoring

| Signal | Approach |
|--------|----------|
| Content presence | File/tree asserts in tests / `bun run check` consumers |
| Manifest freshness | Human review of `sourceVersion` / `capturedAt` on update PRs |
| Runtime SLIs | N/A for packaging (readers monitored in other units) |

No APM, no cloud metrics.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
