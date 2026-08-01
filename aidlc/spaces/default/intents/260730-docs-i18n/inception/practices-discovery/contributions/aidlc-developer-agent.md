**Collaborator:** aidlc-developer-agent

## Contribution

DEVELOPER lens (naming, layer boundaries, error handling, file organization, code-style) against the lead draft only. Baseline Code Style (Biome, LF, camelCase/PascalCase, cross-platform paths, reader-core UI-independence, parser isolation, no-throw parse Result) is confirmed and should carry forward. Focus below is docs-i18n–specific structure that Construction will freeze on first Bolt.

### 1. Layer placement — fix “above api-core” wording (integrate)

`team-practices.md` Code Style says content loading is “a new domain layer **above** api-core.” That contradicts both the package DAG (`shared-types ← core-utils ← reader-core|docs-bridge ← api-core ← hosts`) and the Mandated rule that the loader lives in **api-core or a new domain sibling**, not dashboard.

Correct placement options (either is fine; pick one at gate):

- **A (lazy default):** keep catalogue I/O in `api-core` handlers beside existing `listGuides` / `readGuide` (same pattern as today for `docs/guides/`).
- **B:** extract a small domain sibling (e.g. `docs-content` / extend `docs-bridge`) that owns locale resolve + guarded reads; **api-core consumes it**.

Never: dashboard, vscode-extension host ad-hoc FS, or **reader-core**. Official markdown catalogues are not intent-record parse — putting them in reader-core pollutes State-Version isolation and the 95% parse coverage floor.

Proposed Code Style line: “Official `docs/guide` + `docs/reference` loading lives in api-core or a domain sibling **below** api-core. Dashboard stays wire-only. reader-core stays intent-record-only.”

### 2. reader-core purity + dashboard firewall (affirm as-is, tighten NEVER)

Agree with Mandated/Forbidden on no `dashboard → reader-core` and no new `reader-core → dashboard` edge. Add explicit docs-i18n NEVER for the domain mix-up:

- NEVER implement locale/content-tree loading inside `reader-core` — wrong domain; keeps parse/ isolation honest.
- ALWAYS keep structural tests + Biome `noRestrictedImports` green after new packages/routes land.

### 3. guardPath — single enforcement, locale-scoped root (strengthen Mandated)

Agree: all new docs content reads MUST go through `core-utils` `guardPath` (project.md nfr-design:c3; architecture single enforcement point). Clarify the **containment root**:

- Call `guardPath(contentRoot, relPath)` where `contentRoot` is the resolved locale tree root (workspace `docs/guide/<locale>` / `docs/reference/<locale>`, or the VSIX-bundled equivalent), **not** bare workspace root with a free-form relative that can walk into `docs/guides/` or `packages/`.
- Same pattern as `docs-bridge` excerpt (`guardPath(docsRoot, docPath)`) and defence-in-depth in `api-core` artifact reads.
- Host `open-doc` / path normalize for IDE deep links must use `path.join` / `vscode.Uri` + the same containment story — no hardcoded separators (team.md cross-platform rule).

### 4. Error handling at the content boundary (missing from draft)

Lead says the three structure rules are “not affected.” Parse Result shape stays reader-core-specific, but **fallible docs I/O must still be Result-shaped**:

- Wrap catalogue reads with `withResult` (as `docs-bridge` / `listGuides` already do).
- Map missing locale, missing page, and containment failure to discriminable `{ error, reason }` (or existing `ReadResult`) — **never throw across api-core → host**.
- Dashboard continues `getResult` / three-representation for locale toggle; no silent empty catalogue on hard failure.

Proposed Mandated: “ALWAYS return discriminable ReadResult from official-docs catalogue reads (`withResult` + `guardPath`); never throw across the api-core/host boundary.”

### 5. Naming — `docs/guide` vs `docs/guides`, API, modules

Agree Forbidden: never reuse `/api/guides` or place official trees under `docs/guides/`. That collision is high-severity debt (code-quality D2; project.md reverse-engineering:c2).

Recommendations for open questions (developer preference — human still decides):

| ID | Recommendation | Rationale |
|----|----------------|-----------|
| **Q-Style-1** | Short codes `en` / `ja` | Matches path segments and UI state; avoid `en-US` unless upstream snapshot forces it. |
| **Q-Style-2** | `docs/guide/<locale>/…` and `docs/reference/<locale>/…` | Keeps singular `guide` ≠ plural `guides`; locale as first segment mirrors API; avoid `docs/guide.ja/` (tooling-hostile). |
| **Q-Style-3** | Prefer `/api/guide/:locale/…` + `/api/reference/:locale/…`, or `/api/official-docs/:locale/…` — **not** bare `/api/docs/:locale/…` | Existing exact route `/api/docs-settings` makes a `/api/docs…` family easy to mis-match in routers and mental model; singular `guide`/`reference` parallel the filesystem roots. |

Module naming (affirm from code-structure): new non-component TS files `kebab-case.ts`; React locale UI `PascalCase.tsx`; hooks `use*.ts`. Locale path keys stay lowercase short codes in shared-types wire contracts.

### 6. File organization / Biome scope

Agree: Biome ignoring `docs/` is correct for upstream markdown; loader/route **source** stays under `packages/*` and remains Biome-scoped. Do not “fix” upstream markdown with Biome. Content integrity (front matter, links) is out of scope unless later affirmed — do not invent a second formatter.

Golden tests: small synthetic en/ja fixture trees under `packages/*/tests/fixtures/` (lead Testing Posture) — do not point Vitest at the full upstream snapshot.

### 7. What not to change

No objection to Way of Working, Deployment local-only framing, or “no i18n message catalog library” Forbidden. VSIX size / coverage floors are quality/deploy concerns; developer only notes that size checks belong in `bun run check` if affirmed (already in draft).

## Positions

- AGREE: Forbidden never `/api/guides` / never `docs/guides/` for official content — hard naming boundary; matches RE D2 and project.md reverse-engineering:c2.
- AGREE: Mandated `guardPath` for all new docs content reads + dual-transport exposure via api-core — preserves single containment enforcement and multi-host model.
- AGREE: Dashboard must not import reader-core; no i18n message-catalog library for doc body locale — content-tree switching only.
- AGREE: Q-Style-1/2/3 correctly flagged as human decisions before Construction; locale codes + tree layout + route prefix must be locked together.
- OBJECT: Code Style phrasing “domain layer above api-core” — wrong DAG direction; rewrite to api-core or domain sibling **below** api-core; never reader-core / dashboard.
- OBJECT: “Three structure rules not affected” undersells error handling — content catalogue reads need `withResult` + discriminable ReadResult / no-throw across api-core→host (same family as guides/docs-bridge), even if parse-union shape stays reader-core-only.
- OBJECT: Q-Style-3 option `/api/docs/:locale/:path` risks confusion with existing `/api/docs-settings` — prefer `/api/guide|/api/reference` or `/api/official-docs` in the interview choices.
- OBJECT: Mandated guardPath should name the **locale content root** as containment base — workspace-root-relative reads that can escape into `docs/guides/` are insufficient.
