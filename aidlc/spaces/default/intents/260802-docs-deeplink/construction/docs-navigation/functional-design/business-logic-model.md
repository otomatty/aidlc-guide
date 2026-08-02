# Business Logic Model — Unit: docs-navigation (Bolt 3)

> functional-design / docs-navigation (ui) / 2026-08-02  
> 上流: [unit-of-work.md](../../../inception/units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [components.md](../../../inception/application-design/components.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [services.md](../../../inception/application-design/services.md)  
> Q1–Q6 = A

## Prior ownership (do not re-spec)

| Behavior | Owner |
|----------|-------|
| STAGE_DOC_MAP / mapStageToDoc | **official-docs** |
| `GET /api/official-docs/stage/:slug` | **api-core**（既存） |
| Docs Shell page render / AnchorApplier / locale content load | **Bolt 1–2**（reuse） |

This unit owns **StageCard emit → host openOfficialDoc → Shell deep-link with locale**.

## Message contract (Q1=A)

| Direction | Shape |
|-----------|--------|
| Webview → host | `{ type: "open-official-doc", …payload }` |
| Mapped payload | `{ locale: "en"\|"ja", path: string /* len≥1 */, anchor?: string }` |
| Unmapped payload | `{ locale: "en"\|"ja" }` — **omit** `path` / `anchor` keys |

Distinct from legacy `{ type: "open-doc", path, anchor? }`.

## Flows

### F1 — Mapped StageCard activate（US-B3-01/02/05）

```text
User activates OpenOfficialDocLink (pointer or Tab+Enter/Space)
  → GET /api/official-docs/stage/:slug
  → value non-null → payload { locale, path, anchor? }
       locale = getLastOfficialDocsLocale() || "en"
  → postMessage type "open-official-doc"
  → MUST NOT call docsOpenHref / open-doc / openExternal
host:
  → validate payload (locale ∈ {en,ja}; path non-empty)
  → persist locale to globalState
  → open/front Docs Shell
  → inject docsShellDeepLink { locale, path, anchor? }
Shell:
  → apply locale + path + anchor (AnchorApplier)
  → clear deep-link (one-shot)
  → focus: scrolled→heading; top→h1/main
```

### F2 — Unmapped StageCard activate（US-B3-03）

```text
GET stage/:slug → value null
  → payload { locale } only（omit path/anchor keys）
host:
  → validate locale ∈ {en,ja}
  → persist locale to globalState
  → open/front Docs Shell
  → inject docsShellDeepLink { locale }（no path/anchor）
Shell:
  → top (no page selected); locale applied; clear deep-link (one-shot); focus h1/main
```

### F3 — Malformed message（Q6=A）

```text
host receives invalid locale or mapped without path
  → ignore (no persist, no Shell open)
```

## Invariants

- Never import `@aidlc-guide/official-docs` from dashboard  
- Never use bridge `doc.deepLink` as official map  
- Never treat `path: ""` as unmapped success  
- No remote HTTP/`fetch` of official docs URLs（NFR-B3-1）  
- No external browser on success paths

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02 (§12a adversarial sweep)  
**Verdict:** READY

### Checklist

| Check | Result |
|-------|--------|
| Message type pinned (`open-official-doc`) | ✓ § "Message contract": `type: "open-official-doc"` — resolves FR-B3-1.4 Open Question |
| Mapped discriminant: non-empty `path` key | ✓ `{ locale, path: string /* len≥1 */, anchor? }` |
| Unmapped discriminant: omit keys, no `path: ""` | ✓ `{ locale }` — omit keys; Invariant: "Never treat `path: ""` as unmapped success" |
| Host persist locale to `globalState` | ✓ F1 host step: "persist locale to globalState"; F2 inherits via "same host open path" |
| Shell locale + deep-link, one-shot clear | ✓ F1 Shell: "apply locale + path + anchor (AnchorApplier); clear deep-link (one-shot)" |
| No dashboard → `@aidlc-guide/official-docs` import | ✓ Invariants line 1; mirrored in frontend-components.md § Forbidden |
| Legacy `open-doc` / `docsOpenHref` not on mapped path | ✓ F1: "MUST NOT call docsOpenHref / open-doc / openExternal"; Invariants + FC Forbidden |
| `ui` produces BLM + frontend-components only | ✓ Two artifacts produced; no business-rules / domain-entities generated |
| FR-B3-1.1–1.4 / FR-B3-2.1 / FR-B3-3.3 / FR-B3-4.1–4.4 / FR-B3-5.1 / NFR-B3-1–2 traced | ✓ All items present (see detail below) |
| US-B3-01/02/03/05 explicitly mapped in flows | ✓ F1 → US-B3-01/02/05; F2 → US-B3-03 |

### FR / US trace (adversarial spot-check)

| Requirement | Evidence in artifacts |
|-------------|----------------------|
| FR-B3-1.1 mapped shape | BLM message contract: `{ locale, path: string /* len≥1 */, anchor? }` |
| FR-B3-1.1 unmapped shape | BLM message contract: `{ locale }` — omit keys |
| FR-B3-1.2 locale from preference or `en` | F1: `locale = getLastOfficialDocsLocale() \|\| "en"` |
| FR-B3-1.3 no external browser | F1: "MUST NOT call docsOpenHref / open-doc / openExternal" |
| FR-B3-1.4 type string pinned in FD | `open-official-doc` |
| FR-B3-2.1 label includes stage name | FC: OpenOfficialDocLink "accessible name `Docs: <stageDisplayName>`" |
| FR-B3-3.3 unmapped → Shell top | F2: "top (no page selected); locale applied; focus h1/main" |
| FR-B3-4.1 path used to open page | F1 Shell: "apply locale + path + anchor" |
| FR-B3-4.2 anchor landing | F1 Shell: "focus: scrolled→heading; top→h1/main" |
| FR-B3-4.3 locale applied to Shell | F1 Shell: "apply locale" |
| FR-B3-4.4 one-shot clear | F1 Shell: "clear deep-link (one-shot)" |
| FR-B3-5.1 legacy not on mapped path | F1 MUST NOT + Invariants + FC Forbidden |
| NFR-B3-1 no remote fetch | Invariant: "No remote HTTP/`fetch` of official docs URLs" |
| NFR-B3-2 extension webview only | FC A11y: "Extension Webview only (NFR-B3-2)" |

### Findings

**F1 (MINOR) — `docsShellDeepLink.locale?` store type is optional but message contract makes locale required.**  
`frontend-components.md` § State defines `docsShellDeepLink` as `{ locale?: "en"|"ja"; path?: string; anchor?: string } | null`. Per the BLM message contract, `locale` is required in both mapped and unmapped payloads, and the host handler validates `locale ∈ {en,ja}` before injecting the deep-link — so `docsShellDeepLink.locale` is never `undefined` in practice. The optional typing widens the store type beyond what the contract allows: a developer implementing Shell locale application may add a null-coalescing branch (`?? "en"`) that is dead code, or may ship a path that silently falls through to an unintended default if a future caller bypasses the host validator.  
*Action (non-blocking):* Tighten the store type to `{ locale: "en" | "ja"; path?: string; anchor?: string } | null`.

**F2 (MINOR) — F2 "same host open path" defers locale-persistence semantics to F1 by implicit cross-reference.**  
The F2 flow does not restate which host steps apply; a developer reading F2 in isolation must back-read F1 to confirm that the unmapped path also validates locale, persists the preference to `globalState`, and injects `docsShellDeepLink { locale }`. The intent is unambiguous with both flows in view, but an implementation split across two developers (host handler vs. Shell wiring) could cause the unmapped branch to omit the persist step.  
*Action (non-blocking):* Expand F2's host step to "validate locale; persist locale to globalState; open/front Docs Shell; inject `docsShellDeepLink { locale }`" (same cadence as F1, path/anchor omitted).

### Summary

Two minor findings; zero blockers. All seven checklist items pass: message type pinned, mapped/unmapped discriminant correct (key omission + `path:""` guard), host persist and one-shot Shell clear specified, dashboard→official-docs import ban present in two places, legacy open-doc ban explicit on mapped path, `ui` produces BLM + frontend-components only (no business-rules / domain-entities), and all FR-B3 / US-B3 items traceable without gaps. A developer can implement this unit without architectural questions beyond these two non-blocking clarifications.  
