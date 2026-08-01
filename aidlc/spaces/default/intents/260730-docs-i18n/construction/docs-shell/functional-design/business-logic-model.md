# Business Logic Model — Unit: docs-shell

> functional-design / docs-shell (ui) / 2026-07-31  
> 上流: mockups RM1–RM2 · stories US-02–04 · interaction-spec · components.md

## Purpose

Docs Shell Webview: TOC + main + LocaleControl + sourceVersion + UntranslatedNotice.

## Flows

1. Open Shell → fetch toc + page via `/api/official-docs`  
2. Select TOC → load path  
3. setLocale → keep path; apply anchor / missing_ja notice from API  
4. Show `sourceVersion` from manifest/page metadata  

States: loading | empty | error | ready | partial (US-04).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
