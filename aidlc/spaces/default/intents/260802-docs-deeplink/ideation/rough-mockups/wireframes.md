# Wireframes — Docs i18n Bolt 3（低忠実度）

> ステージ: rough-mockups (Ideation 1.6) / 作成日: 2026-08-02  
> 根拠: [rough-mockups-questions.md](./rough-mockups-questions.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md)  
> デザイン前提: 既存 StageCard / Docs Shell を延長（Q4 = A）。新規デザインシステムなし。  
> 表示面: **VS Code / Cursor 拡張 Webview のみ**（Q5 = A）。

## Information Architecture（画面一覧）

Bolt 3 は新規フル画面を追加しない。既存 StageCard の docs リンクと既存 Docs Shell の **深リンク着地** を完成させる。

| ID | 画面 | 役割 | スコープ |
|----|------|------|----------|
| W1 | StageCard（既存） | ステージ説明 + OpenOfficialDocLink | U3 (M1/M2/M6) |
| W2 | Docs Shell（既存） | TOC + 本文 + locale；deep-link 着地 | U4 (M3/M4/M5) |
| W1a | **OpenOfficialDocLink（W1 内・置換）** | ラベル付きリンク → openOfficialDoc | U3 |
| W2a | **Deep-link land（W2 内・延長）** | `{locale,path,anchor?}` 適用 / unmapped→top | U4 |

## W1 — StageCard + OpenOfficialDocLink

```text
+--------------------------------------------------+
| StageCard: Intent Capture                        |
| 目的 / 入力 / 出力 / エージェント / ゲート         |
|                                                  |
| [ Docs: Intent Capture ]   ← not bare "Docs"     |
| （sync: …）                                       |
+--------------------------------------------------+
```

**挙動:** クリック → ホスト openOfficialDoc `{locale, path, anchor?}`。マップ済みは外部ブラウザを開かない（Q6 = C / Q7 = C）。未マップは path なしで Shell top（W2a）。

**a11y:**
- **見出し:** StageCard 区画は既存カードの `h2`/`CardTitle` 階層を継承（リンク自体は見出しにしない）
- **landmarks:** リンクは StageCard の `article`/`section` 内；Dashboard 本体の `main` 配下
- **キーボード入口:** Tab でリンクに到達 → Enter/Space で活性化（Webview 標準フォーカス順）
- リンクテキストはステージが分かる（Q3 = B / Q6 = A）。色だけに依存しない。

## W2 — Docs Shell（着地先・既存）

Bolt 1/2 で確立済み。Bolt 3 は deep-link 適用のみ追加。

```text
+------------------------------------------------------------------+
| [AIDLC Docs]   locale: ( en | ja )   sourceVersion: vX.Y.Z      |
+------------------+-----------------------------------------------+
| TOC              |  # Page title  (± scroll to #anchor)          |
| …                |  Body…                                        |
+------------------+-----------------------------------------------+
```

## W2a — Deep-link land

```text
Mapped:
  payload { locale, path, anchor? }
  → open Shell, set locale, select path, scroll/focus anchor if present
  → consume one-shot target

Unmapped:
  → open Shell at top (no path; no external browser)
```

**a11y:**
- **見出し:** 着地後のページタイトルは `h1`；アンカー先は既存 Markdown の `h2`/`h3`
- **landmarks:** Docs Shell の `header`（locale+version）・`nav`（TOC）・`main`（本文）を継承
- **キーボード入口:** Shell オープン後フォーカスは `main` 内の着地見出し（または `h1`）；Tab で TOC / locale 制御へ
- `anchor` があり見出しが存在すればそこへフォーカス／スクロール；なければページ先頭（Q6 = B）。欠落アンカーは Bolt 2 先例どおり top。

## Design Constraints（要約）

- 既存拡張コンポーネント踏襲（Q4 = A）
- 拡張 Webview のみ（Q5 = A）
- bare `Docs` 禁止；外部ブラウザ禁止（マップ経路）
- レガシー `docsOpenHref` / IDE open はマップ経路で置換（Q7 = C）

## Review

**Reviewer:** aidlc-product-lead-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

**Findings (resolved):** F-1 a11y structure on W1a/W2a — fixed (heading / landmarks / keyboard entry). DoD M1–M6 traceable; mapped/unmapped flows present; out-of-scope explicit. No remaining blockers.
