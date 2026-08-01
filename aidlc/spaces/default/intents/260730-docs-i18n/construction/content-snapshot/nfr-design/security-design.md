# Security Design — Unit: content-snapshot

> nfr-design (3.3) / Unit: content-snapshot (kind: packaging) / 2026-07-31  
> 入力: [security-requirements.md](../nfr-requirements/security-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md)

## Design

| Control | Design | Maps to |
|---------|--------|---------|
| Secret exclusion | Snapshot/ingest checklist: deny `.env`, keys, `aidlc/` runtime paths | S-CS-1, S-CS-2 |
| Path allowlist | Only `docs/guide/**`, `docs/reference/**`, `docs/official-docs.manifest.json` | S-CS-3, S-CS-4 |
| No runtime fetch | Packaging produces committed files only; readers (other units) enforce NFR-1 | S-CS-5 |
| Manifest schema | JSON with `sourceVersion` / `source` / `capturedAt` only | S-CS-4 |

## AWS / cloud

N/A — local monorepo packaging; no IAM, KMS, or network controls in this unit.

## Verification hooks

- Pre-merge / package hygiene review  
- Future VSIX contents check (NFR-6) in build-and-test / ci-pipeline  

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-07-31

Allowlist + hygiene controls are proportionate for packaging; no overbuilt cloud security theatre.
