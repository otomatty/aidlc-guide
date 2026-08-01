# Services — Docs i18n

> ステージ: application-design / 2026-07-31  
> 上流: requirements.md · stories.md · architecture.md · component-inventory.md · team-practices.md · components.md  
> 注: クラウド／AWS サービスは対象外（ローカル拡張のみ）。

## Service view (logical)

本 intent は新規マイクロサービスを立てない。既存 **in-process application services**（api-core）に公式 docs 読み取りを追加する。

| Logical service | Implementation | Responsibility | Lifecycle |
|-----------------|----------------|----------------|-----------|
| OfficialDocsRead | api-core handlers + official-docs lib | Serve TOC/page/manifest offline | Process-local; no scale-out |
| DocsShellSession | dashboard + extension preference | Locale preference, current path/anchor | Webview lifetime + workspaceState |
| WorkflowDeepLink | extension command + StageCard | Map stage → open Docs Shell | On user activate |
| BridgeDegrade | dashboard UI (+ optional docs-bridge aids) | Redirect to canonical Docs | On render of legacy surface |

## Orchestration

**Orchestration (sync request/response)** — not choreography/events.

```text
User → dashboard → (postMessage) vscode-extension → api-core → official-docs → FS
                 ← ReadResult ←
```

Locale change and deep link are the same sync path with different entrypoints.

## Communication contracts

| From | To | Pattern | Contract |
|------|-----|---------|----------|
| dashboard | extension / api-core | Sync GET-shaped | `/api/official-docs/:locale/*` |
| StageCard | extension | Sync command/postMessage | `{ locale, path, anchor? }` |
| Bridge panel | Docs Shell | In-webview navigate / command | Open path in Shell |
| official-docs | core-utils | Sync call | `guardPath` |

No message bus, no cloud queue, no gRPC.

## Scaling / HA

N/A — single-user local IDE. Performance concern is FS read + markdown render size (lazy-markdown already in inventory).

## AWS / cloud mapping (platform voice)

| Concern | Decision |
|---------|----------|
| Hosting | None — VSIX + workspace FS |
| CDN / S3 docs | Out of scope |
| AuthN/Z cloud | N/A |
| Observability SaaS | N/A |

## Ops services (non-runtime)

| Concern | Form |
|---------|------|
| Snapshot ingest (US-01) | Repo script / committed tree — not a long-running service |
| Diff report (US-08 Should) | CLI/script later — Functional Design pins format |
| Translate PRs (US-07) | Human git workflow |
