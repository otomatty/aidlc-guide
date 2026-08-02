# Refined Mockups — Docs i18n Bolt 3

> ステージ: refined-mockups / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 計画: Q1–Q7 = A/E + Looks correct  
> 上流: [wireframes.md](../../ideation/rough-mockups/wireframes.md) · [user-flow.md](../../ideation/rough-mockups/user-flow.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md)  
> 忠実度: mid — StageCard OpenOfficialDocLink + Docs Shell deep-link land。新規フル画面なし。拡張 Webview のみ（NFR-B3-2）。

## Story → Screen Map

| Story | Screen / state | FR / NFR |
|-------|----------------|----------|
| US-B3-01 | **RM-B3-1** mapped land | FR-B3-1, FR-B3-4, NFR-B3-1/2 |
| US-B3-02 | **RM-B3-0** StageCard label | FR-B3-2.1 |
| US-B3-03 | **RM-B3-2** unmapped → top | FR-B3-1.1 unmapped, FR-B3-3.3 |
| US-B3-04 | —（map fixture・画面なし） | FR-B3-3.1–3.2 |
| US-B3-05 | RM-B3-0/1 の negative path | FR-B3-5.1 |
| US-B3-06 | —（check + demo-record） | FR-B3-6, NFR-B3-3 |

Bridge / Bolt 2 locale redesign / browser Dashboard は **対象外**（Q6=A / stories Won't）。

---

## RM-B3-0 — StageCard + OpenOfficialDocLink（W1a）

```text
┌─ StageCard: Intent Capture ─────────────────────────┐
│ 目的 / 入力 / 出力 / …                               │
│                                                      │
│  [ Docs: Intent Capture ]  ← accessible name 同一   │
│  （not bare "Docs"；色だけに依存しない）              │
└──────────────────────────────────────────────────────┘
```

**Surface:** VS Code / Cursor extension Dashboard Webview.  
**Activation:** pointer click **or** Tab → Enter/Space（US-B3-01）.  
**Result:** host openOfficialDoc-style message; **no** modal; Docs Shell opens/fronts（Q7=A）.  
**Label (Q1=A):** visible text and accessible name = `Docs: <Stage display name>`.  
**Legacy:** mapped path must not use `docsOpenHref` / IDE `open-doc`（US-B3-05）.

---

## RM-B3-1 — Mapped deep-link land（W2a / US-B3-01）

```text
Host payload: { locale, path, anchor? }  // path non-empty
Docs Shell:
┌─ header ─ locale control matches payload.locale ─ sourceVersion ─┐
├─ nav (TOC) ─────┬─ main ─────────────────────────────────────────┤
│ … sel on path   │ # <h1>  or scrolled heading                    │
│                 │ body…                                           │
└─────────────────┴────────────────────────────────────────────────┘
Focus (Q2=A):
  anchor hit → that heading
  missing/no anchor → h1 or main
  never return focus to locale control
One-shot: deep-link target cleared after first apply
No external browser / no remote fetch of official docs (NFR-B3-1)
```

---

## RM-B3-2 — Unmapped → Shell top（US-B3-03）

```text
Host payload: { locale } only  // omit path/anchor keys; path:"" Fail
Docs Shell:
  opens; no page selected (top)
  locale control = payload.locale
  focus → h1 or main (same language as RM-B3-1 top-land)
  no external browser
```

---

## States overview（Q3 = E）

| State | Surface | UI |
|-------|---------|-----|
| idle | Dashboard | RM-B3-0 link visible |
| activating | Dashboard→host | brief; no blocking modal |
| mapped land | Docs Shell | RM-B3-1 |
| unmapped top | Docs Shell | RM-B3-2 |

## Design Constraints

- 既存 DS のみ（Q4=A）— 新規トークンなし  
- 拡張 Webview のみ（Q6=A / NFR-B3-2）  
- 7-slug map 変更なし（US-B3-04）

## Review

**Reviewer:** aidlc-product-lead-agent  
**Date:** 2026-08-02 (re-review — §12a)  
**Verdict:** READY

### F1–F3 closure verification

| Finding | Fix applied | Evidence | Status |
|---------|-------------|----------|--------|
| F1 (MEDIUM) — activating state visual undefined | `interaction-spec.md` `activating` row updated | "Link retains idle appearance throughout; no spinner; non-blocking（message in flight）" — visual phrase present; developer knows exactly what to render | CLOSED ✓ |
| F2 (LOW) — disabled Bolt 3 applicability unstated | `interaction-spec.md` `disabled` row updated | "**Out of scope for Bolt 3** — OpenOfficialDocLink is always shown; unmapped slugs still activate（US-B3-03 → Shell top）, they are not disabled" — rationale explicit | CLOSED ✓ |
| F3 (LOW) — AnchorApplier informal reference | `design-system-mapping.md` anchor-apply row updated | `` `packages/dashboard/src/components/docs-shell/AnchorApplier.tsx` + store `docsShellDeepLink` `` — file path and store both pinned | CLOSED ✓ |

### Adversarial sweep — no new blockers

| Check | Result |
|-------|--------|
| `path:"" Fail` annotation (RM-B3-2) | Correct-pattern contract ("omit path/anchor keys") stated in both mockups and interaction-spec. Annotation is informational documentation of the wrong pattern. No finding. |
| `sourceVersion` in RM-B3-1 header | Pre-existing DocsShell element; design-system-mapping confirms existing modules reused; no new token. No finding. |
| FR-B3-6 absent from interaction-spec traceability | US-B3-06 = test/demo-record (non-UI); explicitly labelled in Story→Screen Map; NFR-B3-3 is test-strategy. No screen required. No finding. |
| `docsShellDeepLink` store mechanism unspecified | Appropriate deferral to Functional Design (FR-B3-1.4). Named; developer can locate. No finding. |
| A11y-B3-1–8 | All eight items traceable and verifiable. Unaffected by F1/F2 closure. Clean. |
| Story→screen coverage | 6/6 covered; US-B3-04/06 non-UI omissions deliberately labelled. Clean. |
| FR / NFR traceability | FR-B3-1…6 + NFR-B3-1/2/3 accounted for across artifacts. Clean. |

**Finding count: 0 open. Engineering may start.**
