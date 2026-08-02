# NFR Design Questions — Unit: docs-shell (Bolt 2)

> nfr-design / docs-shell (ui) / 2026-08-02  
> Mode: Full · Answers: **recommended** (user 「続けてください」)

## Q1. Notice render performance

How should UntranslatedNotice avoid layout thrash on locale switch?

| Option | Description | Trade-off |
|--------|-------------|-----------|
| **A (Recommended)** | Conditional mount only when `notice==="missing_ja"`; no animation deps; reuse existing typography tokens | Minimal |
| B | Always-mounted hidden node toggled via CSS | Extra DOM always |
| C | Framer/transition library | Bundle risk vs P-B2-DS-1 |

**Answer:** A

## Q2. Boundary enforcement in UI

How is S-B2-DS-1 (no official-docs import) enforced at design level?

| Option | Description | Trade-off |
|--------|-------------|-----------|
| **A (Recommended)** | Document forbidden imports in logical-components + rely on package boundary / Biome; UI consumes wire types only via api-core facade | Matches ADR-B2-002 |
| B | Runtime proxy that strips types | Over-engineering |
| C | Duplicate resolve types in dashboard | Drift risk |

**Answer:** A

## Q3. Status live region

How is `role="status"` designed for screen readers?

| Option | Description | Trade-off |
|--------|-------------|-----------|
| **A (Recommended)** | Single live region on UntranslatedNotice; announce on mount when notice present; no polite spam on every keystroke | FR-B2-2.3 |
| B | aria-live on whole DocsShell | Noise |
| C | Alert role | Wrong severity |

**Answer:** A

## Q4. Performance budget ownership

| Option | Description | Trade-off |
|--------|-------------|-----------|
| **A (Recommended)** | No new ms budget; inherit parent NFR-2; design = lazy markdown path only | P-B2-DS-2 |
| B | Add LCP budget for DocsShell | Scope creep |
| C | Service-worker cache for docs | Out of local-only Bolt 2 |

**Answer:** A

## Q5. Scalability / reliability design artifacts

| Option | Description | Trade-off |
|--------|-------------|-----------|
| **A (Recommended)** | Omit scalability-design / reliability-design (ui `produces_kinds`); N/A stubs only on requirements side | Matches official-docs pattern |
| B | Write full service SLO designs | Wrong kind |

**Answer:** A

## Q6. Completeness

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Looks correct and generate |
| B | Need more questions |

**Answer:** A — Looks correct and generate
