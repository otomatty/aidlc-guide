# Components — Docs i18n Bolt 4

> ステージ: application-design / 2026-08-03  
> Intent: `260802-docs-bridge`  
> 計画: Q1–Q4 = A / Q5 = D（Looks correct）  
> 上流: [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [architecture.md](../../../codekb/aidlc-guide/architecture.md) · [component-inventory.md](../../../codekb/aidlc-guide/component-inventory.md) · [team-practices.md](../practices-discovery/team-practices.md)  
> 親 AD: Bolt 1–3 — **再仕様化しない**。本ファイルは Bolt 4 差分のみ。

## Design intent

Bolt 3 まで `open-official-doc` → Docs Shell は成立。Bolt 4 は **Legacy Bridge / StageCard の excerpt 正本体験をやめ、Open in Docs を primary にして既存 host 契約を再利用する**。新パッケージなし。クラウド / AWS なし（Q4=A）。

## Changed components (delta)

| Component | npm / location | Bolt 4 delta | Owns |
|-----------|----------------|--------------|------|
| **dashboard** | `@aidlc-guide/dashboard` | StageCard / Bridge: excerpt 非マウント；Open in Docs primary CTA → emit `open-official-doc` | UI 契約（FR-B4-1/2） |
| **vscode-extension** | `aidlc-guide` | 既存 `open-official-doc` ハンドラを **再利用**（変更最小／回帰のみ） | Host 着地 |

## Unchanged / out of Bolt 4 Must

| Component | Note |
|-----------|------|
| official-docs / api-core | 変更なし（着地再利用） |
| docs-bridge | excerpt API 削除は Must でない（Q3=A） |
| reader-core / shared-types | 変更なし（既存 wire 型で足りる） |
| dashboard-server / mcp-server | Fail 条件にしない |
| AWS / cloud | N/A |

## Boundaries

```text
StageCard / Legacy Bridge (dashboard)
  │  NO excerpt mount
  │  primary CTA Open in Docs
  │ postMessage open-official-doc {locale, path?, anchor?}
  ▼
vscode-extension (existing handler)
  │
  ▼
DocsShell (dashboard) ── Bolt 3 one-shot land

dashboard ✗ new packages
dashboard ✗ parallel landing types
```

## Story coverage

| Story | Components |
|-------|------------|
| US-B4-01 | dashboard (render) |
| US-B4-02 | dashboard emit + vscode-extension handler |
| US-B4-03 | tests across dashboard (+ host spy as needed) |
| US-B4-S1 | dashboard optional aids |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-03  
**Note:** Inline review (Task API limit). Thin brownfield delta; layering preserved.
