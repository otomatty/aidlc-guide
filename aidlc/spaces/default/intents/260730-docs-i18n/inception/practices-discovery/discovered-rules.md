# Discovered Rules — Docs i18n

> Stage: practices-discovery · Intent: `260730-docs-i18n`  
> Status: **INTEGRATED — pending affirmation** · Interview 2026-07-31 · HEAD `7148a19`

## Mandated

> Format: ALWAYS \[behavior\]

**Inherited (team/project — Q7 = A):**

- ALWAYS treat `aidlc/spaces/<active-space>/` and application repos as read-only except `[Answer]:` lines in `*-questions.md`.
- ALWAYS use bun as the shipped runtime; keep Vitest as dev-time only.
- ALWAYS use `bun run check` as the single quality-gate definition; wire new checks into that script.
- ALWAYS use cross-platform path APIs (`node:path` / `vscode.Uri`); no hardcoded separators.
- ALWAYS keep `dashboard` free of `reader-core` imports.

**Affirmed this interview:**

- ALWAYS place official bundled docs under `docs/guide/<locale>/` and `docs/reference/<locale>/` with locale codes `en` / `ja`.
- ALWAYS expose official docs HTTP/postMessage API under `/api/official-docs/:locale/*` (not `/api/guides` or `/api/docs` colliding with `/api/docs-settings`).
- ALWAYS implement locale resolve/content load with **95% branch coverage** (same class as reader-core parse).
- ALWAYS route bundled-docs reads through `guardPath` against a locale content root; include **negative containment tests** in `bun run check`.
- ALWAYS keep the docs content loader in `api-core` (or a domain sibling below it), never in `reader-core` or `dashboard`.
- ALWAYS keep VSIX free of secrets, `.env`, and `aidlc/` runtime state (package hygiene — independent of size budget).

## Forbidden

> Format: NEVER \[behavior\]

**Inherited:**

- NEVER add cloud/AWS service dependencies for this local-only tool.
- NEVER modify aidlc-workflows engine/stage definitions/audit format as part of this project.
- NEVER write to aidlc state/audit except the questions `[Answer]:` exception.

**Affirmed this interview / RE:**

- NEVER use `/api/guides` or `docs/guides/` for official aidlc-workflows guide+reference trees.
- NEVER introduce a continuous machine-translation auto-publish pipeline (bootstrap AI translation + human PR updates only).
- NEVER introduce an i18n message-catalog library for doc-body locale switching (content-tree switching only).
- NEVER create a docs-i18n-specific Walking Skeleton ceremony that replaces the affirmed team.md skeleton stance (Q1 = C).
- NEVER enforce a VSIX size hard-fail in `bun run check` until NFR sets a budget (Q3 = C); do not confuse this with package-hygiene Mandated above.
