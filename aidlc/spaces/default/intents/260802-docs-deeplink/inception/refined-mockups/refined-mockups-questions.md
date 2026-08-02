# Refined Mockups — 質問ファイル

> ステージ: refined-mockups (Inception) / 深度: Standard  
> Intent: `260802-docs-deeplink`（docs-i18n **Bolt 3**）  
> 上流: [wireframes.md](../../ideation/rough-mockups/wireframes.md) / [user-flow.md](../../ideation/rough-mockups/user-flow.md) / [stories.md](../user-stories/stories.md) / [requirements.md](../requirements-analysis/requirements.md)  
> 回答: Accept all recommended（2026-08-02）

---

## Q1. StageCard リンクラベル表現

- A. 可視・accessible name とも `Docs: <Stage display name>`（Recommended — US-B3-02 / W1a）
- B. アイコン + 短い「Docs」＋ `aria-label` にのみステージ名
- C. ステージ名のみ（Docs 接頭辞なし）
- X. その他（具体的に記入）

[Answer]: A

## Q2. Deep-link 着地フォーカス

- A. `anchor` ヒット → その見出し。top / unmapped → ページ `h1` または `main`。locale コントロールには戻さない（Recommended）
- B. 常に locale コントロールへ
- C. フォーカス移動なし（スクロールのみ）
- X. その他（具体的に記入）

[Answer]: A

## Q3. 画面状態セット（Bolt 3 明示）

- A. idle Dashboard（リンク表示）
- B. activating（メッセージ送信中 — 短時間）
- C. Shell mapped land（path + locale + optional anchor）
- D. Shell unmapped top
- E. A〜D すべて（Recommended）
- X. その他（具体的に記入）

[Answer]: E

## Q4. デザインシステム

- A. 既存 StageCard / Docs Shell コンポーネント踏襲。新規 DS なし（Recommended）
- B. OpenOfficialDocLink 用に新デザイン言語を導入
- X. その他（具体的に記入）

[Answer]: A

## Q5. アクセシビリティ目標

- A. WCAG 2.1 AA 該当箇所（キーボード活性化、着地フォーカス、色非依存ラベル）（Recommended）
- B. WCAG 2.1 AA 完全適合を Bolt 3 Must にする
- C. rough a11y 注記のみ（追加なし）
- X. その他（具体的に記入）

[Answer]: A

## Q6. レスポンシブ / 表示面

- A. 拡張 Webview のみ。ブラウザ Dashboard は Fail 条件にしない（Recommended — NFR-B3-2）
- B. ブラウザ副経路も mid-fi に含める
- X. その他（具体的に記入）

[Answer]: A

## Q7. Interaction pattern

- A. 同一拡張内で Docs Shell パネル／Webview を開く／前面化。モーダルなし（Recommended — Flow A）
- B. 確認ダイアログ付き
- C. 外部ブラウザフォールバック付き
- X. その他（具体的に記入）

[Answer]: A

## Consolidated Summary Confirmation

- A. Looks correct — proceed to artifact generation（Recommended）
- B. Needs revision — (specify)

[Answer]: A
