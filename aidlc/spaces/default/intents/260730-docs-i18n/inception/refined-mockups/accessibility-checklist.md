# Accessibility Checklist — Docs i18n

> ステージ: refined-mockups / 2026-07-31  
> 目標: Q5=A — **NFR-7 Should** を実装チェック可能に。WCAG 2.1 AA 完全適合は後段。  
> 上流: requirements.md (NFR-7) · wireframes.md · mockups.md · stories.md · user-flow.md · interaction-spec.md · team-practices.md

## Scope

Surfaces: RM1 Docs Shell, RM2 locale/untranslated, RM3 deep-link land, RM4 Bridge, RM5 StageCard link.  
Non-UI ops (US-01/07/08) out of this checklist.

## NFR-7 checklist (Should)

| # | Criterion | Where | Pass evidence |
|---|-----------|-------|---------------|
| A1 | TOC and body reachable by keyboard only | RM1 | Tab/arrow to TOC item → Enter loads; Tab to main; no mouse-only control |
| A2 | Page has `h1`; landmarks include `nav` + `main` | RM1 | DOM: one h1 for page title; `nav`=TOC; `main`=body |
| A3 | Locale control shows visible current locale | LocaleControl | Active `en`/`ja` labeled; not color-only; `aria-current` or equivalent |

## Story-aligned a11y (Must stories)

| # | Criterion | Story | Pass evidence |
|---|-----------|-------|---------------|
| B1 | After locale switch with anchor, focus/scroll to heading | US-03 | Focus target = heading element or page top if missing |
| B2 | Untranslated notice not color-only; in main; status/live | US-04 | `role="status"` (or equiv) + visible text |
| B3 | Deep-link with anchor focuses/scrolls heading; else top | US-05 | Same oracle as B1 |
| B4 | StageCard label not bare `Docs` | US-05 | Accessible name includes purpose (e.g. Intent Capture) |
| B5 | Bridge primary control keyboard-activatable; excerpt not main article | US-06 | Focusable CTA; no excerpt article mount |

## Baseline (existing extension parity)

| # | Criterion | Notes |
|---|-----------|-------|
| C1 | Focus visible on interactive controls | Reuse dashboard focus ring |
| C2 | Text contrast for body + notice | Aim 4.5:1; theme tokens |
| C3 | Skip link or equivalent to main | Optional but recommended on RM1 |

## Deferred (not this stage)

- Full WCAG 2.1 AA audit  
- Automated axe gate as Must  
- Screen-reader scripted suite beyond status announcement  
- NFR-5 VSIX size (unrelated)

## Verification hook

Manual keyboard pass on RM1–RM5 before Build-and-Test UI sign-off. Unit tests cover US-03/US-04 behaviour oracles; a11y attributes asserted where cheap (role/status, aria-current).
