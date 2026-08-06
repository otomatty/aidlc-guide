# Scope Definition — 質問ファイル

> ステージ: scope-definition (Ideation 1.4) / 深度: Standard  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4** / Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)）  
> 親: 完了済み `260730-docs-i18n`（Bolt 1 / PR [#26](https://github.com/otomatty/aidlc-guide/pull/26)）  
> 前提完了: Bolt 2 PR [#34](https://github.com/otomatty/aidlc-guide/pull/34)、Bolt 3 `260802-docs-deeplink` / [#29](https://github.com/otomatty/aidlc-guide/issues/29)  
> 注: 初稿の「コピー／ターミナル注入」枠は intent（US-06 Bridge degrade）と不一致のため、本版で正本に合わせた。  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。

---

## Q1. 最小価値スコープ（Bolt 4 の MVP）

Bolt 4 で「できた」と言える最小限はどれですか？

- A. excerpt 非マウントのみ（Open in Docs CTA は後回し）
- B. Open in Docs を primary CTA にするのみ（excerpt は現状維持）
- C. excerpt 非マウント + Open in Docs primary + Demo（Legacy Bridge → Open in Docs → Shell）
- D. C + US-09 glossary / 補助 UI の完成も同時必須
- X. その他（具体的に記入）

[Answer]: C

## Q2. Must / Should / Could の仕分け

Bolt 4 の各能力をどう仕分けますか？

- A. US-06（excerpt 非マウント + Open in Docs primary + Demo）は Must / US-09 glossary は Should（切下げ可）
- B. US-06 と US-09 を両方 Must
- C. Open in Docs CTA のみ Must / excerpt 非マウントは Should
- X. その他（具体的に記入）

[Answer]: A

## Q3. 依存関係

Bolt 4 の実装で前提となるものはどれですか？（select all that apply）

- A. Bolt 1 の `packages/dashboard`（Docs Shell・Legacy Bridge 経路）
- B. Bolt 3 の `openOfficialDoc` / Docs Shell 着地契約
- C. `/api/official-docs`（同梱 docs 取得）
- D. Bolt 2 locale 完了を本 intent のブロッカーにする
- E. A + B + C（D は不要 — locale 再実装はスコープ外）
- X. その他（具体的に記入）

[Answer]: E

## Q4. シーケンス

実装の順序はどれが望ましいですか？

- A. Bridge を導線に縮退（excerpt 非マウント）→ Open in Docs を primary に配線 → Demo 検証
- B. CTA 配線を先に → その後 excerpt 縮退 → Demo
- C. 並行（UI と着地再利用を同時）
- X. その他（具体的に記入）

[Answer]: A

## Q5. スコープ外の確認

Bolt 4 に **含めない** ものを再確認します。（select all that apply）

- A. Bolt 3 deep link / StageCard 経路の再実装（→ #29）
- B. upstream 差分レポート本番化（→ #31 / B5）
- C. Bolt 2 locale/untranslated の再実装（→ #28）
- D. 実ターミナル注入・会話スレッド直接投稿・大規模ツリー追加
- E. 上記すべて
- X. その他（具体的に記入）

[Answer]: E

## Q6. ハードデッドライン

特定の能力に紐づくハードデッドラインはありますか？

- A. なし（品質と運用可能性優先）
- B. あり（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
