# Intent Capture & Framing — 質問ファイル

> ステージ: intent-capture (Ideation 1.1) / 深度: Standard  
> Intent: `260801-docs-locale`（docs-i18n **Bolt 2**）  
> 親: 完了済み `260730-docs-i18n` / マージ済み PR [#26](https://github.com/otomatty/aidlc-guide/pull/26)（Bolt 1）  
> 追跡 Issue: [#28](https://github.com/otomatty/aidlc-guide/issues/28)  
> Bolt 1 で同梱・Shell・locale 制御の縦スライスは成立済み。本 intent は **locale 切替体験と未訳 UX の完成** を固定するための質問です。  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。

---

## Q1. 解決する問題（Bolt 2）

Bolt 1 のあとに残っている、いちばん解きたい問題はどれですか？

- A. 部分 `ja` のとき切替後に迷子になる（keep-path / 未訳の見え方が曖昧）
- B. 未訳ページで locale が `en` に戻ってしまう／気づかないまま英語を読む
- C. アンカー欠落時にページ内の意図した位置に着地できない
- D. A〜C すべて（切替・未訳 notice・アンカーの三点セット）
- X. その他（具体的に記入）

[Answer]: D

## Q2. 主たる受益者

この Bolt でいちばん価値を届けるべきユーザーは誰ですか？

- A. aidlc-workflows 経験の浅いエンジニア（ja で読み進めたい／未訳でも迷わない）
- B. ドライバー（モブ中に locale を切り替えて説明したい）
- C. ドキュメント整備担当（coverage / 未訳の状態を把握したい）
- D. A を主とし、B は副次（Bolt 1 と同じ配分）
- X. その他（具体的に記入）

[Answer]: A

## Q3. 成功の定義（Bolt 2 DoD）

何ができたら「Bolt 2 できた」と言えますか？（select all that apply）

- A. 同一 path で en↔ja を切替でき、path が維持される（keep-path）
- B. `ja` 欠落時に notice（`role=status`）が出て、locale は `ja` のまま
- C. 欠落アンカーはページ先頭へフォールバックする
- D. official-docs に coverage 床（NFR-3 / branch 95% 系）が `bun run check` で効く
- E. Codex 指摘の Docs Shell `h1` 階層もこの Bolt で直す
- X. その他（具体的に記入）

[Answer]: A, B, C, D

## Q4. イニシアチブのトリガー

今 Bolt 2 に着手する直接のきっかけは何ですか？

- A. Bolt 1（PR #26）がマージされ、計画どおり直列の次が locale polish
- B. 手動確認で部分 `ja` の UX がまだ粗いことが分かった
- C. Issue #28 を立てて追跡可能にしたので実装を開始する
- D. A〜C の複合
- X. その他（具体的に記入）

[Answer]: D

## Q5. 本 intent のスコープ境界

Bolt 2 に **含めない** ものはどれですか？（select all that apply）

- A. StageCard → `openOfficialDoc` ディープリンク（→ Bolt 3 / #29）
- B. BridgeRedirectPanel（→ Bolt 4 / #30）
- C. upstream 差分レポートの本番化（→ Bolt 5 / #31）
- D. 新しい公式ツリーの大幅追加（harness-engineering 等）
- E. 上記はすべて Bolt 2 外（本 intent は locale/untranslated のみ）
- X. その他（具体的に記入）

[Answer]: E

## Q6. 親 intent 成果物の扱い

Bolt 1（`260730-docs-i18n`）の設計・実装をどう扱いますか？

- A. brownfield 延長 — 既存 packages/official-docs・Docs Shell・API を前提に差分のみ
- B. 設計をやり直す（要件・FD を新規に書き直す）
- C. A だが、未訳/anchor の契約だけは Formal に再固定する
- X. その他（具体的に記入）

[Answer]: C

## Q7. アーキテクト観点 — 技術境界の確認

Bolt 1 で固定した境界を継承しますか？

- A. はい — ローカル専用・実行時 fetch なし・`/api/official-docs` のみ・content-tree 切替・aidlc-workflows 本体は触らない
- B. 一部見直す（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
