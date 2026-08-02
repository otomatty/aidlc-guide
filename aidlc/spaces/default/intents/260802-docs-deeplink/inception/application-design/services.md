# Services — Docs i18n Bolt 3

> ステージ: application-design / 2026-08-02  
> 計画: Q2=A / Q4=A — 新サービスなし。既存モジュールモノリス + postMessage。

## Service map

| Service / surface | Role in Bolt 3 |
|-------------------|----------------|
| **vscode-extension host** | openOfficialDoc handler；locale `globalState`；webview lifecycle |
| **dashboard Webview** | StageCard emit；Docs Shell land；wire calls to api-core |
| **api-core（in-process）** | `officialDocsStageMap` + existing official-docs page/TOC routes |
| **official-docs library** | Map + content resolve（unchanged ownership） |

## Orchestration

**Pattern:** Host orchestration（not choreography bus）.

```text
User activates link
  → dashboard builds payload (stage-map lookup via api-core)
  → postMessage to extension
  → extension updates preference + opens Shell with deep-link
  → dashboard DocsShell one-shot applies target
```

No async message bus, no new worker, no cloud.

## Communication

| From | To | Mechanism |
|------|-----|-----------|
| dashboard | api-core | **Stage-map lookup (named):** `GET /api/official-docs/stage/:stageSlug` → `officialDocsStageMap` → `mapStageToDoc`（already routed in `packages/api-core/src/handlers/read.ts`). Same transport as other dashboard reads (extension host proxy or HTTP-shaped wire) — StageCard must call **this route**, not invent a parallel message. |
| dashboard | vscode-extension | postMessage openOfficialDoc-style（message `type` string → Functional Design / FR-B3-1.4） |
| vscode-extension | dashboard | Inject deep-link state / front Docs Shell（host-owned） |

## Out of scope services

- dashboard-server / MCP as Must accept surfaces（NFR-B3-2）  
- Remote CMS / fetch of official upstream URLs（NFR-B3-1）

## Review note

**Reviewer:** aidlc-architecture-reviewer-agent · **Date:** 2026-08-02  
**Finding F1 (BLOCKER):** Communication contract for `dashboard → api-core` stage-map lookup is underspecified. "Existing wire（HTTP-shaped or host proxy）" with an "or" is not a contract. Name the specific route (e.g., `GET /api/official-docs/stage-map/:slug`) or the postMessage type that exposes `officialDocsStageMap` to dashboard. If the route must be added as a Bolt 3 delta, state that explicitly and include the URL pattern.
