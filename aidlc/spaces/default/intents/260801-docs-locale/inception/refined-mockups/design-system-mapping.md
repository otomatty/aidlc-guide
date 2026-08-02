# Design System Mapping — Docs i18n Bolt 2

> ステージ: refined-mockups / 2026-08-01  
> 方針: Q5 = A — 既存 dashboard / Docs Shell を踏襲。新規デザインシステムなし。  
> 上流: [mockups.md](./mockups.md) · [wireframes.md](../../ideation/rough-mockups/wireframes.md) · [requirements.md](../requirements-analysis/requirements.md)

## Existing surfaces (reuse)

| UI need | Existing module / pattern | Bolt 2 change |
|---------|---------------------------|---------------|
| Docs Shell layout | `packages/dashboard` DocsShell | 状態分岐の完成のみ |
| Locale control | Docs Shell header controls | keep-path + localeRequested 表示の契約遵守 |
| Untranslated notice | `UntranslatedNotice` + `Alert` (`role=status`) | 配置・静的・wire 契約の固定（破壊的リネーム禁止） |
| Markdown body | viewer / lazy-markdown | 変更なし（en フォールバック本文を表示） |
| TOC | official-docs TOC API + nav | 非対称 TOC 選択ルール |
| Tokens / typography | 既存 shadcn / host CSS variables | 新規トークンなし |

## Mapping: story → component

| Story | Components |
|-------|------------|
| US-B2-01 | LocaleControl, TocSelection, AnchorFocus, DocsShell |
| US-B2-02 | UntranslatedNotice, LocaleControl, DocsShell |
| US-B2-S1 | Markdown / title → `h1`（Should） |

## Explicit non-goals

- 新規カラーシステム・タイポスケール
- ブラウザ / Mob 専用レイアウト（NFR-B2-3）
- TOC 未訳バッジ（Q1 = A で除外）
- dismiss 付き notice（Q2 = A）

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY — see mockups Review.  
**Date:** 2026-08-01

**What holds:** Q5 = A honored (reuse dashboard/Docs Shell/UntranslatedNotice+Alert); story→component map complete; explicit non-goals exclude TOC badge, dismiss notice, browser/Mob layouts.
