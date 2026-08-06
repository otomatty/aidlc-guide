# Architecture Decisions — Docs i18n Bolt 4

> ステージ: application-design / 2026-08-03  
> 上流: [application-design-questions.md](./application-design-questions.md) · [requirements.md](../requirements-analysis/requirements.md) · [architecture.md](../../../codekb/aidlc-guide/architecture.md)  
> Q5 = D — 短文 ADR を本ファイルに記録（正式単独 ADR ファイルは任意）

---

# ADR-B4-001: Reuse open-official-doc for Bridge CTA

## Status
Proposed (pending gate; Q2=A)

## Date
2026-08-03

## Context
Bridge needs a primary path to canonical Docs Shell. Bolt 3 already ships `open-official-doc` + Shell land. Inventing a parallel message type or HTTP land would fork the contract.

### Options

**A — Reuse `open-official-doc`**  
- Pros: One host seam; existing tests; FR-B4-2.2  
- Cons: Bridge must share StageCard emit patterns  

**B — New message type**  
- Pros: Isolation  
- Cons: Dual maintenance; violates “no parallel landing”  

**Recommendation:** A

## Decision
Bridge / StageCard Open in Docs primary CTA emits existing `open-official-doc` only.

## Consequences
- dashboard reuses OpenOfficialDocLink (or equivalent)
- vscode-extension handler changes minimized
- FD pins final accessible name only

---

# ADR-B4-002: UI-only excerpt non-mount

## Status
Proposed (pending gate; Q3=A)

## Date
2026-08-03

## Context
`/api/stage` / docs-bridge may still return `excerpt`. Dual-canonical risk is in the **product UI**, not necessarily in deleting the field.

### Options

**A — UI non-mount only (Must)**  
- Pros: Smallest diff; FR-B4-1.2; API consumers elsewhere unaffected  
- Cons: Wire still carries unused excerpt  

**B — Delete excerpt from API as Must**  
- Pros: Cleaner wire  
- Cons: Scope creep; breaks other consumers without audit  

**Recommendation:** A

## Decision
Must is UI non-mount. API excerpt removal is out of Bolt 4 Must.

## Consequences
- Tests assert absence of `docs-excerpt` (or equivalent) in UI
- Future cleanup of wire field is a separate change

---

# AWS / Platform

**N/A** (Q4=A). No Well-Architected / CDK artifacts for this intent.
