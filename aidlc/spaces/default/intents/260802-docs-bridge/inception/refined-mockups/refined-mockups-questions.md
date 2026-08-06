# Refined Mockups — 質問ファイル

> ステージ: refined-mockups (Inception) / 深度: Standard  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4** / Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)）  
> 上流: [wireframes.md](../../ideation/rough-mockups/wireframes.md) / [user-flow.md](../../ideation/rough-mockups/user-flow.md) / [stories.md](../user-stories/stories.md) / [requirements.md](../requirements-analysis/requirements.md)  
> 前提: 新規フル画面なし。W1 Bridge degrade + W1a Open in Docs + W2 Shell 着地を mid-fi に固定。  
> **Mode:** Guide Me（推奨適用）

---

## Q1. Bridge パネル構成（degrade 後）

W1 の情報階層はどれですか？

- A. 1) Open in Docs（primary） 2) 短い導線文言 3) 任意 Should 補助。excerpt 領域なし
- B. excerpt を折りたたみで残し、Open in Docs を二次にする
- C. Open in Docs のみ（文言・補助なし）
- X. その他（具体的に記入）

[Answer]: A

## Q2. Open in Docs の文言（ピン留め候補）

accessible name / 可視ラベルの候補はどれですか？（FD でも再確認可）

- A. `Open in Docs`（英語 UI 既定。locale は Docs Shell 側）
- B. `Docs で開く`（日本語固定）
- C. A を既定とし、FD で最終確定（本ステージは A を仮ピン）
- X. その他（具体的に記入）

[Answer]: C

## Q3. CTA のコントロール種別

primary CTA の UI 種別はどれですか？

- A. 既存 dashboard の primary Button（既存 DS）
- B. テキストリンクのみ
- C. 新規デザインの特大ヒーローボタン
- X. その他（具体的に記入）

[Answer]: A

## Q4. 画面状態（Bridge）

Bolt 4 で明示する Bridge 状態はどれですか？（select all that apply）

- A. ready-degraded（excerpt なし + primary CTA）
- B. activating（CTA 押下後・Shell オープン待ちの短い busy — 任意）
- C. error（host が open-official-doc を拒否 — 既存エラー表示を継承してよい）
- D. A〜C（B は任意・Must 失敗にしない）
- X. その他（具体的に記入）

[Answer]: D

## Q5. デザインシステム

- A. 既存 dashboard / Bridge / Docs Shell を踏襲。新規 DS なし
- B. Bridge 専用の新デザイン言語を導入
- X. その他（具体的に記入）

[Answer]: A

## Q6. アクセシビリティ目標

- A. WCAG 2.2 AA 相当を対象範囲に限定（CTA 名明確・色だけに依存しない・キーボード到達・excerpt 非マウント）
- B. AAA を Must
- X. その他（具体的に記入）

[Answer]: A

## Q7. Docs Shell 着地

Bolt 4 で Shell 側の mid-fi 変更はどれですか？

- A. 変更なし — Bolt 3 着地契約をそのまま再利用（W2 は参照のみ）
- B. Shell レイアウトを Bolt 4 で再設計する
- X. その他（具体的に記入）

[Answer]: A

## Q8. US-09 補助の描画

- A. Should — mid-fi に任意枠として描くが Must 失敗にしない
- B. mid-fi から完全除外
- C. Must 画面として詳細に描く
- X. その他（具体的に記入）

[Answer]: A

---

## Consolidated Summary

| Q | Answer | Decision |
|---|--------|----------|
| Q1 | A | CTA → 文言 → 任意補助；excerpt なし |
| Q2 | C | `Open in Docs` 仮ピン → FD 最終確定 |
| Q3 | A | 既存 primary Button |
| Q4 | D | ready-degraded + 任意 activating + error |
| Q5 | A | 既存 DS |
| Q6 | A | WCAG 2.2 AA スコープ限定 |
| Q7 | A | Shell 変更なし |
| Q8 | A | US-09 任意枠 |

Looks correct / Request changes?

- Looks correct
- Request changes

[Answer]: Looks correct
