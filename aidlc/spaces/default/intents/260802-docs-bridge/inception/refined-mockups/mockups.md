# Refined Mockups — Docs i18n Bolt 4

> ステージ: refined-mockups / 2026-08-03  
> Intent: `260802-docs-bridge`  
> 計画: Q1=A Q2=C Q3=A Q4=D Q5=A Q6=A Q7=A Q8=A · Looks correct  
> 上流: [wireframes.md](../../ideation/rough-mockups/wireframes.md) · [user-flow.md](../../ideation/rough-mockups/user-flow.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md) · [team-practices.md](../practices-discovery/team-practices.md)  
> 忠実度: mid — Bridge degrade + Open in Docs primary。新規フル画面なし。拡張 Webview のみ（NFR-B4-3）。

## Story → Screen Map

| Story | Screen / state | FR / NFR |
|-------|----------------|----------|
| US-B4-01 | **RM-B4-1** ready-degraded（excerpt なし） | FR-B4-1 |
| US-B4-02 | **RM-B4-2** Open in Docs primary CTA | FR-B4-2, NFR-B4-1 |
| US-B4-03 | —（check + Demo record） | FR-B4-3, NFR-B4-2 |
| US-B4-S1 | **RM-B4-3** optional aids（Should） | FR-B4-4 |

Shell 再設計・B3 再実装・B5・locale 再実装は **対象外**（Q7=A / requirements Out of Scope）。

---

## RM-B4-1 — Legacy Bridge ready-degraded（W1）

```text
┌─ Legacy Bridge ─────────────────────────────────────┐
│                                                      │
│  [ Open in Docs ]   ← primary Button (existing DS)   │
│                                                      │
│  Short guidance (non-article):                       │
│  "Canonical docs live in Docs Shell.                 │
│   Use Open in Docs to continue."                     │
│                                                      │
│  (optional Should) glossary / aids                   │
│                                                      │
│  ✗ no docs-excerpt accordion / article body          │
└──────────────────────────────────────────────────────┘
```

**States (Q4=D):**
- **ready-degraded** — above (Must)
- **activating** — optional brief busy on CTA; not a Must-fail if omitted
- **error** — reuse existing host/error patterns if `open-official-doc` rejected

**a11y:** heading inherits panel hierarchy; landmarks under Dashboard `main`; Tab reaches Open in Docs; no excerpt document body for AT (US-B4-01).

---

## RM-B4-2 — Open in Docs CTA（W1a / US-B4-02）

```text
Control: existing dashboard primary Button
Provisional label / accessible name: "Open in Docs"  (Q2=C — FD final pin)
Activation: pointer or Tab → Enter/Space
Emit: { type: "open-official-doc", locale, path?, anchor? }
Result: Docs Shell opens/fronts (Bolt 3 land — Q7=A)
Forbid: openExternal / target=_blank / remote official-docs fetch
```

---

## RM-B4-3 — Optional US-09 aids（Should / Q8=A）

```text
Same panel as RM-B4-1, below guidance:
  [ glossary / helper chips — optional ]
Must not reintroduce excerpt-as-article.
Absence does not fail RM-B4-1/2.
```

---

## W2 — Docs Shell（reference only）

Bolt 3 mid-fi / land contract unchanged（Q7=A）。本 Bolt は着地 UI を描き直さない。

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY  
**Date:** 2026-08-03

### What holds

- Q1–Q8 map to RM-B4-1…3; excerpt forbidden; Shell reuse explicit.
- Stories US-B4-01…03 / S1 traced; Must vs Should clear.
