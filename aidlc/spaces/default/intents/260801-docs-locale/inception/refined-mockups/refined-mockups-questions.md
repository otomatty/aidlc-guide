# Refined Mockups — 質問ファイル

> ステージ: refined-mockups (Inception) / 深度: Standard  
> Intent: `260801-docs-locale`（docs-i18n **Bolt 2**）  
> 上流: [wireframes.md](../../ideation/rough-mockups/wireframes.md) / [user-flow.md](../../ideation/rough-mockups/user-flow.md) / [stories.md](../user-stories/stories.md) / [requirements.md](../requirements-analysis/requirements.md)  
> 前提: 新規画面なし。既存 Docs Shell（W1）の locale / notice / anchor を mid-fi に落とす。表示面は拡張 Webview のみ（NFR-B2-3）。  
> 各質問の `[Answer]:` に選択肢の文字または自由記述を記入してください。  
> **Mode:** guided（推奨セット一括採用）

---

## Q1. Untranslated notice の配置

W2a の notice を Docs Shell のどこに置きますか？

- A. `main` 内・本文（h1）の直下（wireframes どおり）。TOC には出さない
- B. `main` 内・本文直下 + TOC 該当項目に弱い未訳印（両方）
- C. ヘッダ（locale コントロール付近）のみ
- X. その他（具体的に記入）

[Answer]: A

## Q2. Notice の dismiss

FR-B2-2.5 / US-B2-02 どおり dismiss 永続化は不要です。UI はどうしますか？

- A. 閉じられない静的バナー（dismiss コントロールなし）
- B. 閉じられるが、同一セッション再訪で再表示してよい
- X. その他（具体的に記入）

[Answer]: A

## Q3. Locale 切替後のフォーカス

keep-path / anchor 後のフォーカス先はどれですか？

- A. `anchorApplied=scrolled` → 該当見出し。`top` / 未訳 → ページ h1（または main 先頭）。locale コントロールには戻さない
- B. 常に locale コントロールに戻す
- C. フォーカス移動なし（スクロールのみ）
- X. その他（具体的に記入）

[Answer]: A

## Q4. 画面状態（Docs Shell）

Bolt 2 で明示する状態セットはどれですか？（select all that apply）

- A. loading（本文取得中）
- B. ready（本文表示）
- C. missing_ja（en 本文 + notice + locale=ja）
- D. not_found（en にも無い path — 既存エラー扱いを継承）
- E. A〜D すべて
- X. その他（具体的に記入）

[Answer]: E

## Q5. デザインシステム

コンポーネント方針はどれですか？

- A. 既存 dashboard / Docs Shell コンポーネントを踏襲。新規 DS なし（rough Q4 = A）
- B. notice 用に新しいデザイン言語を導入する
- X. その他（具体的に記入）

[Answer]: A

## Q6. アクセシビリティ目標

Bolt 2 の a11y 目標はどれですか？

- A. WCAG 2.1 AA の該当箇所（notice live region、フォーカス、色非依存）を満たす。完全適合監査は後段でも可
- B. WCAG 2.1 AA 完全適合を Bolt 2 Must にする
- C. 親 NFR-7 レベルのみ（追加なし）
- X. その他（具体的に記入）

[Answer]: A

## Q7. レスポンシブ

拡張 Webview 内のレイアウト方針はどれですか？

- A. 既存 Docs Shell の TOC+本文スプリットを維持。狭い幅では既存フォールバックに従う（新規ブレークポイント定義なし）
- B. Bolt 2 でモバイル向けブレークポイントを新規定義する
- X. その他（具体的に記入）

[Answer]: A

## Q8. Should（h1）の mockup 扱い

FR-B2-S1 / US-B2-S1 を refined mockups でどう扱いますか？

- A. mockups / a11y checklist に Should として記載。Must 画面仕様の Fail 条件にはしない
- B. Must として全ページ図に必須描画する
- C. refined mockups から除外（Construction で任意）
- X. その他（具体的に記入）

[Answer]: A

---

## Consolidated Summary Confirmation

推奨セットを一括採用した結果の要約です。成果物生成前に確認してください。

1. **Q1 = A** — notice は `main` 内・h1 直下。TOC 印なし
2. **Q2 = A** — 閉じられない静的バナー
3. **Q3 = A** — scrolled→見出し、top/未訳→h1。locale コントロールには戻さない
4. **Q4 = E** — loading / ready / missing_ja / not_found をすべて明示
5. **Q5 = A** — 既存 Docs Shell コンポーネント踏襲。新規 DS なし
6. **Q6 = A** — 該当箇所の WCAG 2.1 AA。完全適合監査は後段可
7. **Q7 = A** — 既存スプリット維持。新規ブレークポイントなし
8. **Q8 = A** — h1 は Should として記載。Must Fail にしない

Does this all look correct before I generate the refined mockup artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
