# Wireframes — Docs i18n（低忠実度）

> ステージ: rough-mockups (Ideation 1.6) / 作成日: 2026-07-31  
> 根拠: [rough-mockups-questions.md](./rough-mockups-questions.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md)  
> デザイン前提: 既存 AIDLC Guide 拡張の見た目・コンポーネントを踏襲（Q4 = A）。新規デザインシステムなし。  
> 表示面: **VS Code / Cursor 拡張 Webview のみ**（Q5 = A）。ブラウザ副経路は本 intent 対象外。Dashboard / StageCard は拡張内 Webview を指す。

## Information Architecture（画面一覧）

| ID | 画面 | 役割 | スコープ |
|----|------|------|----------|
| W1 | Docs Shell | TOC + 本文 + 言語／版 | U2 (M1/M2) |
| W2 | Locale Switch（W1 内） | en ↔ ja、同一ページ維持 | U2 / Q7 = A |
| W3 | Deep-link Landing | StageCard 等から着地した Docs | U3 (M4) |
| W4 | Bridge Redirect | 旧抜粋 UI の縮退・誘導 | U4 (M6) |
| W5 | Workflow Dashboard（既存） | StageCard → docs への出口のみ（本 intent はリンク追加） | U3 |

## W1 — Docs Shell（主画面）

Q3 = A: 左 TOC + 右本文 + 上部に言語切替／版情報。

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

## W2 — Language switch（同一位置維持）

Q7 = A: locale 変更時も同一ページ／可能な限り同一見出しアンカーを維持。

```text
Before:  locale=en   path=/guide/workflow#approval-gates
Action:  click [ja]
After:   locale=ja   path=/guide/workflow#approval-gates  (same slug/anchor)
```

**未訳ページ状態（MVP 確定 — scope は部分 ja）:** Q7 はアンカー維持のみ指定。部分 ja が Must のため、未訳時の表示を次で固定する。

```text
locale=ja   path=/guide/workflow#approval-gates
ja file missing for this path
→ show EN body at same path/anchor
→ visible notice in main (not color-only):
   "日本語訳はまだありません — 英語を表示しています"
→ locale control stays on [ja] (user intent preserved)
→ TOC の未訳ページは任意の弱い印（後段でも可；本文 notice が必須）
```

**a11y:** 言語切替は `button` または `radiogroup`；現在 locale を `aria-current` / 可視ラベルで示す。切替後フォーカスは本文見出し付近に維持。未訳 notice は `main` 内で `role="status"`（または同等の live 領域）とし、スクリーンリーダーに伝わること。

## W3 — Deep-link landing（副フロー着地）

Q1 = B / Q2 = C 副フロー。拡張内 Dashboard の StageCard から docs アンカーへ。

```text
Dashboard (existing webview)          Docs Shell (W1)
+-------------------------+           +---------------------------+
| Stage: intent-capture   |  click    | TOC highlights target     |
| [Open related docs] ----+---------->| main scrolls to anchor    |
+-------------------------+           | locale = last used / en   |
                                      +---------------------------+
```

**a11y:** 着地後 `main` 内の対象見出しへフォーカス移動（または `aria-live` で着地通知）。h1/h2 は着地ページの階層に従う。

## W4 — Bridge redirect（縮退）

Q5 によりブラウザは対象外。旧 Docs Bridge 抜粋が拡張内に残る場合の縮退。

```text
+------------------------------------------+
| Previously: excerpt + external link      |
| Now:                                     |
|  Short note: "Full docs are bundled."    |
|  [Open in Docs]  -->  W1 (canonical)     |
|  (optional) term/nav from bridge-map     |
+------------------------------------------+
```

**a11y:** h2 = 誘導見出し（例: 「公式ドキュメントは拡張内へ」）；landmark: `main`（リダイレクトパネル）。キーボード入口: `[Open in Docs]` リンク／ボタン。色だけに依存しない（色+記号+ラベル）。

## W5 — Dashboard exit affordance（差分のみ）

本 intent は Dashboard 全体を再デザインしない。StageCard（または Next 導線付近）に「関連 docs」リンクを足すだけ。

```text
+---------------------------+
| Now: intent-capture   [?] |
| Next: feasibility         |
| …                         |
| [Docs: Intent Capture]    |  <-- new
+---------------------------+
```

**a11y:** 見出しレベルは親 StageCard の既存階層に従う（新規 h1 は作らない；リンクはカード内の通常フォーカス順）。landmark: 既存 Dashboard の `main`（またはカード領域）。キーボード入口: `[Docs: Intent Capture]` リンク（目的ページが分かる文言。「Docs」単独禁止）。

## Design Constraints（要約）

- 既存拡張コンポーネント踏襲（Q4 = A）
- 拡張 Webview のみ（Q5 = A + 注記）。ブラウザ Dashboard は非対象
- a11y 初期: 既存拡張と同水準；WCAG 2.1 AA は後段（Q6 = A）
- エントリ: 専用 Docs ビュー／コマンド + 拡張内深リンク（Q1 = A,B）。Bridge 誘導は補助（Q1 で C 未選択）

## Review

**Reviewer:** aidlc-product-lead-agent  
**Date:** 2026-07-31  
**Verdict:** READY

### Prior NOT-READY Findings — Re-verification

**Fix 1 — W2 missing-ja state (PASS)**  
W2 now fully defines the untranslated-page state: `locale=ja`, ja file absent → show EN body at same path/anchor, visible non-color-only notice `"日本語訳はまだありません — 英語を表示しています"` in `main`, locale control stays on `[ja]`. All four required behaviours are present and testable.

**Fix 2 — W4/W5 a11y notes (PASS)**  
W4 a11y: h2 heading stated, `main` landmark named, keyboard entry `[Open in Docs]` explicit, color-only prohibition noted. W5 a11y: heading level defers to parent StageCard hierarchy (no new h1, which is correct for a diff-only addition), `main`/card landmark named, keyboard entry `[Docs: Intent Capture]` named with accessible-text guidance. All three required elements (heading level, landmark, keyboard entry) are present in both.

**Fix 3 — user-flow Flow vs Backlog / U5 (PASS)**  
`user-flow.md` Flow vs Backlog table row `— | U5（手動翻訳 PR）は git/GitHub 運用 — Webview 画面なし（意図的省略）` is present. The deliberate omission is documented and justified.

### Adversarial Sweep

**Observation (non-blocking): Minor wording tension between artifacts on notice mandatory-status.**  
`wireframes.md` W2 states `本文 notice が必須` (body notice is mandatory). `user-flow.md` Non-goals lists `未訳ページの必須バナー（Q7 = A のみ；後段任意）` under "Non-goals in these flows," which could be read as treating the notice as optional. Reading both artifacts together: `wireframes.md` is the primary UI specification and is unambiguous — the notice is mandatory. The `user-flow.md` non-goals statement is most accurately read as "no separate flow diagram is needed for the banner scenario," not "the banner is optional." A developer building W2 from `wireframes.md` will include it. This ambiguity does not block engineering but the lead should align the wording in a future pass (e.g. change `user-flow.md` non-goal to `"独立したフロー図は不要（W2 の状態として wireframes.md で定義済み）"`).

**W3 a11y completeness:** Heading (`h1/h2 は着地ページの階層に従う`), landmark (`main`), and focus management as keyboard entry (focus moved to target heading on landing) are all present. Passes.

**Upstream coverage:** intent-statement, scope-document, intent-backlog all referenced in frontmatter and prose. Required-sections: seven H2 headings present. Both sensors would pass.

**Scope / traceability:** All five screens (W1–W5) trace to backlog IDs (U1–U4) and scope Must IDs (M1–M6). U5 absence is explained. No orphaned screens; no screen without a backlog anchor.

**Q7=A vs designed missing-ja behaviour:** Q7 answer was A only (anchor preservation). `wireframes.md` correctly identifies that partial-ja (scope M2) creates an untranslated-page scenario Q7 didn't address, and fills the gap explicitly. This is a proactive design decision, not scope creep — it is directly required by M2.

### Summary

All three prior NOT-READY findings are resolved. The one new observation (non-goals wording tension) is a documentation clarity note, not a blocking defect — `wireframes.md` as the UI spec is unambiguous on implementer intent. Engineering can start without returning to ask questions.

**READY**
