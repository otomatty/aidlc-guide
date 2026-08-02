# Architecture Decisions — Docs i18n Bolt 2

> ステージ: application-design / 2026-08-01  
> 上流: [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [architecture.md](../../../codekb/aidlc-guide/architecture.md) · [component-inventory.md](../../../codekb/aidlc-guide/component-inventory.md) · [application-design-questions.md](./application-design-questions.md)  
> 親 ADR（`260730-docs-i18n` ADR-001..）は継承。本ファイルは Q6=D の **Bolt 2 差分 ADR**。

---

# ADR-B2-001: Wire-first OfficialDocsPage contract

## Status
Proposed (pending gate; Q3=A, Q6⊃A)

## Date
2026-08-01

## Context
FR-B2-4 requires a single source of truth for missing translation and anchor outcome. Inventing parallel UI flags or renaming `notice` would break Bolt 1 tests and dual-read ambiguity.

### Options

**Option A — Wire-first (`OfficialDocsPage` only)**  
- Pros: One contract; UI trivial; matches shared-types already shipped  
- Cons: Copy for notice stays UI-local (A3)  
- Reversibility: Easy to add optional fields later  

**Option B — UI heuristics (404 / empty body)**  
- Pros: Faster UI prototype  
- Cons: False positives; diverges from api-core; FR-B2-4.2 violation  
- Reversibility: Painful once tests encode heuristics  

**Recommendation:** A

## Decision
UI and tests treat `notice === "missing_ja"` and `anchorApplied` as the only signals. No destructive rename in Bolt 2.

## Consequences
- Construction must not introduce `untranslated` aliases  
- api-core stays pass-through  

## Alternatives Rejected
B — double judgment and FR violation

---

# ADR-B2-002: Resolve owns keep-path / missing_ja / anchor

## Status
Proposed (pending gate; Q1=A, Q2=A, Q6⊃B)

## Date
2026-08-01

## Context
Keep-path and missing-ja must stay consistent across hosts. Putting path retention only in dashboard risks server/UI drift.

### Options

**Option A — official-docs.resolve owns path + notice + anchorApplied**  
- Pros: Single seam for NFR-B2-1 coverage; dashboard display-only  
- Cons: Resolve complexity concentrated in one module  
- Reversibility: Medium  

**Option B — Dual ownership (UI + resolve)**  
- Pros: UI resilient to odd failures  
- Cons: Two sources of truth; hard-to-test races  
- Reversibility: Hard  

**Recommendation:** A — aligns with requirements package touch-order and parent layering.

## Decision
`resolvePage` always returns the requested `path`; sets `notice` / `anchorApplied`; dashboard renders those fields only.

## Consequences
- Units: official-docs first, then api-core/dashboard polish  
- Coverage floor targets resolve/roots/markdown  

## Alternatives Rejected
B — dual path logic

---

# ADR-B2-003: Extension Docs Shell is the only Must surface

## Status
Proposed (pending gate; Q4=A, Q6⊃C; NFR-B2-3)

## Date
2026-08-01

## Context
Parent ADR-002 already chose extension-first. Bolt 2 acceptance must not expand Fail conditions to browser/Mob LAN.

### Options

**Option A — Extension Docs Shell only for Must Fail**  
- Pros: Matches NFR-B2-3 / US surface; thinner QA  
- Cons: Server path may lag  
- Reversibility: Easy — same api-core  

**Option B — Extension + dashboard-server Must parity**  
- Pros: Host parity  
- Cons: Out of Bolt 2 scope (Q4≠C)  
- Reversibility: N/A if forced  

**Recommendation:** A

## Decision
Bolt 2 Must Fail conditions apply only on VS Code / Cursor extension Docs Shell. dashboard-server may share routes but is not a Fail surface.

## Consequences
- Manual scenarios (FR-B2-5.2) recorded against extension  
- No new service process  

## Alternatives Rejected
B — scope creep vs NFR-B2-3

---

## Review

**Verdict:** READY — see full review in [components.md § Review](./components.md#review).

All three ADRs (Wire-first, Resolve-owns-path, Extension-surface-only) are well-formed. Prior F1/F2 blockers originated in component-methods.md and are resolved. ADR-B2-001's key invariant (404 ≠ missing_ja) is now codified in the error table, reinforcing this ADR at the implementation seam.
