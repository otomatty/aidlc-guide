# Functional Design — Unit: diff-report (Bolt 5 / US-08)

> Stage: functional-design (pinned during Bolt 5 implementation) / 2026-08-06  
> Unit: `diff-report` · Priority: Should · Cuttable  
> Upstream: [requirements FR-U6](../../../inception/requirements-analysis/requirements.md) · [US-08](../../../inception/user-stories/stories.md) · [tech-stack](../nfr-requirements/tech-stack-decisions.md)

## Purpose

Produce a **Markdown** upstream-vs-snapshot report that documentation maintainers can paste into or attach to a translate PR (US-07 / FR-U5). Not a runtime extension feature; no network fetch inside the VSIX (NFR-1 / S-DR-2).

## Inputs

| Input | Layout |
|-------|--------|
| `--upstream <path>` | aidlc-workflows checkout with `docs/guide/**` + `docs/reference/**` (English source, **no** locale segment). Also accepts a path that is already the `docs/` directory. |
| Workspace snapshot | `docs/guide/en/**` + `docs/reference/en/**` + `docs/official-docs.manifest.json`; ja trees are consulted only for follow-up notes. |

## Algorithm

1. Walk upstream `guide` + `reference` and snapshot `*/en` trees (skip `.gitkeep` / dotfiles).
2. Key files by public **DocPath** (`guide/…`, `reference/…`).
3. Classify each path: `added` | `removed` | `modified` | `unchanged` via SHA-256 of file bytes.
4. For each path, record whether `docs/<section>/ja/<rel>` exists (translate signal).
5. Emit Markdown via `formatDiffReport`.

## Output format (pinned)

Markdown file / stdout with fixed sections:

1. Header metadata (`generatedAt`, workspace, upstream, snapshotManifest)
2. **Summary** table (counts)
3. **Added** / **Removed** / **Modified** lists (repo-relative DocPaths + ja note)
4. **Unchanged** count line (no per-file spam)
5. **Translate-PR checklist** (US-07 handoff)

Paths in the report are repository-relative DocPaths only (S-DR-3). No secrets / `.env` content (S-DR-1).

## CLI

```bash
bun scripts/official-docs-diff.ts --upstream <aidlc-workflows-checkout>
# optional: write file + stable timestamp for demos
bun scripts/official-docs-diff.ts --upstream <path> --out docs/reviews/official-docs-diff-demo.md --now 2026-08-06T04:00:00.000Z
```

Exit `0` on successful generation; exit `1` on usage errors (missing `--upstream`).

Optional flags: `--workspace <root>`, `--out <file>`, `--now <ISO-8601>`.

## Library

Core logic lives in `@aidlc-guide/official-docs` (`diff-report.ts`) so Vitest can cover classification without spawning the CLI for every case.

## Non-goals

- Auto-opening PRs / posting GitHub comments
- Runtime fetch from GitHub inside the extension
- Diffing `harness-engineering` or other trees outside guide+reference (Could / U7)
- Machine translation

## Demo

Committed sample: `docs/reviews/official-docs-diff-demo.md` generated against `packages/official-docs/tests/fixtures/upstream-docs`.

## Review

**Reviewer:** (Bolt 5 implementation) · **Verdict:** READY · **Date:** 2026-08-06
