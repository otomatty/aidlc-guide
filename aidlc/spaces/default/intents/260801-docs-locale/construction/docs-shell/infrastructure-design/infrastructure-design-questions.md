# Infrastructure Design Questions — Unit: docs-shell (Bolt 2)

> infrastructure-design / docs-shell (ui) / 2026-08-02  
> Answers: **recommended** (user 「続けてください」)

## Q1. Deployable surface

| Option | Description | Trade-off |
|--------|-------------|-----------|
| **A (Recommended)** | No new deployable — UI ships inside existing vscode-extension / dashboard Webview | Matches NFR-B2-3 / local-only |
| B | Separate static hosting for docs shell | Out of scope / cloud |
| C | New Tauri binary slice | Overkill for Bolt 2 |

**Answer:** A

## Q2. CI gates for UI unit

| Option | Description | Trade-off |
|--------|-------------|-----------|
| **A (Recommended)** | Existing `bun run check` + unit/a11y tests for notice/`role=status`/no official-docs import; no new pipeline | Minimal |
| B | Separate Playwright suite gate | Later if needed |
| C | Visual regression CI | Scope creep |

**Answer:** A

## Q3. Shared infra ownership

| Option | Description | Trade-off |
|--------|-------------|-----------|
| **A (Recommended)** | Reuse monorepo packages + wire via api-core; document forbidden UI→library imports only | ADR-B2-002 |
| B | New shared BFF service | Rejected earlier |

**Answer:** A

## Q4. Monitoring / cloud

| Option | Description | Trade-off |
|--------|-------------|-----------|
| **A (Recommended)** | No cloud monitoring design; local-only — omit monitoring-design / infrastructure-services (ui produces_kinds) | Project DECIDED |
| B | CloudWatch / RUM | Violates local-only |

**Answer:** A

## Q5. Completeness

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Looks correct and generate |
| B | Need more questions |

**Answer:** A — Looks correct and generate
