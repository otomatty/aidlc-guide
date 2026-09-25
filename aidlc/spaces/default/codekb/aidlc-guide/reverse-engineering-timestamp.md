# Reverse Engineering Timestamp — AIDLC Guide

> CodeKB synthesis for intent `260923-docs-ask-chat`（Full rescan / UNKNOWN_SCOPE wholesale replace）

## Analysis Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-09-24 |
| **Timestamp (UTC)** | 2026-09-24T01:53:00Z |
| **Commit hash** | `1702755bcfa54e25ffa99afcce25d834efad23d9` |
| **Intent** | `260923-docs-ask-chat` |
| **Project type** | Brownfield · Full rescan |
| **Workspace** | `aidlc-guide`（single-repo root `.`） |
| **Staging path** | `aidlc/spaces/default/intents/260923-docs-ask-chat/.aidlc-engine/codekb-stage-aidlc-guide/` |
| **Developer scan** | `aidlc/spaces/default/intents/260923-docs-ask-chat/inception/reverse-engineering/developer-scan.md` |
| **Architect** | aidlc-architect-agent（RE Architect Synthesis） |

## Artifacts Produced

1. `business-overview.md`
2. `architecture.md`（Mermaid + Interaction Diagrams）
3. `code-structure.md`
4. `api-documentation.md`
5. `component-inventory.md`
6. `technology-stack.md`
7. `dependencies.md`
8. `code-quality-assessment.md`
9. `reverse-engineering-timestamp.md`（本ファイル）

## Pipeline Position

- **Prior:** Developer Code Scan complete
- **This step:** Architect Synthesis — staged candidates only（未 publish）
- **Next:** conductor が staged ディレクトリを publish; 本エージェントは publish / orchestrate しない

## Scope of Analysis

```yaml
scope_version: 1
kind: full
intent: 260923-docs-ask-chat
fingerprint: bb3686e78bae5880af012843e8be8ad6bd55991f
analyzed:
  paths:
    - ./
  components:
    - shared-types
    - core-utils
    - reader-core
    - docs-bridge
    - official-docs
    - api-core
    - dashboard
    - dashboard-server
    - vscode-extension
    - mcp-server
    - btw
shallow:
  paths:
    - packages/dashboard/src/features/docs/components/qa/EvidenceApplier.tsx
    - packages/dashboard/src/features/docs/components/qa/AnchorApplier.tsx
    - packages/dashboard/src/features/docs/DocsPage.test.tsx
    - packages/api-core/src/ai-cli/scratch.ts
    - packages/api-core/src/ai-cli/copilot.ts
    - packages/official-docs/src/retrieval
    - packages/official-docs/src/roots.ts
    - packages/reader-core/
    - packages/docs-bridge/
    - packages/core-utils/
    - packages/vscode-extension/src/
    - packages/dashboard-server/src/
    - docs/
    - .claude/
    - .cursor/
    - aidlc/
```
