# Scope Definition — 質問ファイル

> ステージ: scope-definition (Ideation 1.4) / 深度: Standard  
> Intent: `260730-docs-i18n`  
> 入力: intent-statement / feasibility-assessment / constraint-register  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。

---

## Q1. 最小価値スコープ（MVP スライス）

最初に「できた」と言える最小セットはどれですか？

- A. 拡張内で en 同梱ガイド+リファレンスを読める（言語切替は後）
- B. 拡張内で en/ja 切替（同じ目次・スタイル）— S-docs-1。ja は一部ページでも可
- C. B + upstream 差分レポート（翻訳 PR 運用の入口まで）
- D. C + dashboard / StageCard からの深リンク接続
- X. その他（具体的に記入）

[Answer]: B

## Q2. Must / Should / Could（能力の優先度）

初期リリースの **Must** に入れる能力はどれですか？（複数可）

- A. 公式 docs（guide+reference）の en 同梱・オフライン閲覧
- B. en/ja 言語切替（同一 TOC／スタイル）
- C. upstream 差分レポート（自動化）
- D. 翻訳・承認は手動別 PR で ja 更新
- E. dashboard / StageCard 深リンク
- F. bridge-map をナビ／用語補助として残す
- X. その他（具体的に記入）

[Answer]: A,B,D,E

## Q3. 明示的に Out of Scope（初期）

初期で **やらない** ものはどれですか？（複数可）

- A. harness-engineering 等、guide/reference 以外の公式 docs
- B. 機械翻訳の自動同梱・自動公開
- C. 社内向け別ドキュメントサイト／CMS
- D. aidlc-workflows エンジン／ステージ定義の変更
- E. クラウド／AWS 上の docs ホスティング
- F. 上記すべて初期 Out
- X. その他（具体的に記入）

[Answer]: B,C,E(日本語訳のドキュメントはAIに翻訳してもらいこのセッションで導入する)

## Q4. 依存関係の扱い（I1: docs 未配置）

feasibility の I1（モノレポに docs が無い）をスコープ上どう扱いますか？

- A. Must の前提作業 — upstream スナップショット取り込みを最初の Unit / 最初の作業に含める
- B. 別トラック — コンテンツ取り込みは並行タスク、UI はモック／少数ページで先に進める
- C. スコープ縮小 — まず自前の薄い docs サンプルで S-docs-1 を証明し、公式ツリー同梱は次イテレーション
- X. その他（具体的に記入）

[Answer]: A

## Q5. Docs Bridge との境界

intent（置き換え）と feasibility Q1（第一統合は拡張+dashboard）を踏まえ、初期スコープでの Bridge 扱いは？

- A. 本文は同梱サイトが正本。既存抜粋 UI は初期から縮退／誘導に切り替え
- B. 併存期間あり — 同梱サイトを Must、抜粋 UI の整理は Should
- C. bridge-map（ナビ／用語）だけ残し、本文抜粋は初期 Must で置き換え
- X. その他（具体的に記入）

[Answer]: A

## Q6. シーケンス方針

能力の並べ方の好みは？

- A. 依存優先 — スナップショット取り込み → 同梱閲覧 → 言語切替 → 差分レポート → 深リンク
- B. 価値優先 — 先に S-docs-1（切替閲覧）、差分運用は直後
- C. リスク優先 — サイズ／起動とコンテンツパイプラインを先に潰す
- X. その他（具体的に記入）

[Answer]: B

## Q7. ハードデッドライン

特定能力に紐づく締切はありますか？

- A. なし（feasibility Q4 = A を維持）
- B. ある — 能力と日付を記入
- X. その他（具体的に記入）

[Answer]: A

---

## Q8. Learnings (§13) — keep as project practices?

どれを `project.md` に残しますか？（複数可）

- A. c1 — scope 質問に I1 と Docs Bridge 境界を明示して MoSCoW 固定
- B. c2 — 継続自動 MT は Out、初期 ja の AI ブートストラップは In
- C. c3 — 差分レポートは Should(U6)。Must は A,B,D,E + スナップショット
- D. c4 — 価値優先と依存先頭を「取り込み→S-docs-1→…→差分」に合成
- E. None — いずれも残さない
- X. その他（具体的に記入）

[Answer]: E

## Q9. Anything to add for next time?

- A. Nothing to add
- B. Add a note（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
