# Intent Capture & Framing — 質問ファイル

> ステージ: intent-capture (Ideation 1.1) / 深度: Standard  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4**）  
> 親: 完了済み `260730-docs-i18n`（Bolt 1）/ `260801-docs-locale`（Bolt 2）/ `260802-docs-deeplink`（Bolt 3）  
> 追跡 Issue: [#30](https://github.com/otomatty/aidlc-guide/issues/30)  
> Bolt 3 で StageCard → openOfficialDoc → Docs Shell 着地は成立済み。本 intent は **Legacy Bridge 経路を同梱 Docs 正本へ degrade（US-06; US-09 optional）** するための質問です。  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。  
> 回答モード: Chat — 推奨を適用（ユーザー指示 2026-08-03）

---

## Q1. 解決する問題（Bolt 4）

Bolt 3 のあとに残っている、いちばん解きたい問題はどれですか？

- A. Legacy Bridge が excerpt を記事のようにマウントし、同梱 Docs と二重正本になっている
- B. Bridge から Docs Shell への導線（Open in Docs）が一次 CTA になっていない
- C. Bridge 上の用語集／補助 UI（US-09）が残っていて、正本移行の妨げになっている
- D. A〜B を Must、C は Should（切下げ可）— Issue #30 / 親 bolt-plan の配分
- X. その他（具体的に記入）

[Answer]: D

## Q2. 主たる受益者

この Bolt でいちばん価値を届けるべきユーザーは誰ですか？

- A. ドライバー／モブ参加者（Legacy Bridge から迷わず同梱 Docs に移りたい）
- B. 初学者エンジニア（正本が一箇所だと学習コストが下がる）
- C. A を主とし、B は副次（親 US-06 の配分）
- D. ドキュメント整備担当（Bridge 経路を切り捨てて運用を単純化したい）
- X. その他（具体的に記入）

[Answer]: C

## Q3. 成功の定義（Bolt 4 DoD）

何ができたら「Bolt 4 できた」と言えますか？（select all that apply）

- A. excerpt が記事としてマウントされない
- B. **Open in Docs** が primary CTA
- C. 任意の glossary / US-09 補助 UI は切下げ可能（Should）
- D. Demo: Legacy Bridge → Open in Docs → Shell
- E. 信頼仮説「正本は同梱 Docs のみ」がデモで示せる
- X. その他（具体的に記入）

[Answer]: A, B, C, D, E

## Q4. イニシアチブのトリガー

今 Bolt 4 に着手する直接のきっかけは何ですか？

- A. Bolt 3（docs-deeplink / #29）が完了し、計画どおり直列の次が Bridge degrade
- B. Issue #30 を立てて追跡可能にしたので実装を開始する
- C. Legacy Bridge がまだ正本扱いになり得る経路として残っていることが確認できた
- D. A〜C の複合
- X. その他（具体的に記入）

[Answer]: D

## Q5. 本 intent のスコープ境界

Bolt 4 に **含めない** ものはどれですか？（select all that apply）

- A. StageCard deep links / openOfficialDoc の再実装（→ Bolt 3 で完了）
- B. upstream 差分レポートの本番化（→ Bolt 5 / #31）
- C. locale keep-path / missing_ja notice の再実装（Bolt 2 で完了）
- D. 新しい公式ツリーの大幅追加
- E. 上記はすべて Bolt 4 外（本 intent は BridgeRedirectPanel degrade のみ）
- X. その他（具体的に記入）

[Answer]: E

## Q6. 親 intent 成果物の扱い

Bolt 1–3（`260730-docs-i18n` / `260801-docs-locale` / `260802-docs-deeplink`）の設計・実装をどう扱いますか？

- A. brownfield 延長 — 既存 Docs Shell・`openOfficialDoc`・`/api/official-docs` を前提に Bridge 差分のみ
- B. 設計をやり直す（要件・FD を新規に書き直す）
- C. A だが、US-06 の degrade 契約（excerpt 非マウント / primary CTA / Demo）だけは Formal に再固定する
- X. その他（具体的に記入）

[Answer]: C

## Q7. アーキテクト観点 — 技術境界の確認

Bolt 1–3 で固定した境界を継承しますか？

- A. はい — ローカル専用・実行時 fetch なし・`/api/official-docs` のみ・content-tree 切替・aidlc-workflows 本体は触らない。Bridge degrade も拡張ホスト／Dashboard 内で完結
- B. 一部見直す（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A

## Q8. US-09（glossary / 補助）の扱い

Issue #30 では US-09 は optional / Should です。本 intent でどう扱いますか？

- A. Should — 実装してよいが DoD 必須にはしない（切下げ可）
- B. Must — Bolt 4 に含めて必須化する
- C. Out — 本 intent から外し、別途または打ち切り
- X. その他（具体的に記入）

[Answer]: A
