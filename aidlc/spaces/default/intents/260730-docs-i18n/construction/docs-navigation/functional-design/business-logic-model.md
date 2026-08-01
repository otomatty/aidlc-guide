# Business Logic Model — Unit: docs-navigation

> functional-design / docs-navigation (ui) / 2026-07-31

## Flows

1. StageCard link → openOfficialDoc `{locale,path,anchor?}` → Shell applyDeepLink (US-05)  
2. Unmapped slug → Shell top  
3. BridgeRedirectPanel → Open in Docs primary; no excerpt article (US-06)  
4. Optional glossary from bridge-map (US-09 Should)

Command/message type string pinned at code-gen (requirements Open Question).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
