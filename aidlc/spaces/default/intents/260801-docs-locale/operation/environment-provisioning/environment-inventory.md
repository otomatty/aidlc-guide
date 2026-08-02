# Environment Inventory — Docs i18n Bolt 2

> environment-provisioning / 2026-08-02  
> 上流: [docs-shell deployment-architecture](../../construction/docs-shell/infrastructure-design/deployment-architecture.md) · [cd-config.md](../deployment-pipeline/cd-config.md) · [ci-config.md](../../construction/ci-pipeline/ci-config.md)

## Cloud / AWS

**None provisioned.** Project DECIDED local-only. `infrastructure-services` not produced for ui/library units — N/A.

## Environments that exist

| Env | Type | Notes |
|-----|------|-------|
| Developer workstation | Local | bun, VS Code / Cursor, workspace checkout |
| GitHub Actions runners | Ephemeral CI | ubuntu / windows / macos matrix (`check.yml`) |
| Extension host | Desktop | vscode-extension Webview + bundled docs |

## Shared local resources

| Resource | Path / package |
|----------|----------------|
| Official docs content | `docs/guide|reference/<locale>/` |
| Manifest | `docs/official-docs.manifest.json` |
| Library | `@aidlc-guide/official-docs` |
| API seam | `@aidlc-guide/api-core` |
| UI | `@aidlc-guide/dashboard` Docs Shell |

## Secrets

No cloud secrets. No Secrets Manager / Parameter Store for Bolt 2.

## Review

**Verdict:** READY
