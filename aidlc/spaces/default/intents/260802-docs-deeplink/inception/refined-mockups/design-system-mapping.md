# Design System Mapping — Docs i18n Bolt 3

> ステージ: refined-mockups / 2026-08-02  
> 方針: Q4 = A — 既存 StageCard / Docs Shell を踏襲。新規デザインシステムなし。  
> 上流: [mockups.md](./mockups.md) · [wireframes.md](../../ideation/rough-mockups/wireframes.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md)

## Existing surfaces (reuse)

| UI need | Existing module / pattern | Bolt 3 change |
|---------|---------------------------|---------------|
| StageCard | `packages/dashboard` StageCard | Replace legacy docs open with OpenOfficialDocLink |
| Docs link label | StageCard DocsLink / equivalent | Stage-named accessible name（US-B3-02） |
| Docs Shell layout | DocsShell | Consume deep-link with locale（FR-B3-4） |
| Locale control | Docs Shell header | Apply payload.locale on land |
| Anchor apply | `packages/dashboard/src/components/docs-shell/AnchorApplier.tsx` + store `docsShellDeepLink` | Reuse for mapped land（locale field may extend deep-link target in Construction） |
| STAGE_DOC_MAP | `packages/official-docs` | Consume via allowed boundary（no dashboard→official-docs import） |
| Tokens / typography | 既存 shadcn / host CSS variables | 新規トークンなし |

## Mapping: story → component

| Story | Components |
|-------|------------|
| US-B3-01 | OpenOfficialDocLink, host handler, DocsShellDeepLinkLand |
| US-B3-02 | OpenOfficialDocLink（label） |
| US-B3-03 | OpenOfficialDocLink（unmapped payload）, DocsShell top |
| US-B3-04 | STAGE_DOC_MAP（non-UI） |
| US-B3-05 | OpenOfficialDocLink（negative: no legacy open） |
| US-B3-06 | tests + demo-record（non-UI） |

## Explicit non-goals

- 新規カラーシステム・タイポスケール・モーダル確認ダイアログ  
- ブラウザ / Mob 専用レイアウト（NFR-B3-2 / Q6=A）  
- Bridge / keep-path / missing_ja UI 再設計  
- 7-slug 以外の map UI

## Review

**Reviewer:** aidlc-product-lead-agent  
**Date:** 2026-08-02  
**See:** mockups.md `## Review` for full verdict (NOT-READY).

**Finding in this file:**

- **F3 (LOW)** "Anchor apply | Bolt 2 AnchorApplier precedent — Reuse for mapped land" — informal name; no package or file path. A developer inheriting Bolt 3 cannot locate the module. Pin as `packages/<pkg>/path/to/file` or note "→ Functional Design resolves module name."
