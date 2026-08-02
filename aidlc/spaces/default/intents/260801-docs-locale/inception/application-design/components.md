# Components — Docs i18n Bolt 2

> ステージ: application-design / 2026-08-01  
> 計画: Q1–Q5 = A / Q6 = D（Looks correct）  
> 上流: [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [architecture.md](../../../codekb/aidlc-guide/architecture.md) · [component-inventory.md](../../../codekb/aidlc-guide/component-inventory.md)  
> 親 AD: [`260730-docs-i18n` components.md](../../../260730-docs-i18n/inception/application-design/components.md) — **再仕様化しない**。本ファイルは Bolt 2 差分のみ。

## Design intent

Bolt 1 で成立した `official-docs` + `api-core` + Docs Shell を、**keep-path / missing_ja / anchorApplied / coverage 床**まで契約どおり完了する。新パッケージなし。クラウド / AWS なし。

## Changed components (delta)

| Component | npm / location | Bolt 2 delta | Owns |
|-----------|----------------|--------------|------|
| **official-docs** | `@aidlc-guide/official-docs` | `resolve` が要求 path を常に返し、ja 欠落時 `notice=missing_ja` + en body、`anchorApplied` ∈ {scrolled,top,none}。coverage 床対象 | keep-path / missing_ja / anchor 判定（Q2=A） |
| **api-core** | `@aidlc-guide/api-core` | `OfficialDocsPage` をパススルー。notice/anchor を再解釈しない（Q1=A） | ルート登録のみ |
| **dashboard** | `@aidlc-guide/dashboard` | Docs Shell: locale 切替、`notice==="missing_ja"` バナー、`anchorApplied` スクロール／先頭、locale コントロールは `localeRequested` | 表示・フォーカスのみ（Q3=A） |
| **shared-types** | `@aidlc-guide/shared-types` | 既存 `OfficialDocsPage` / `OfficialDocsPageNotice="missing_ja"` を維持。破壊的リネーム禁止 | Wire 契約 |
| **vscode-extension** | `aidlc-guide` | 受入シナリオ実行面（NFR-B2-3）。新ホスト契約なし | 拡張ホスト経路 |

## Unchanged / out of Bolt 2 Must

| Component | Note |
|-----------|------|
| reader-core | Intent records only |
| docs-bridge | Glossary/nav; not canonical body |
| dashboard-server / mcp-server | Fail 条件にしない（Q4=A / NFR-B2-3） |
| core-utils | `guardPath` 再利用のみ |

## Boundaries

```text
dashboard ──wire──► api-core ──► official-docs ──► core-utils.guardPath
                         │              └── FS: docs/guide|reference/<locale>/
                         └── OfficialDocsPage pass-through (no re-shape)
dashboard ✗ official-docs (direct import forbidden)
```

## Story coverage

| Story | Components |
|-------|------------|
| US-B2-01 | official-docs `resolvePage` + `listToc` + dashboard locale/anchor/TOC highlight + extension surface |
| US-B2-02 | official-docs missing_ja + dashboard notice (`role=status`) + wire fields |
| US-B2-03 | official-docs coverage floor in `bun run check` + manual extension scenarios |
| US-B2-S1 | dashboard h1 polish (Should; non-fail) |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-01 (re-review)

### Prior blockers — resolved

#### F1 — TOC method (FR-B2-1.2 / FR-B2-1.3) ✓

`listToc(workspaceRoot, locale) → Result<OfficialDocsToc>` is now present in component-methods.md with a full signature, stated purpose (FR-B2-1.2/1.3 cited), and the highlight decision rule (node `path` equality → select; else clear). The corresponding dashboard action `syncTocHighlight(toc, path)` is specified with the same rule. Story map for US-B2-01 explicitly lists `listToc + syncTocHighlight`. A developer can implement both the `official-docs` side and the `dashboard` side without inferring the contract. F1 is closed.

#### F2 — HTTP error mapping table; 404 ≠ missing_ja ✓

component-methods.md now contains a four-row error table: `ok/missing_ja page` → 200; `not_found` → 404 (error envelope, "do NOT show missing_ja banner"); `path_rejected` → 400; `empty_content` → 503 (default). Dashboard `renderFetchError(kind)` is specified as "never to missing_ja". The invariant is written explicitly: "HTTP 404 must never be interpreted as untranslated." The seam that endangered ADR-B2-001 is closed. F2 is closed.

---

### What holds (full)

- **Component boundaries (Q1=A, Q2=A):** `official-docs` owns keep-path / notice / anchor; `api-core` is pure pass-through; `dashboard` displays only. No circular dependencies. Traceable to FR-B2-4.2, ADR-B2-002.
- **`resolvePage` success path:** keep-path (FR-B2-1.1), missing_ja (FR-B2-2.1), `anchorApplied` enum (FR-B2-3.1/3.2), guardPath containment — all match requirements.
- **TOC contract:** `listToc` as separate resource; highlight decision stays in UI layer (`syncTocHighlight`); `official-docs` does not embed `pathInTOC` flag in the page response — correct separation.
- **Wire contract stability (ADR-B2-001):** No destructive rename. `shared-types` retains `OfficialDocsPage` / `OfficialDocsPageNotice` / `OfficialDocsToc`. Traceable to FR-B2-4.3.
- **Coverage floor:** Three named files at ≥95% branch coverage via `bun run check` — traceable to NFR-B2-1, FR-B2-5.1, US-B2-03 AC.
- **Extension-only Must surface (ADR-B2-003):** Consistent with NFR-B2-3 and all story Surface clauses.
- **ADR quality:** All three Q6=D ADRs have context, options, trade-offs, recommendation, decision, consequences, and rejected alternatives.
- **Story coverage:** US-B2-01 (all six GWT cases), US-B2-02, US-B2-03, US-B2-S1 — all fully traceable.

### Observations (non-blocking, carried forward)

- **Stale codekb:** `architecture.md` / `component-inventory.md` still at pre-Bolt-1 HEAD `7148a19`. The design's file-level assumptions are unverified against post-Bolt-1 codebase. Refresh after PR #26 merged removes this uncertainty for future intents.
- **`sourceVersion` definition:** Inherited from Bolt 1 AD. Acceptable; if Bolt 1 AD does not define it, add a one-line definition before Functional Design.
