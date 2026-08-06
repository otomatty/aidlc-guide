# Performance Design — Unit: docs-navigation (Bolt 4)

> nfr-design / docs-navigation (ui) / 2026-08-04  
> 上流: [performance-requirements.md](../nfr-requirements/performance-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [security-requirements.md](../nfr-requirements/security-requirements.md) · [scalability-requirements.md](../nfr-requirements/scalability-requirements.md) · [reliability-requirements.md](../nfr-requirements/reliability-requirements.md)  
> Q1 = A

## Requirement → mechanism

| Req ID | Mechanism | Component |
|--------|-----------|-----------|
| P-B4-DN-1 | Local postMessage `open-official-doc` → host → Shell; no remote official-docs fetch | `OpenOfficialDocLink`, host reuse, `DocsShell` |
| P-B4-DN-2 | No Bolt 4 ms budget / timing harness Must | N/A — review only |
| P-B4-DN-3 | `bun run check` tests (non-mount + CTA emit) + Demo Bridge → Shell | verify / demo-record |
| P-B4-DN-4 | No new 95% branch floor | policy — NFR-B4-2 |
| P-B4-DN-5 | Extension Webview only | NFR-B4-3 |

## Explicit non-goals

- No service throughput / autoscaling  
- No CDN / edge cache  
- No Shell-open latency instrumentation as Must  
- No AWS / cloud

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY

### Checklist

| Check | Result |
|-------|--------|
| P-B4-DN-1…5 → mechanism | ✓ |
| AWS N/A | ✓ |
| Upstream NFR + BLM referenced | ✓ |
