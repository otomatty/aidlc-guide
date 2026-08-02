# Intent Capture & Framing — 質問ファイル

> ステージ: intent-capture (Ideation 1.1) / 深度: Standard  
> Intent: `260802-docs-deeplink`（docs-i18n **Bolt 3**）  
> 親: 完了済み `260730-docs-i18n`（Bolt 1）/ `260801-docs-locale`（Bolt 2, PR [#34](https://github.com/otomatty/aidlc-guide/pull/34)）  
> 追跡 Issue: [#29](https://github.com/otomatty/aidlc-guide/issues/29)  
> Bolt 2 で locale keep-path・未訳 notice・アンカー着地は成立済み。本 intent は **StageCard から拡張内 Docs Shell への深リンク（US-05 / openOfficialDoc）** を固定するための質問です。  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。  
> 回答モード: Chat — 推奨を適用（ユーザー指示 2026-08-02）

---

## Q1. 解決する問題（Bolt 3）

Bolt 2 のあとに残っている、いちばん解きたい問題はどれですか？

- A. StageCard の docs リンクが外部ブラウザ／ワークスペースファイルを開き、拡張内 Docs Shell に着地しない
- B. ステージと公式 docs の対応（7 slug map）が UI から使われていない
- C. リンク文言が曖昧（bare `Docs` 等）で、どのステージの説明か伝わらない
- D. A〜C すべて（着地・slug map 配線・ラベルの三点セット）
- X. その他（具体的に記入）

[Answer]: D

## Q2. 主たる受益者

この Bolt でいちばん価値を届けるべきユーザーは誰ですか？

- A. ドライバー（モブ中に StageCard から公式 docs を拡張内で開いて説明したい）
- B. aidlc-workflows 経験の浅いエンジニア（現在ステージの公式説明にすぐ辿り着きたい）
- C. A を主とし、B は副次（親 US-05 の配分）
- D. ドキュメント整備担当（slug→path の正しさを運用したい）
- X. その他（具体的に記入）

[Answer]: C

## Q3. 成功の定義（Bolt 3 DoD）

何ができたら「Bolt 3 できた」と言えますか？（select all that apply）

- A. 7 slug の静的 map が StageCard 経由で使われる（intent-capture 等）
- B. リンクラベルが bare `Docs` だけではない（例: `Docs: Intent Capture`）
- C. ホストが `openOfficialDoc` 相当で `{locale, path, anchor?}` を発行する
- D. マップ済みステージは外部ブラウザを開かない（拡張内 Docs Shell）
- E. 未マップステージは Docs Shell の先頭（top）に着地する
- F. Demo: intent-capture StageCard → Docs Shell 着地
- X. その他（具体的に記入）

[Answer]: A, B, C, D, E, F

## Q4. イニシアチブのトリガー

今 Bolt 3 に着手する直接のきっかけは何ですか？

- A. Bolt 2（PR #34 / #28）がマージされ、計画どおり直列の次が deep links
- B. Issue #29 を立てて追跡可能にしたので実装を開始する
- C. StageCard がまだレガシー `docsOpenHref` / IDE open のままであることが確認できた
- D. A〜C の複合
- X. その他（具体的に記入）

[Answer]: D

## Q5. 本 intent のスコープ境界

Bolt 3 に **含めない** ものはどれですか？（select all that apply）

- A. BridgeRedirectPanel / excerpt 非マウント（→ Bolt 4 / #30）
- B. upstream 差分レポートの本番化（→ Bolt 5 / #31）
- C. locale keep-path / missing_ja notice の再実装（Bolt 2 で完了）
- D. 新しい公式ツリーの大幅追加
- E. 上記はすべて Bolt 3 外（本 intent は StageCard → openOfficialDoc のみ）
- X. その他（具体的に記入）

[Answer]: E

## Q6. 親 intent 成果物の扱い

Bolt 1/2（`260730-docs-i18n` / `260801-docs-locale`）の設計・実装をどう扱いますか？

- A. brownfield 延長 — 既存 Docs Shell deep-link 着地口・`stage-map`・`/api/official-docs` を前提に差分のみ
- B. 設計をやり直す（要件・FD を新規に書き直す）
- C. A だが、US-05 の payload／ラベル／unmapped 契約だけは Formal に再固定する
- X. その他（具体的に記入）

[Answer]: C

## Q7. アーキテクト観点 — 技術境界の確認

Bolt 1/2 で固定した境界を継承しますか？

- A. はい — ローカル専用・実行時 fetch なし・`/api/official-docs` のみ・content-tree 切替・aidlc-workflows 本体は触らない。深リンクは拡張ホスト内で完結
- B. 一部見直す（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
