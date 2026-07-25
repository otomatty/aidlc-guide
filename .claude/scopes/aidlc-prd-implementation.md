---
name: prd-implementation
depth: Standard
keywords: []
description: Implement an approved PRD for a local greenfield tool - full build path, no operations
skeleton: on
---

# prd-implementation scope

Composed scope (approved 2026-07-20) for implementing `docs/prd/PRD.md`
(AIDLC Guide): a read-only local bun/TypeScript + Vite/React tool with an
MCP server. Greenfield workspace, no production deployment.

## Why these stages, why skip those

The PRD replaces the heavy ideation front: market-research is done in the
PRD itself, there is no team to form, and approval-handoff is superseded by
the human's directive to implement the approved PRD. Reverse-engineering is
skipped because the workspace scan is Greenfield with no application code.
The full inception and construction passes run - the tool is UI-heavy
(mockups matter) and ships explicit FR/NFR lists. The operation phase is
skipped except performance-validation: the PRD quantifies NFR-2/NFR-3
(3s startup, 2s follow-up against a 593-file fixture), but there is no
deploy target, no infra, no prod service to observe or page on.

## Membership

No keyword triggers (`keywords: []`) - resolve explicitly via
`--scope prd-implementation`. Making it inferable is a separate human
choice.
