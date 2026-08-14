---
slug: domain-design
phase: inception
---

# Domain Design

Identify and detail the logical building blocks of the system — the components you will write code for. A component is a bounded piece of software with its own business logic, entities, and lifecycle: code you write, not infrastructure you deploy.

This stage does not decide deployment topology. Domain Design produces the building blocks so the team can then decide how to group them into deployable units. Formal contracts belong to Contract Design.

## Outputs

- `components.md` — fenced YAML component catalogue plus a human-readable mermaid diagram and summary tables
- `decisions.md` — Architecture Decision Records
- `traceability.json` — story / FR coverage onto components and entities
