# Wireframes — Docs i18n Bolt 2（低忠実度）

> ステージ: rough-mockups (Ideation 1.6) / 作成日: 2026-08-01  
> 根拠: [rough-mockups-questions.md](./rough-mockups-questions.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md)  
> デザイン前提: 既存 AIDLC Guide 拡張の見た目・コンポーネントを踏襲（Q4 = A）。新規デザインシステムなし。  
> 表示面: **VS Code / Cursor 拡張 Webview のみ**（Q5 = A）。ブラウザ副経路は本 intent 対象外。

## Information Architecture（画面一覧）

Bolt 2 は新規画面を追加しない。既存 W1（Docs Shell）の **locale 切替・未訳 notice・アンカー挙動** を完成させる。

| ID | 画面 | 役割 | スコープ |
|----|------|------|----------|
| W1 | Docs Shell（既存） | TOC + 本文 + 言語／版 | U3 (M1/M2/M3) |
| W2 | Locale Switch（W1 内・既存） | en ↔ ja、同一ページ維持 | U3 |
| W2a | **Untranslated Notice（W1 内・新規状態）** | `ja` 欠落時の notice + locale 維持 | U3 (M2) |
| W2b | **Anchor Fallback（W1 内・新規挙動）** | 欠落アンカー時のページ先頭フォールバック | U3 (M3) |

## W1 — Docs Shell（主画面・既存）

Bolt 1 で確立済み。左 TOC + 右本文 + 上部に言語切替／版情報。

```text
+------------------------------------------------------------------+
| [AIDLC Docs]   locale: ( en | ja )   sourceVersion: vX.Y.Z      |  header
+------------------+-----------------------------------------------+
| TOC              |  # Page title                                 |
| > Guide          |                                               |
|   Getting started|  Body markdown…                               |
|   Workflow       |                                               |
| > Reference      |  ## Section                                   |
|   State machine  |  …                                            |
|   Scopes         |                                               |
|                  |                                               |
+------------------+-----------------------------------------------+
| status / focus hint (keyboard)                                   |  optional
+------------------------------------------------------------------+
```

**a11y:** h1 = ページタイトル；landmarks: `header`（locale+version）、`nav`（TOC）、`main`（本文）。キーボード入口: TOC 先頭リンク、または本文スキップリンク。

## W2 — Language switch（同一位置維持・既存）

Bolt 1 で確立済み。locale 変更時も同一ページ／可能な限り同一見出しアンカーを維持。

```text
Before:  locale=en   path=/guide/workflow#approval-gates
Action:  click [ja]
After:   locale=ja   path=/guide/workflow#approval-gates  (same slug/anchor)
```

**a11y:** 言語切替は `button` または `radiogroup`；現在 locale を `aria-current` / 可視ラベルで示す。切替後フォーカスは本文見出し付近に維持。

## W2a — Untranslated Notice（新規状態）

Q3 = D / Q6 = E / Q7 = C: 部分 `ja` が Must のため、未訳時の表示を固定する。

```text
locale=ja   path=/guide/workflow#approval-gates
ja file missing for this path
→ show EN body at same path/anchor
→ visible notice in main (not color-only):
   "日本語訳はまだありません — 英語を表示しています"
→ locale control stays on [ja] (user intent preserved)
→ TOC の未訳ページは任意の弱い印（後段でも可；本文 notice が必須）
```

**a11y:** 未訳 notice は `main` 内で `role="status"`（または同等の live 領域）とし、スクリーンリーダーに伝わること。色だけに依存しない（色+記号+ラベル）。

## W2b — Anchor Fallback（新規挙動）

Q1 = C / Q6 = E: 欠落アンカー時のフォールバックを固定する。

```text
locale=ja   path=/guide/workflow#nonexistent-anchor
anchor not found in rendered page
→ scroll to page top (h1)
→ no error UI; graceful degradation
```

**a11y:** フォールバック後フォーカスはページ先頭（h1）に移動。エラー表示は不要（静かにフォールバック）。

## Design Constraints（要約）

- 既存拡張コンポーネント踏襲（Q4 = A）
- 拡張 Webview のみ（Q5 = A）。ブラウザ Dashboard は非対象
- a11y: 未訳 notice は `role=status`、locale 維持、フォーカス管理、色+記号+ラベル（Q6 = E）
- エントリ: 専用 Docs ビュー／コマンド + 拡張内深リンク（親 intent 継承）

## Review

**Reviewer:** aidlc-product-lead-agent  
**Date:** 2026-08-01  
**Verdict:** PENDING
