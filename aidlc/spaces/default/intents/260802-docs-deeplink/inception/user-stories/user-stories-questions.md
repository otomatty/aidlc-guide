# User Stories — 質問ファイル

> ステージ: user-stories (Inception 2.4) / 深度: Standard  
> Intent: `260802-docs-deeplink`（docs-i18n **Bolt 3**）  
> 親: 完了済み `260730-docs-i18n`（US-05 契約）/ `260801-docs-locale`（Bolt 2）  
> 追跡 Issue: [#29](https://github.com/otomatty/aidlc-guide/issues/29)  
> 入力: [requirements.md](../requirements-analysis/requirements.md)（FR-B3-1…6 READY）  
> 回答: Accept all recommended（2026-08-02）

---

## Q1. ペルソナ開発アプローチ

Bolt 3 のペルソナはどうしますか？

- A. 親 intent の P1/P2/P3 を継承し、**P2（ドライバー）を主**とする（Recommended）
- B. P2 のみ新規定義し、P1/P3 は省略
- C. 親と同じ優先順位（P1 主）のまま継承
- X. その他（具体的に記入）

[Answer]: A

## Q2. ストーリー分解アプローチ

Bolt 3 のストーリー分解はどれですか？

- A. 親 US-05 を継承し、FR-B3-* を実装可能なストーリーに分解（Recommended）
- B. FR-B3 全体を 1 本の大きなストーリーにする
- C. パッケージ単位（extension / dashboard / official-docs）で切る
- X. その他（具体的に記入）

[Answer]: A

## Q3. Must ストーリーの範囲

初期 Must に含めるのは？

- A. FR-B3-1…6 をカバーする Must ストーリー一式（デモ含む）（Recommended）
- B. 着地（mapped）のみ Must、unmapped / ラベル / レガシー置換は Should
- C. デモ手動のみ Must、自動テストは Should
- X. その他（具体的に記入）

[Answer]: A

## Q4. 受入基準の形式

- A. 各ストーリーに Given / When / Then（Recommended — inception guardrail）
- B. チェックリスト箇条書きのみ
- C. Must は GWT、Should は短いチェックリスト
- X. その他（具体的に記入）

[Answer]: A

## Q5. INVEST / 粒度

- A. INVEST 寄り — 契約・ラベル・unmapped・レガシー・検証を分離可能な薄さ（Recommended）
- B. FR 単位のやや大きめ（Units Generation で割る）
- C. 画面単位で 1 本にまとめる
- X. その他（具体的に記入）

[Answer]: A

## Q6. スコープ外の確認

Bolt 3 に **含めない** ストーリーを再確認します。（select all that apply）

- A. Bridge 縮退（B4 / #30）
- B. upstream 差分レポート（B5 / #31）
- C. locale keep-path / missing_ja 再実装（Bolt 2）
- D. 上記すべて（Recommended）
- X. その他（具体的に記入）

[Answer]: D

## Consolidated Summary Confirmation

上記 Q1–Q6 の記入内容でストーリー生成に進んでよいか？

- A. Looks correct — proceed to mob generation
- B. Needs revision — (specify)

[Answer]: A
