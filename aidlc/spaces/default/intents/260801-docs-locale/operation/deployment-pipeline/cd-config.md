# CD Config — Docs i18n Bolt 2

> deployment-pipeline / 2026-08-02  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [quality-gates.md](../../construction/ci-pipeline/quality-gates.md) · [docs-shell deployment-architecture](../../construction/docs-shell/infrastructure-design/deployment-architecture.md) · [docs-shell cicd-pipeline](../../construction/docs-shell/infrastructure-design/cicd-pipeline.md) · [official-docs cicd-pipeline](../../construction/official-docs/infrastructure-design/cicd-pipeline.md)

## Summary

**No continuous-delivery pipeline to cloud.** Project DECIDED: local-only. Bolt 2 ships via existing extension packaging path.

## Release path

```text
PR → GHA check.yml / bun run check → merge main
  → (optional) bun run build:extension → install VSIX in VS Code / Cursor
```

## Artifacts

| Artifact | Produced by | Distributed how |
|----------|-------------|-----------------|
| Library `@aidlc-guide/official-docs` | workspace package | in-process via api-core |
| Docs Shell UI | dashboard bundle | Webview in extension |
| VSIX | `build:extension` scripts | Manual install / existing channel |

## Explicit non-goals

- No CodeDeploy / ECS / Lambda / S3 static hosting for docs
- No marketplace auto-publish in this intent

## Review

**Verdict:** READY
