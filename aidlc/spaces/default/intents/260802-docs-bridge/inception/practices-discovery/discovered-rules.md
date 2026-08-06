# Discovered Rules — Docs i18n Bolt 4

> Stage: practices-discovery · Intent: `260802-docs-bridge`  
> Status: **INTEGRATED — pending affirmation** · Interview 2026-08-03 · HEAD `ee2fc24`  
> Q4 = A: 新規 Mandated/Forbidden は追加しない（継承のみ + Testing 実践の更新は team-practices）

## Mandated

> Format: ALWAYS \[behavior\]

**Inherited (prior docs-i18n affirmation / project):**

- ALWAYS use `bun run check` as the single quality-gate definition; wire new checks into that script.
- ALWAYS place official bundled docs under `docs/guide/<locale>/` and `docs/reference/<locale>/` with locale codes `en` / `ja`.
- ALWAYS expose official docs API under `/api/official-docs/:locale/*`.
- ALWAYS implement locale resolve/content load with **95% branch coverage** (official-docs class).
- ALWAYS route bundled-docs reads through `guardPath` against a locale content root; include negative containment tests in `bun run check`.
- ALWAYS keep the docs content loader in `api-core` / `official-docs`, never in `reader-core` or `dashboard`.
- ALWAYS keep VSIX free of secrets, `.env`, and `aidlc/` runtime state.
- ALWAYS keep `dashboard` free of `reader-core` imports.

**Affirmed this interview (practice, not new project hard-rule):**

- ALWAYS cover US-06 with automated UI/contract tests in `bun run check` (excerpt non-mount + primary CTA → `open-official-doc`).

## Forbidden

> Format: NEVER \[behavior\]

**Inherited:**

- NEVER add cloud/AWS service dependencies for this local-only tool.
- NEVER modify aidlc-workflows engine/stage definitions/audit format as part of this project.
- NEVER use `/api/guides` or `docs/guides/` for official aidlc-workflows guide+reference trees.
- NEVER invent a parallel Docs landing path alongside `open-official-doc` for Bridge CTA.
