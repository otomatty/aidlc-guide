# Business Overview — AIDLC Guide

> Reverse-engineering synthesis for intent `260730-docs-i18n`  
> Repo: `aidlc-guide` · Scan HEAD: `7148a19` · Date: 2026-07-31

## Purpose and Domain

AIDLC Guide is a **local-only** learning and orientation product for AI-DLC (AI-Driven Development Life Cycle) workflows. It helps beginners and mob participants answer: *Where am I in the workflow, what happens next, and where is the methodology explanation?*

The product does **not** host cloud services, CMS, or AWS. Value is delivered through:

1. A **VS Code / Cursor extension** (primary surface) that embeds a dashboard webview and runs API logic in-process.
2. A **read-only view** of the workspace’s AI-DLC intent records (`aidlc/spaces/.../intents/...`).
3. **Methodology / docs deep links** via a docs bridge (stage, glossary, agent persona metadata).
4. Secondary surfaces: Bun HTTP/WS dashboard server (Mob LAN / browser) and an MCP stdio server for agent tooling.

Intent `260730-docs-i18n` extends this domain: **bundle official aidlc-workflows guide + reference docs (en/ja)** inside the extension, with language switching and offline reading, while keeping the existing workflow dashboard as the navigation hub.

## Key Capabilities (As Built)

| Capability | Business value | Owning packages |
|------------|----------------|-----------------|
| Workflow “now” strip & stage rail | First-paint orientation without full matrix scan | `reader-core`, `api-core`, `dashboard` |
| Unit × stage matrix | Progress / audit visibility after background scan | `reader-core`, `api-core` hub WS |
| Artifact & I/O path browsing | Read intent-record markdown safely | `reader-core`, `core-utils` (`guardPath`) |
| Stage / glossary / agent docs | Methodology context at the point of work | `docs-bridge`, `api-core`, IDE open-doc |
| Product usage guides | How to use AIDLC Guide itself (`docs/guides/`) | `api-core` `/api/guides*`, `GuidesPanel` |
| Answer write-back | Sole intentional write from dashboard UX | `api-core` `POST /api/answer` |
| MCP tools | Agents explain stage / glossary / status without UI | `mcp-server` |
| BTW side session | Launch read-only Claude Code plan-mode helper | `btw`, extension command |

## Stakeholders and Surfaces

| Persona | Primary surface | Notes |
|---------|-----------------|-------|
| Learner / beginner in IDE | VS Code extension webview | Extension-first (DECIDED) |
| Mob participant without extension | Browser via `dashboard-server` | Same `api-core` handlers |
| Coding agent | MCP five tools | Read-only over reader-core + docs-bridge |
| Maintainer of docs-i18n | Repo + VSIX packaging | Future: `docs/guide` + `docs/reference` trees |

## Relevance to Docs i18n Feature

**As-is:** Official methodology deep links resolve through `docs-bridge` maps into `.claude/aidlc-common/stages/...`. Product guides live under `docs/guides/`. There is **no** bundled bilingual official docs site (`docs/guide/` and `docs/reference/` are absent).

**To-be (this intent):** The same extension + dashboard + api-core stack becomes the host for an offline en/ja docs site; stage excerpts and bridge deep links should **degrade / redirect** to that site (scope M6). Upstream snapshot intake is a prerequisite (scope M5).

## Business Constraints Observed in Code

- Local-only, no network fetch of docs at runtime.
- Read-mostly architecture; writes concentrated and lint-fenced.
- Japanese learner-facing strings already appear in bridge purpose metadata — parallel to, not a substitute for, a future ja doc tree.
