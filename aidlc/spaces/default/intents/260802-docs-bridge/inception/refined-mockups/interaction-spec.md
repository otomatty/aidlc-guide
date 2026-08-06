# Interaction Spec — Docs i18n Bolt 4

> Intent: `260802-docs-bridge` · refined-mockups · 2026-08-03  
> 上流: [mockups.md](./mockups.md) · [user-flow.md](../../ideation/rough-mockups/user-flow.md) · [requirements.md](../requirements-analysis/requirements.md)

## IX-B4-1 — Activate Open in Docs

| Step | Actor | Action | System response |
|------|-------|--------|-----------------|
| 1 | User | Focus Open in Docs (Tab) or point | Focus ring on primary Button |
| 2 | User | Activate (click / Enter / Space) | Optional `activating` busy |
| 3 | Dashboard | postMessage `open-official-doc` | Host validates (Bolt 3) |
| 4 | Host | Inject Docs Shell deep-link | Shell opens/fronts |
| 5 | Shell | Apply locale/path/anchor one-shot | Focus per Bolt 3 land rules |

**Fail:** external browser; excerpt still mounted; message type ≠ `open-official-doc`.

## IX-B4-2 — Render ready-degraded

| Condition | UI |
|-----------|-----|
| StageDoc has non-null excerpt | Still **no** excerpt mount |
| Primary CTA present | Open in Docs (provisional name) |
| Guidance | Short non-article copy |
| Optional aids | May render; must not become article body |

## IX-B4-3 — Error path

| Condition | UI |
|-----------|-----|
| Host rejects open-official-doc | Existing error pattern; user remains in Bridge; can retry |

## Non-interactions

- No dismissible excerpt accordion
- No parallel IDE `open-doc` as primary official path
- No Shell layout redesign in this Bolt
