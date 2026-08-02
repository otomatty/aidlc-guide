# User Flow — Docs i18n Bolt 2

> ステージ: rough-mockups (Ideation 1.6) / 作成日: 2026-08-01  
> 根拠: [rough-mockups-questions.md](./rough-mockups-questions.md) / [wireframes.md](./wireframes.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md)  
> Q2 = C: 親 intent の Flow A を部分 `ja` 対応に拡張。新規フローは追加しない。

## Primary Flow A — Browse & switch locale（S-docs-1・部分 `ja` 対応）

初学者が拡張から公式相当 docs を開き、言語を切り替えて読み続ける。部分 `ja` でも迷わない。

```text
[Command Palette / Docs view]
        │
        ▼
   Open Docs Shell (W1)
        │
        ▼
   Pick page in TOC ──────────────┐
        │                         │
        ▼                         │
   Read body (en or last locale)  │
        │                         │
        ▼                         │
   Switch locale (W2)             │
   keep path + anchor             │
        │                         │
        ├─► ja available? ──► Continue reading (ja)
        │                         │
        ├─► ja missing? ────► Show EN body        │
        │                     + notice (W2a)      │
        │                     locale stays [ja]   │
        │                         │               │
        ▼                         ▼               │
   Continue reading ◄─────────────┘               │
        │                                         │
        ▼                                         │
   Click anchor link ──► anchor exists? ──► Jump to anchor
        │                                         │
        └─► anchor missing? ──► Fallback to top (W2b)
```

**成功条件:** 同一 TOC／スタイルで en↔ja を切り替え、`ja` 欠落時も locale を `ja` のまま維持し、未訳 notice で明示される（intent S-docs-1 / scope Q1 = D）。

## Flow vs Backlog

| Flow | proto-Units |
|------|-------------|
| A | U1（official-docs 分岐）→ U2（api-core）→ U3（dashboard UI） |
| — | U4（coverage 床）は CI 品質ゲート — Webview 画面なし（意図的省略） |
| — | U5（h1 修正）は Should — 本フローに影響なし |

## Non-goals in these flows

- ブラウザ専用 Dashboard 経路（Q5 = A）
- 機械翻訳の自動同梱（scope O5）
- 未訳ページ専用の別フロー図（W2a の状態として wireframes.md で定義済み・本文 notice 必須）
- StageCard 深リンク（B3 / #29）
- Bridge 縮退（B4 / #30）
- upstream 差分レポート（B5 / #31）
