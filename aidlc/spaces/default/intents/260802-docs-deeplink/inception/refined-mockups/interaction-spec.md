# Interaction Spec — Docs i18n Bolt 3

> ステージ: refined-mockups / 2026-08-02  
> 上流: [mockups.md](./mockups.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md) · [wireframes.md](../../ideation/rough-mockups/wireframes.md) · [user-flow.md](../../ideation/rough-mockups/user-flow.md)  
> 形式: component-spec-template に準拠

## Flow A — StageCard → Docs Shell（user-flow）

| Step | Actor | Action | Result |
|------|-------|--------|--------|
| 1 | P2 | Activate OpenOfficialDocLink | Host receives openOfficialDoc-style message |
| 2a | Host | Mapped slug | Shell fronts; apply locale/path/anchor?; one-shot consume |
| 2b | Host | Unmapped slug | Shell fronts at top; locale only |
| 3 | System | Focus | Heading or h1/main per Q2=A |

No confirmation modal. No external browser on mapped/unmapped success paths（Q7=A）.

---

## OpenOfficialDocLink

| Field | Value |
|---|---|
| Component | OpenOfficialDocLink（StageCard docs control） |
| Description | Stage-named link that emits openOfficialDoc payload |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| idle | Link visible with stage-named label | StageCard render |
| focus | Keyboard focus ring | Tab |
| activating | Link retains idle appearance throughout; no spinner; non-blocking（message in flight） | Activate |
| disabled | **Out of scope for Bolt 3** — OpenOfficialDocLink is always shown; unmapped slugs still activate（US-B3-03 → Shell top）, they are not disabled | — |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| stageSlug | string | yes | — | Map key |
| stageDisplayName | string | yes | — | Used in label `Docs: {name}` |
| locale | `"en" \| "ja"` | yes | preference \|\| `en` | Payload locale |

### Accessibility

| Requirement | Implementation |
|---|---|
| Name | Accessible name = visible `Docs: <Stage display name>`（Q1=A） |
| Keyboard | Tab focus; Enter/Space activate（US-B3-01） |
| Contrast | WCAG AA; not color-only |
| Role | link or button with link semantics |

### Behaviour notes

- Mapped: payload `{ locale, path, anchor? }` with non-empty `path`  
- Unmapped: `{ locale }` only — omit `path`/`anchor` keys  
- Must not invoke `docsOpenHref` / IDE `open-doc` on mapped activate（US-B3-05）  
- Message type string → Functional Design（FR-B3-1.4）

---

## DocsShellDeepLinkLand

| Field | Value |
|---|---|
| Component | DocsShell（deep-link apply） |
| Description | One-shot apply of openOfficialDoc target |
| Category | navigation / content |

### States

| State | Description | Trigger |
|---|---|---|
| mapped land | path selected; locale set; optional anchor | Mapped payload |
| unmapped top | no page selected; locale set | Unmapped payload |
| consumed | pending target cleared | After first apply |

### Accessibility

| Requirement | Implementation |
|---|---|
| Focus after land | anchor heading **or** h1/main（Q2=A） |
| Landmarks | header / nav / main retained from Bolt 1–2 |
| Locale control | Matches payload.locale; not focus target after land |

### Behaviour notes

- One-shot: no re-apply on re-render（FR-B3-4.4）  
- Anchor missing → top + h1/main focus（FR-B3-4.2）  
- No outbound HTTP/`fetch` to remote official docs（NFR-B3-1）

---

## Traceability

| Spec block | Stories | FR |
|------------|---------|-----|
| OpenOfficialDocLink | US-B3-01,02,03,05 | FR-B3-1,2,3,5 |
| DocsShellDeepLinkLand | US-B3-01,03 | FR-B3-4 |
| Flow A | US-B3-01…06 | Flow A / Issue #29 |

## Review

**Reviewer:** aidlc-product-lead-agent  
**Date:** 2026-08-02  
**See:** mockups.md `## Review` for full verdict (NOT-READY).

**Findings in this file:**

- **F1 (MEDIUM)** OpenOfficialDocLink `activating` state description ("Message in flight") is a system-state phrase, not a visual spec. `idle` and `focus` both describe visual appearance; `activating` must too. Add one phrase (e.g., "Link retains idle appearance; no spinner").
- **F2 (LOW)** OpenOfficialDocLink `disabled` state does not state whether it fires in Bolt 3. US-B3-03 routes unmapped slugs to Shell top — not a disabled link. Either mark this row "out of scope — Bolt 3 always shows the link" or provide the trigger condition.
