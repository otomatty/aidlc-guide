# Reliability Requirements — Unit: official-docs

> nfr-requirements / official-docs (library) / 2026-08-02  
> **Status: N/A for library kind** (`produces_kinds.reliability-requirements` = service only)

## Applicability

No HA / DR / multi-AZ targets. Failures are Result kinds (`not_found`, `path_rejected`, `empty_content`) per functional design.

## Stub rationale

Declared path for nfr-design consume chain; reliability = typed Result errors, not service SLOs.
