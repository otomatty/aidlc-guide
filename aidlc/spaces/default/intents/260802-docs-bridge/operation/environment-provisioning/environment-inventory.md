# Environment Inventory — Docs i18n Bolt 4

> environment-provisioning / 2026-08-05  
> 上流: [deployment-architecture.md](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md) · [infrastructure-services.md](../../construction/docs-navigation/infrastructure-design/infrastructure-services.md) · [cd-config.md](../deployment-pipeline/cd-config.md) · [ci-config.md](../../construction/ci-pipeline/ci-config.md)  
> Q1–Q2 = A · `infrastructure-services` N/A for ui

## Cloud / AWS

**None provisioned.** NFR-B4-3 local-only · project Forbidden cloud.

## Environments that exist

| Env | Type | Notes |
|-----|------|-------|
| Developer workstation | Local | bun, VS Code / Cursor, workspace checkout |
| GitHub Actions runners | Ephemeral CI | ubuntu / windows / macos (`check.yml`) |
| Extension host | Desktop | vscode-extension Webview + open-official-doc handler (reuse) |

## Shared local resources

| Resource | Path / package |
|----------|----------------|
| UI | `@aidlc-guide/dashboard` StageCard (no excerpt) / OpenOfficialDocLink |
| Host | vscode-extension `open-official-doc` (unchanged) |
| Shell / map | Docs Shell + api-core / official-docs (Bolt 1–3) |

## Secrets

No cloud secrets.

## Review

**Verdict:** READY
