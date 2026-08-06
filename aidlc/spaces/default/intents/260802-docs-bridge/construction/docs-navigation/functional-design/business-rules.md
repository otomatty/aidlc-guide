# Business Rules — Unit: docs-navigation (Bolt 4)

> **N/A produce for ui kind** (`produces_kinds.business-rules` excludes ui).  
> Display / host rules live in [business-logic-model.md](./business-logic-model.md) and [frontend-components.md](./frontend-components.md).  
> Stub for nfr-requirements consume chain（deeplink pattern）.

## Bolt 4 rules (see BLM)

| Rule | Statement |
|------|-----------|
| BR-B4-1 | Never mount `doc.excerpt` as article on Extension StageCard / Bridge |
| BR-B4-2 | Primary CTA strings = `Open in Docs` (visible + aria-label) |
| BR-B4-3 | Emit only `open-official-doc`; no parallel land type |
| BR-B4-4 | US-B4-S1 absence does not fail Must DoD |

## Inherited (not re-specified)

| Rule area | Owner |
|-----------|-------|
| Mapped/unmapped payload discriminant | Bolt 3 |
| Host validate / Shell one-shot | Bolt 3 |
