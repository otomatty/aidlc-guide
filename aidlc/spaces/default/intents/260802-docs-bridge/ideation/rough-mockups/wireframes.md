# Wireframes — Docs i18n Bolt 4（低忠実度）

> ステージ: rough-mockups (Ideation 1.6) / 作成日: 2026-08-03  
> 根拠: [rough-mockups-questions.md](./rough-mockups-questions.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md)  
> デザイン前提: 既存 Legacy Bridge / Docs Shell を延長（Q4 = A）。新規デザインシステムなし。  
> 表示面: **VS Code / Cursor 拡張 Webview のみ**（Q5 = A）。

## Information Architecture（画面一覧）

Bolt 4 は新規フル画面を追加しない。Legacy Bridge を **導線に縮退**し、正本は Docs Shell に寄せる（intent-statement US-06 / scope M1–M3）。

| ID | 画面 | 役割 | スコープ |
|----|------|------|----------|
| W1 | Legacy Bridge パネル（既存・縮退） | 導線 + Open in Docs primary | U1, U2 (M1, M2) |
| W1a | **Open in Docs CTA（W1 内）** | primary → `openOfficialDoc` | U2 (M2) |
| W1b | 短い説明／導線文言（W1 内） | excerpt 正本の代替ではない | Q3=A |
| W1c | glossary / 補助（Should） | 残可・Must 失敗にしない | U4 (S1) / Q7=A |
| W2 | Docs Shell（既存・Bolt 3 着地） | 正本閲覧 | U3 (M3) Demo 着地 |

**禁止（W1）:** excerpt を記事本文としてマウントする（Q2=C / Q6=C / scope M1）。

## W1 — Legacy Bridge（degrade 後）

```text
+--------------------------------------------------+
| Legacy Bridge                                    |
|                                                  |
|  [ Open in Docs ]   ← primary CTA (text button)  |
|                                                  |
|  Short guidance:                                 |
|  "正本は同梱 Docs です。Open in Docs で開きます。" |
|                                                  |
|  (optional Should) glossary / 補助               |
|  ※ excerpt 記事マウントなし                       |
+--------------------------------------------------+
```

**挙動:** Open in Docs → ホスト `openOfficialDoc`（Bolt 3 契約再利用）→ Docs Shell（W2）。外部ブラウザを開かない（Q6=D）。

**a11y:**
- **見出し:** Bridge 区画は既存カード／パネルの見出し階層を継承；CTA 自体は見出しにしない
- **landmarks:** Dashboard `main` 配下の Bridge パネル内
- **キーボード入口:** Tab で Open in Docs に到達 → Enter/Space で活性化
- CTA は明確なテキスト。色だけに依存しない（Q6=A）
- excerpt 非マウントにより、スクリーンリーダーが Bridge を正本記事と誤認しない（Q6=C）

## W1a — Open in Docs（primary）

```text
Before (anti-pattern):
  [excerpt mounted as article]
  [ secondary: Open in Docs ]

After (Must):
  [ Open in Docs ]  ← sole primary action
  [short guidance]
  [optional Should aids]
```

## W2 — Docs Shell（着地先・既存）

Bolt 3 で確立済み。Bolt 4 は着地契約を再利用するだけ（Q6=B）。

```text
+------------------------------------------------------------------+
| [AIDLC Docs]   locale: ( en | ja )   sourceVersion: vX.Y.Z      |
+------------------+-----------------------------------------------+
| TOC              |  # Page title                                 |
| …                |  Body…                                        |
+------------------+-----------------------------------------------+
```

**a11y:** Shell の `header` / `nav` / `main` とフォーカス／アンカー契約を継承（Q6=B）。

## Design Constraints（要約）

- 既存拡張コンポーネント踏襲（Q4 = A）
- 拡張 Webview のみ（Q5 = A）
- Open in Docs primary + excerpt 非マウント（Q2 = C / Q3 = A）
- US-09 補助は Should（Q7 = A）— ワイヤー Must の失敗条件にしない
- intent-backlog Won't: B3 再実装 / B5 / locale 再実装 / ターミナル注入

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY  
**Date:** 2026-08-03  
**Note:** Subagent dispatch hit API limit; review executed inline against the same product-lead checklist.

### What holds

- Q1–Q7 map cleanly to W1/W1a/W2 and Flow A; anti-flow matches Q2=C (excerpt mount forbidden).
- scope-document M1–M3 covered (non-mount, primary CTA, Demo); S1/US-09 kept Should (Q7=A) and not a Must-fail on wires.
- intent-backlog U1→U2→U3 traced in user-flow; Won't (B3/B5/locale/inject) listed as non-goals.
- Per-screen a11y notes present (heading / landmarks / keyboard) for W1 and W2.
- Surface limited to extension Webview (Q5=A); reuses Bolt 3 `openOfficialDoc` — no parallel landing path.

### Findings

None blocking. Functional Design should still lock final CTA copy and message type (intent Assumption / open from feasibility).
