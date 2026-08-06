# Business Logic Model — Unit: docs-navigation (Bolt 4)

> functional-design / docs-navigation (ui) / 2026-08-04  
> Intent: `260802-docs-bridge`  
> 上流: [unit-of-work.md](../../../inception/units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [components.md](../../../inception/application-design/components.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [services.md](../../../inception/application-design/services.md)  
> 親: `260802-docs-deeplink` FD — open-official-doc / Shell land **再仕様化しない**  
> Q1–Q6 = 1

## Prior ownership (do not re-spec)

| Behavior | Owner |
|----------|-------|
| `open-official-doc` message + mapped/unmapped discriminant | **Bolt 3** (`docs-deeplink` FD) |
| Host `handleOpenOfficialDoc` / Shell one-shot land | **Bolt 3** — **reuse** |
| STAGE_DOC_MAP / Docs Shell content | **Bolt 1–3** |
| excerpt API field on wire | **docs-bridge / api-core** — may remain (ADR-B4-002) |

This unit owns **UI degrade**: excerpt non-mount + Open in Docs primary CTA → existing host contract.

## Pinned CTA strings（Q1=1 / FR-B4-2.4）

| Surface | Visible label | `aria-label` |
|---------|---------------|--------------|
| Primary CTA (StageCard / Legacy Bridge docs UI) | `Open in Docs` | `Open in Docs` |

- Stage name is **not** part of the accessible name for Bolt 4 primary CTA.  
- Bolt 3 `Docs: <Stage Name>` may be replaced on the extension IDE path when this CTA becomes primary (same component / props).  
- testid remains `open-official-doc`（contract continuity）.

## Message contract (inherited — reuse)

| Direction | Shape |
|-----------|--------|
| Webview → host | `{ type: "open-official-doc", …payload }` |
| Mapped | `{ locale: "en"\|"ja", path: string /* len≥1 */, anchor?: string }` |
| Unmapped | `{ locale: "en"\|"ja" }` — omit `path` / `anchor` keys |

No new message type（ADR-B4-001）.

## Flows

### F4-1 — Excerpt non-mount（US-B4-01 / FR-B4-1）

```text
StageCard / Legacy Bridge docs UI renders for a stage
  → API may return doc.excerpt non-null
  → UI MUST NOT mount excerpt as article / Accordion
  → data-testid="docs-excerpt" (or equivalent) ABSENT from DOM
  → assistive tech must not expose excerpt as primary document body on this surface
```

Implementation: **UI-only omit** (Q2=1) — remove/skip Accordion branch in StageCard (and any Bridge equivalent). Do not require API/docs-bridge deletion.

### F4-2 — Primary Open in Docs activate（US-B4-02 / FR-B4-2）

```text
User activates primary CTA (pointer or Tab → Enter/Space)
  → control is Button variant=default (solid) — Q3=1
  → visible + aria-label = "Open in Docs" — Q1=1
  → reuse OpenOfficialDocLink (or thin wrapper) — Q4=1
  → GET /api/official-docs/stage/:slug (existing)
  → buildOpenOfficialDocMessage(locale, value) — Bolt 3
  → postMessage type "open-official-doc"
  → MUST NOT openExternal / window.open / target=_blank
  → MUST NOT remote-fetch official docs URLs (NFR-B4-1)
host (reuse Bolt 3):
  → validate → open/front Docs Shell → inject deep-link (one-shot)
```

### F4-3 — Demo-first verify slice（US-B4-03 / Q6=1）

```text
1) Fixture / Testing Library: assert docs-excerpt absent + CTA emit open-official-doc
2) Then complete production StageCard / Bridge path
3) Manual Demo: Legacy Bridge → Open in Docs → Docs Shell (no external browser)
4) bun run check includes non-mount + CTA contract tests (NFR-B4-2)
```

### F4-4 — Optional aids（US-B4-S1 / Q5=1）

```text
Glossary / secondary aids MAY remain
  → MUST NOT reintroduce excerpt-as-article
  → absence does NOT fail Must DoD
```

## Invariants

- Never mount `doc.excerpt` as article on Extension Webview StageCard / Bridge (FR-B4-1)  
- Never invent a parallel host message type (ADR-B4-001)  
- Never call legacy `docsOpenHref` / `open-doc` on the IDE primary CTA path (Bolt 3 inherit)  
- Never import `@aidlc-guide/official-docs` from dashboard  
- No remote HTTP of official docs URLs（NFR-B4-1）  
- Accept surface = Extension Webview only（NFR-B4-3）

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY

### Checklist

| Check | Result |
|-------|--------|
| CTA strings pinned (`Open in Docs`) | ✓ Q1=1 / Pinned CTA strings |
| Excerpt UI-only omit; API may keep field | ✓ F4-1 / Q2=1 / ADR-B4-002 |
| Primary solid Button + reuse OpenOfficialDocLink | ✓ F4-2 / Q3–Q4=1 |
| open-official-doc reuse; no new type | ✓ Message contract + ADR-B4-001 |
| Demo-first + check coverage | ✓ F4-3 / Q6=1 |
| US-B4-S1 optional non-failing | ✓ F4-4 / Q5=1 |
| `ui` produces BLM + frontend-components only | ✓ |
| FR-B4-1…3 / NFR-B4-1…3 / US-B4-01…03 traced | ✓ |
| Upstream sensors (required-sections, upstream-coverage) | ✓ PASS |

### Findings

- **Advisory:** `unit-of-work.md` Kind=`code` vs FD tag `(ui)` — align before codegen; no missing-artifact gap for this UI delta.
- **Advisory:** Non-mount verification uses testid proxy; SR clause (FR-B4-1.1) relies on omitting excerpt branch, not test alone.

Prior Bolt 3 host/Shell contract intentionally not re-specified; inheritance boundary is explicit and sufficient.
