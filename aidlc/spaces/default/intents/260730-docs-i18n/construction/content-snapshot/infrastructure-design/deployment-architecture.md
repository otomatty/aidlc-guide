# Deployment Architecture — Unit: content-snapshot

> infrastructure-design / content-snapshot (packaging) / 2026-07-31  
> 入力: security-design · components.md · services.md · requirements.md

## Model

| Aspect | Design |
|--------|--------|
| Deploy unit | Files in git monorepo; shipped inside VSIX as static content |
| Environments | Local developer workspace only — no staging/prod cloud |
| Topology | `docs/guide\|reference/<locale>/` + `docs/official-docs.manifest.json` |

## AWS

None. No VPC, buckets, or CDN.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
