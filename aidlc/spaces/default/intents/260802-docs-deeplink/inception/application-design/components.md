# Components — Docs i18n Bolt 3

> ステージ: application-design / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 計画: Q1–Q4 = A / Q5 = D（Looks correct）  
> 上流: [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [architecture.md](../../../codekb/aidlc-guide/architecture.md) · [component-inventory.md](../../../codekb/aidlc-guide/component-inventory.md)  
> 親 AD: `260730-docs-i18n` + `260801-docs-locale` — **再仕様化しない**。本ファイルは Bolt 3 差分のみ。

## Design intent

Bolt 2 まで Docs Shell / locale / anchor は完成。Bolt 3 は **StageCard → openOfficialDoc → Docs Shell** を配線完了する。新パッケージなし。クラウド / AWS なし。dashboard は `@aidlc-guide/official-docs` を import しない（既存 layering）。

## Changed components (delta)

| Component | npm / location | Bolt 3 delta | Owns |
|-----------|----------------|--------------|------|
| **official-docs** | `@aidlc-guide/official-docs` | `STAGE_DOC_MAP` / `mapStageToDoc` を 7-slug 回帰ロック（集合変更なし） | Map データ所有 |
| **api-core** | `@aidlc-guide/api-core` | 既存 `GET /api/official-docs/stage/:slug` → `officialDocsStageMap` を StageCard が消費（新ルート不要）。dashboard はここ経由で path を得る | Map lookup パススルー |
| **dashboard** | `@aidlc-guide/dashboard` | OpenOfficialDocLink（ラベル + emit）；`docsShellDeepLink` に `locale` を追加して着地；レガシー `docsOpenHref`/`open-doc` を mapped 経路から除去 | UI emit + Shell land |
| **shared-types** | `@aidlc-guide/shared-types` | openOfficialDoc payload 型（mapped / unmapped） | Wire DTO |
| **vscode-extension** | `aidlc-guide` | openOfficialDoc-style postMessage ハンドラ；last-used locale を host `globalState`；Shell を開き deep-link 注入 | Host + preference |

## Unchanged / out of Bolt 3 Must

| Component | Note |
|-----------|------|
| reader-core / docs-bridge | 変更なし |
| dashboard-server / mcp-server | Fail 条件にしない（Q4=A / NFR-B3-2） |
| core-utils | 変更なし |

## Boundaries

```text
StageCard (dashboard)
  │ wire: stage-map lookup
  ▼
api-core.officialDocsStageMap ──► official-docs.mapStageToDoc
  │
  │ postMessage openOfficialDoc {locale, path?, anchor?}
  ▼
vscode-extension handler
  │ open Docs Shell + inject deep-link (incl. locale)
  ▼
DocsShell (dashboard) ── one-shot apply ──► AnchorApplier / locale control

dashboard ✗ official-docs (direct import forbidden)
```

## Story coverage

| Story | Components |
|-------|------------|
| US-B3-01 | dashboard emit + extension handler + DocsShell land + shared-types |
| US-B3-02 | dashboard OpenOfficialDocLink label |
| US-B3-03 | emit unmapped `{locale}` + Shell top |
| US-B3-04 | official-docs STAGE_DOC_MAP + tests |
| US-B3-05 | dashboard: no legacy open on mapped |
| US-B3-06 | check matrix C1–C7 + demo-record |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02 (re-review §12a)  
**Verdict:** READY — 0 open findings

---

### F1 — CLOSED

`services.md` Communication table now names `GET /api/official-docs/stage/:stageSlug` and pins the file (`packages/api-core/src/handlers/read.ts`). `components.md` row and `component-methods.md` **Route** field are consistent. "New route not needed" is explicit. Transport still says "extension host proxy or HTTP-shaped wire" — that ambiguity is in the *mechanism*, not the *contract*; the route is the contract. ✓

### F2 — CLOSED

`component-dependency.md` Forbidden edges now carries an Enforcement column: "`packages/dashboard/tests/dependency-direction.test.ts` lists `@aidlc-guide/official-docs` in `FORBIDDEN_IMPORTS`; failures turn `bun run check` red." Specific file, specific constant, specific gate — sufficient. ✓

### F3 — CLOSED

`component-methods.md` `officialDocsStageMap` Out field now reads: "Always `{ ok: true, value: StageDocRef | null }` today — map miss is `value: null`, **not** `ok: false` (pure function; no I/O failure mode)." Dashboard behavior on null is stated: unmapped payload path, no fetch-error banner. `getLastOfficialDocsLocale` now explicitly guards corrupt values → `"en"`. ✓

### F4 — CLOSED

`decisions.md` ADR-B3-001 Consequences now carries explicit legacy coexistence language: "`open-doc`/`docsOpenHref` remain for non–official-docs paths; Bolt 3 does not delete those call sites; full retirement is out of scope." Posture is "coexistence by design," not ambiguous tech debt. ✓

### F5 — CLOSED

`decisions.md` ADR-B3-003 Consequences now states: persistence survives Webview dispose/reopen and extension host restart; locale validated as `"en" | "ja"` before persisting, invalid → `"en"`; "successful activate" = validation OK + Shell open/front attempted. All three gaps from the prior finding are addressed. ✓

---

### Passes (carried from prior review, unaffected by fixes)

- **Story coverage:** FR-B3-1–6 and NFR-B3-1/2/3 fully traced to GWT stories. No orphan FRs.
- **Layering enforcement (dashboard ✗ official-docs):** Now tooling-backed (F2 close); design-level boundary consistent across components.md, component-dependency.md, ADR-B3-002.
- **NFR-B3-1 (no outbound fetch) / NFR-B3-2 (VS Code/Cursor only):** Traceable constraints and story spies intact.
- **ADR quality:** All three ADRs have options, decisions, and consequences with no unexplained gaps.

A developer can implement this system end-to-end without architectural questions beyond this document.
