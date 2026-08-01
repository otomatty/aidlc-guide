# Architecture Decisions — Docs i18n

> ステージ: application-design / 2026-07-31  
> 上流: requirements.md · stories.md · architecture.md · component-inventory.md · team-practices.md · application-design-questions.md  
> ゲート承認で Status → Accepted（下記 Recommendation = 推奨記入済み）

---

# ADR-001: Official docs domain package

## Status
Accepted (gate Approve 2026-07-31; Q1=A)

## Date
2026-07-31

## Context
Need locale-scoped FS load + `guardPath` + 95% branch coverage (NFR-2/3) without conflating intent parsing (`reader-core`) or product guides (`/api/guides`). Brownfield inventory lists official trees as missing.

### Options

**Option A — `@aidlc-guide/official-docs` thin package**  
- Pros: Clear boundary; mirrors docs-bridge/reader-core; testable in isolation; dashboard cannot import it  
- Cons: One more workspace package  
- Reversibility: Easy to merge later if too thin  

**Option B — Fold into reader-core**  
- Pros: Fewer packages  
- Cons: Mixes intent records with official markdown; coverage/noise; wrong domain language  
- Reversibility: Harder to split after coupling  

**Option C — Logic only in api-core handlers**  
- Pros: Fastest first PR  
- Cons: Harder NFR-3 isolation; handlers bloat; reuse from scripts awkward  
- Reversibility: Medium  

**Recommendation:** A — aligns with modular monolith layering in architecture.md and practices API/tree names.

## Decision
Create `@aidlc-guide/official-docs`; api-core wires `/api/official-docs/:locale/*`.

## Consequences
- Units will include a new package Bolt  
- Structural import ban: dashboard ↛ official-docs  

## Alternatives Rejected
B, C — domain mixing / weak test seam

---

# ADR-002: Extension-first host cut

## Status
Accepted (gate Approve 2026-07-31; Q2=A)

## Date
2026-07-31

## Context
Requirements: VS Code/Cursor extension only for display. dashboard-server exists but browser path is out of scope.

### Options

**Option A — Extension Must; server optional later**  
- Pros: Matches S-docs-1 / constraints; thinner MVP  
- Cons: Mob LAN server users wait  
- Reversibility: Easy — same api-core routes  

**Option B — Extension + dashboard-server same Must**  
- Pros: Parity  
- Cons: Extra host QA; out of stated surface  
- Reversibility: N/A if forced  

**Recommendation:** A

## Decision
Must path = vscode-extension + dashboard webview. dashboard-server may inherit routes later without blocking Done.

## Consequences
- Deep link + Docs Shell tested in extension host first  

## Alternatives Rejected
B, C (MCP Must) — scope creep

---

# ADR-003: Stage→docs map in official-docs (not rewrite bridge-map as canonical)

## Status
Accepted (gate Approve 2026-07-31; Q3=A)

## Date
2026-07-31

## Context
FR-U3.3 needs seven stage slugs → official paths. docs-bridge maps historically point at `.claude` / excerpts (inventory gap).

### Options

**Option A — Static map beside official-docs**  
- Pros: Official paths owned with content module; bridge-map stays glossary/nav (US-09)  
- Cons: Two maps briefly coexist  
- Reversibility: Easy  

**Option B — Rewrite bridge-map to official paths**  
- Pros: Single map file  
- Cons: Couples degrade work to map migration; risk to existing excerpt consumers mid-transition  
- Reversibility: Messy  

**Recommendation:** A

## Decision
`mapStageToDoc` lives with official-docs (or pure data it owns). docs-bridge not canonical body.

## Alternatives Rejected
B, C (dashboard-only map — host would trust UI)

---

# ADR-004: Locale preference in extension state

## Status
Accepted (gate Approve 2026-07-31; Q4=A)

## Date
2026-07-31

## Context
US-05 locale = preference || `en`. Must not write locale into git.

## Decision
Store last locale in VS Code `workspaceState` (or equivalent webview persistence). Default `en`.

## Consequences
- No repo config file for locale  
- Preference available to openOfficialDoc payload  

## Alternatives Rejected
Workspace file (B); no persistence (C) — worse UX for drivers

---

# ADR-005: Sync request/response only

## Status
Accepted (gate Approve 2026-07-31; Q6=A)

## Date
2026-07-31

## Context
Existing architecture is sync ReadResult over postMessage/HTTP.

## Decision
No event bus for locale/docs. All flows sync.

## Consequences
- Simpler Units; matches services.md  

## Alternatives Rejected
Pub/sub (B), separate docs process (C)

---

# ADR-006: Bridge UI degrade in dashboard (keep package)

## Status
Accepted (gate Approve 2026-07-31; Q5=A)

## Date
2026-07-31

## Context
US-06 / FR-U4 — excerpt not primary; Open in Docs primary. Deleting docs-bridge wholesale risks glossary/Should aids.

## Decision
Change dashboard Bridge surface; keep docs-bridge for optional nav/glossary. Do not delete package in MVP.

## Alternatives Rejected
Delete docs-bridge (B); keep excerpt as body (C)

---

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-07-31

---

### Layering and dependency direction

The `official-docs` package is placed at the same layer as `reader-core` and `docs-bridge` — immediately above `core-utils` / `shared-types`, below `api-core`. This is the established modular-monolith slot for domain libraries. The dependency graph is fully acyclic:

```
shared-types ← core-utils ← official-docs ← api-core ← vscode-extension
                    ↑              ↑              ↑
                docs-bridge ──────┘         dashboard (wire only)
                reader-core ───────────────┘
```

Every edge was traced against the dependency matrix in `component-dependency.md` and the existing layering diagram in `architecture.md`. No circular dependency was found. The forbidden edge `dashboard → official-docs` is stated explicitly and mirrors the existing `dashboard → reader-core` structural ban (Biome restricted imports).

---

### ADR completeness

| ADR | Decision | Options evaluated | Consequences stated | Finding |
|-----|----------|-------------------|---------------------|---------|
| 001 | New `official-docs` domain package | A/B/C | Yes | ✓ |
| 002 | Extension-first host cut | A/B | Yes | ✓ |
| 003 | `mapStageToDoc` lives in `official-docs` | A/B/C | Yes | ✓ |
| 004 | Locale preference in `workspaceState` | A/B/C | Yes | ✓ |
| 005 | Sync request/response only | A/B/C | Yes | ✓ |
| 006 | Bridge UI degrade in dashboard; keep package | A/B/C | Implicit | ✓ |

All six ADRs cover the material architectural choices. Reversibility is stated where risk exists. No cross-cutting concern (security, consistency model, package hygiene, comms pattern) is left un-decided.

---

### Collision with `/api/guides` and `/api/docs-settings`

The new route `/api/official-docs/:locale/*` is distinct from the existing `/api/guides` and `/api/docs-settings` at every layer where the claim is made: `components.md`, `component-methods.md` (`handleOfficialDocsGet`), FR-U2.6, and US-02 GWT. The FS roots are equally partitioned: `docs/guide/<locale>/` and `docs/reference/<locale>/` are separate from the existing product `docs/guides/`. No naming collision risk found.

One observation: `components.md` lists `GET /api/official-docs/manifest (or embed version in page responses)` without committing. `ResolvedPage` already includes `sourceVersion`, so either path (separate endpoint or embedded field) satisfies FR-U2.4. This is an implementation choice for Functional Design; it does not create ambiguity at the architectural boundary.

---

### NFR-2 seam (guardPath containment)

`guardPath` remains the single enforcement point in `core-utils`. `official-docs.resolvePage` is the sole entry to locale content; all FS reads pass through it. The design mandates a negative test (escape-path rejection) under `bun run check`. The call chain is unambiguous: `api-core → official-docs.resolvePage → core-utils.guardPath → FS`. No bypass path exists because `dashboard → official-docs` is forbidden and `dashboard` is wire-only. The seam is structurally sound.

Detail deferred to Functional Design (acceptable): the exact content root prefix (`workspaceRoot/docs/guide/<locale>/` vs `workspaceRoot/docs/<type>/<locale>/`) needs to be pinned so the containment check has a concrete anchor. This is an FD-level specification, not an architectural gap.

---

### NFR-3 seam (95% branch coverage)

The locale resolver / content-load logic is entirely inside `@aidlc-guide/official-docs`. This package has no UI dependencies, no extension host coupling, and no circular imports — it is directly Vitest-runnable in isolation. The coverage target is measurable at the package boundary. This mirrors the `reader-core` pattern, which already achieves strong coverage under the same gate (`bun run check`).

---

### Brownfield fit

| Concern | Verdict |
|---------|---------|
| New package structure | Mirrors `reader-core` / `docs-bridge` exactly; no new patterns |
| Markdown rendering | `MarkdownSurface` + `lazy-markdown` already present |
| `workspaceState` preference | Existing VS Code API; already used in extension |
| `guardPath` reuse | Existing function in `core-utils`; unchanged ownership |
| `docs-bridge` narrowing | ADR-006 keeps package; only dashboard Bridge surface changes |
| `api-core` extension | Additive handler; no existing route touched |
| `shared-types` extension | Additive DTOs; no breaking change |

No brownfield integration debt was found. The design slots into the existing architecture without requiring structural rewrites.

---

### End-to-end trace (sanity)

Request: user activates StageCard docs link for `intent-capture`.

```
dashboard.StageCard.activateOfficialDocLink("intent-capture")
  → (postMessage) vscode-extension.openOfficialDoc({locale: "en", path: "<mapped>", anchor?})
    → api-core.handleOfficialDocsGet(ctx, /api/official-docs/en/<mapped>)
      → official-docs.resolvePage({workspaceRoot, locale:"en", path:"<mapped>"})
        → core-utils.guardPath (containment check)
        → FS: docs/guide/en/<mapped>.md
      ← ResolvedPage{bodyMarkdown, sourceVersion, …}
    ← Response
  ← dashboard Docs Shell renders body; locale control shows "en"
```

All components exist or are being created. All hand-offs have typed contracts. No invisible step.

---

### Non-blocking observations (not grounds for NOT-READY)

1. **`/api/official-docs/manifest` endpoint ambiguity** — `ResolvedPage.sourceVersion` already satisfies FR-U2.4; a separate manifest endpoint is optional. Functional Design should commit to one form.
2. **`mapStageToDoc` data file location** — ADR-003 says "with `official-docs` (or pure data it owns)"; the parenthetical is harmless; FD pins the file path.
3. **NFR-5 VSIX size** — Explicitly TBD, deferred to NFR stage. Appropriate given no cloud deploy risk.
4. **`openOfficialDoc` command name string** — Payload contract `{locale, path, anchor?}` is fixed; name deferral to FD does not block implementation start.
5. **US-05 anchor-present-but-not-found** — Already flagged by product-lead reviewer; US-03 provides the precedent rule (→ page top); Units can carry forward without a blocking question.

---

### Verdict rationale

A developer can trace every request end-to-end from these artifacts. The layer placement, dependency direction, API route, FS layout, guardPath enforcement, error model, and six key ADRs are all unambiguous. No blocking architectural questions remain for Units Generation. The design is a conservative extension of the existing modular monolith — additive, reversible, and internally consistent.
