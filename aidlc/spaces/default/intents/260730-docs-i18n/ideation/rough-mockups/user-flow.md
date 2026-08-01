# User Flow — Docs i18n

> ステージ: rough-mockups (Ideation 1.6) / 作成日: 2026-07-31  
> 根拠: [rough-mockups-questions.md](./rough-mockups-questions.md) / [wireframes.md](./wireframes.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md)  
> Q2 = C: 主フロー A と副フロー B の両方を描く。

## Primary Flow A — Browse & switch locale（S-docs-1）

初学者が拡張から公式相当 docs を開き、言語を切り替えて読み続ける。

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
        ▼                         │
   Continue reading ◄─────────────┘
```

**成功条件:** 同一 TOC／スタイルで en↔ja を切り替え、オフラインで読める（intent S-docs-1 / scope Q1 = B）。

## Secondary Flow B — Context jump from workflow

ドライバーまたは学習者が、拡張内 Dashboard の StageCard から関連 docs に飛び、読後にワークフローへ戻る。

```text
[Extension Dashboard Webview]
        │
        ▼
   StageCard / related-docs link (W5)
        │
        ▼
   Deep-link landing (W3) → Docs Shell at anchor
        │
        ├─► optional locale switch (W2)
        │
        ▼
   Read
        │
        ▼
   Back to Dashboard (editor tab / command)
```

**成功条件:** 外部ブラウザなしで、現在ステージ文脈の docs に着地できる（scope M4）。Q5 によりブラウザ副経路は使わない。

## Supporting Flow C — Bridge redirect（縮退）

旧抜粋 UI に残った導線から正本（同梱 Docs）へ。

```text
[Legacy Bridge excerpt UI]
        │
        ▼
   Redirect panel (W4)
        │
        ▼
   Open Docs Shell (W1)  = canonical body
```

Q1 で C は主入口に含めなかったため、Must の導線は A/B。本フローは scope M6 の縮退を可視化する補助。

## Flow vs Backlog

| Flow | proto-Units |
|------|-------------|
| A | U1（コンテンツ）→ U2 |
| B | U2 → U3 |
| C | U4 |
| — | **U5**（手動翻訳 PR）は git/GitHub 運用 — Webview 画面なし（意図的省略） |

## Non-goals in these flows

- ブラウザ専用 Dashboard 経路（Q5 注記）
- 機械翻訳の自動同梱（scope O1）
- 未訳ページ専用の別フロー図（W2 の状態として wireframes.md で定義済み・本文 notice 必須）
