---
slug: contract-design
phase: inception
---

# Contract Design

Define the formal contracts the system must honour so teams can build in parallel. A contract is a formal agreement across a boundary: what data crosses it, in what shape, via what protocol, and what happens when things go wrong.

Two kinds of boundary qualify: inter-unit boundaries inside the system, and public or external API boundaries consumed outside the system. Skip only for a single self-contained unit with neither.

## Outputs

- `contract-summary.md` — one row per boundary plus a fenced OpenAPI / AsyncAPI / shared-schema block
