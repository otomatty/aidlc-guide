# Architecture Decisions — Docs i18n Bolt 3

> ステージ: application-design / 2026-08-02  
> 上流: [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [architecture.md](../../../codekb/aidlc-guide/architecture.md) · [application-design-questions.md](./application-design-questions.md)  
> 親 ADR（docs-i18n / Bolt 2）は継承。本ファイルは Q5=D の **Bolt 3 差分 ADR**。

---

# ADR-B3-001: Host-openOfficialDoc

## Status
Proposed (pending gate; Q2=A, Q5⊃A)

## Date
2026-08-02

## Context
StageCard today uses `docsOpenHref` / IDE `open-doc`, which opens outside the Docs Shell contract. FR-B3-5 and US-B3-01 require in-extension Shell landing without external browser.

### Options

**Option A — openOfficialDoc postMessage only（mapped）**  
- Pros: Matches FR-U3 / FR-B3; single host seam; testable spies  
- Cons: New handler alongside legacy `open-doc`  
- Reversibility: Easy to keep legacy for non-docs paths  

**Option B — Keep `open-doc` and teach it official paths**  
- Pros: Fewer message types  
- Cons: Confuses bridge-map vs STAGE_DOC_MAP trust boundaries  
- Reversibility: Hard once paths mix  

**Recommendation:** A

## Decision
Mapped StageCard activation uses openOfficialDoc-style host message only. Legacy `docsOpenHref` / `open-doc` must not run on that path.

## Consequences
- vscode-extension gains handler; dashboard emits new message  
- Message type string finalized in Functional Design  
- **Legacy coexistence:** `open-doc` / `docsOpenHref` remain for **non–official-docs** paths (bridge / file-ref). Bolt 3 does **not** delete those call sites; it only forbids them on **mapped StageCard official-docs** activation. Full retirement of `open-doc` is out of scope.

## Alternatives Rejected
B — trust-boundary collision with bridge `open-doc`

---

# ADR-B3-002: Map-boundary via api-core

## Status
Proposed (pending gate; Q1=A, Q5⊃B)

## Date
2026-08-02

## Context
`STAGE_DOC_MAP` lives in `@aidlc-guide/official-docs`. Dashboard must not import that package. Bridge `doc.deepLink` is a different map.

### Options

**Option A — api-core `officialDocsStageMap` wire lookup**  
- Pros: Honours layering; reuses existing handler; single map source  
- Cons: Extra wire hop from StageCard  
- Reversibility: Easy  

**Option B — dashboard imports official-docs**  
- Pros: Sync local call  
- Cons: Violates dependency-direction tests  
- Reversibility: Blocked by policy  

**Option C — duplicate map in dashboard/shared-types**  
- Pros: No hop  
- Cons: Drift vs STAGE_DOC_MAP  
- Reversibility: Painful  

**Recommendation:** A

## Decision
StageCard obtains paths via api-core stage-map wire (`officialDocsStageMap` → `mapStageToDoc`). No dashboard→official-docs import. Do not use bridge `doc.deepLink` as the official map.

## Consequences
- Construction wires StageCard to existing api-core method  
- US-B3-04 remains official-docs ownership  

## Alternatives Rejected
B — layering violation; C — dual maps

---

# ADR-B3-003: Locale-on-deeplink + host preference

## Status
Proposed (pending gate; Q3=A, Q5⊃C)

## Date
2026-08-02

## Context
FR-B3-1.2 / FR-B3-4.3 require locale = last-used preference else `en`, applied on Shell land. Today `docsShellDeepLink` is `{path?, anchor?}` only; DocsShell locale is largely component state.

### Options

**Option A — host `globalState` preference + deep-link carries `locale`**  
- Pros: Survives reopen; Shell can set control + fetch from target; matches stories Construction pin  
- Cons: New preference key; store shape change  
- Reversibility: Medium  

**Option B — in-memory DocsShell `useState` only**  
- Pros: Minimal code  
- Cons: Loses preference across sessions; fails FR-B3-1.2 intent  
- Reversibility: Easy but wrong  

**Recommendation:** A

## Decision
Last-used official-docs locale lives in extension host `globalState` (key name → FD). openOfficialDoc payload and `docsShellDeepLink` carry `locale`. DocsShell applies it on land. Default `en` when unset.

## Consequences
- Extend deep-link target type with `locale`  
- **Persistence:** preference in host `globalState` must survive Webview dispose/reopen and extension host restart within the same user profile  
- **Write rule:** handler persists `locale` only when payload.locale ∈ {`en`,`ja`} **and** the host accepts the message (validation passed). Do not persist on malformed payloads. "Successful activate" = validation OK + Shell open/front attempted (persist even if Shell UI later fails to render a page)  
- Corrupt stored values read as `en`（see `getLastOfficialDocsLocale`）

## Alternatives Rejected
B — insufficient for preference requirement

---

## Review note

**Reviewer:** aidlc-architecture-reviewer-agent · **Date:** 2026-08-02  
**Finding F4 (MODERATE — ADR-B3-001):** Consequences omit scope of legacy `open-doc` post-Bolt 3. The decision retires `docsOpenHref`/`open-doc` on mapped StageCard paths, but `open-doc` is still used for methodology docs (architecture.md TX-3). State whether coexistence is intentional ("retained for non-official paths; two open mechanisms persist post-Bolt 3") or a migration start ("cleanup in a future Bolt"). Without this, developers don't know whether to leave non-official `open-doc` calls intact.  
**Finding F5 (MODERATE — ADR-B3-003):** Consequences say "Handler writes preference on successful activate" but don't define "successful" or state the globalState persistence guarantee (survives VS Code restart) that was the winning argument over Option B. Extend consequences with: persistence guarantee, what "successful" means (Shell open call issued without error), and locale validation before write (`"en" | "ja"` only; invalid → `"en"`).
