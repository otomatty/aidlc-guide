# Infrastructure Services — Unit: content-snapshot

> infrastructure-design / content-snapshot (packaging) / 2026-07-31

## Services

| Service | Role |
|---------|------|
| Git / GitHub | Source of truth for trees + manifest |
| bun (optional script) | Ingest/copy from upstream aidlc-workflows docs |
| VS Code VSIX packager | Bundles committed trees at release time |

No databases, queues, or object stores.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
