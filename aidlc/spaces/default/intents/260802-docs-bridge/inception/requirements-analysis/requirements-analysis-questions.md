# Requirements Analysis — 質問ファイル

> ステージ: requirements-analysis (Inception) / 深度: Standard  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4** / Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)）  
> 上流: intent-statement / scope-document / CodeKB / team-practices  
> US-06 Bridge degrade の Formal 要件を固定します。  
> **Mode:** Guide Me（推奨適用）

---

## Q1. 要件 ID の扱い

Bolt 4 の requirements.md で親 FR をどう扱いますか？

- A. 親 / Bolt 3 の FR を参照継承し、Bolt 4 固有差分だけを FR-B4.* で書く
- B. Bolt 4 用に FR を一から採番し直し、親 ID は Traceability 表だけに残す
- C. 親 FR 本文をコピーして改訂した版を正本とする
- X. その他（具体的に記入）

[Answer]: A

## Q2. US-06 Must（機能）

Must の機能要件はどれですか？（select all that apply）

- A. Legacy Bridge / StageCard 経路で excerpt を記事としてマウントしない
- B. **Open in Docs** が primary CTA（視覚・キーボード双方）
- C. CTA は Bolt 3 の `open-official-doc` / Docs Shell 着地を再利用する
- D. Demo: Legacy Bridge → Open in Docs → Shell で「正本は同梱 Docs のみ」を示せる
- E. A〜D すべて必須
- X. その他（具体的に記入）

[Answer]: E

## Q3. US-09 glossary / 補助

Should の扱いはどれですか？

- A. Should — 残ってよいが Must DoD / FR-B4 Must の失敗条件にしない（切下げ可）
- B. Must — glossary 完成も Bolt 4 完了条件に含める
- C. Won't — 完全削除を必須にする
- X. その他（具体的に記入）

[Answer]: A

## Q4. レガシー経路

`docsOpenHref` / IDE open / excerpt API はどう扱いますか？

- A. 製品 UI 上の正本体験は Open in Docs のみ。excerpt マウント禁止。レガシー IDE open は公式正本導線に使わない
- B. excerpt マウントを残し、Open in Docs を併置
- X. その他（具体的に記入）

[Answer]: A

## Q5. CTA 文言・メッセージ type

Open in Docs の最終文言と message type はどこで固定しますか？

- A. Functional Design でピン留め（本 requirements は契約意図のみ）
- B. 本 requirements で文言と type 文字列まで Must 固定
- X. その他（具体的に記入）

[Answer]: A

## Q6. NFR / テスト床

Bolt 4 で必須化する NFR はどれですか？

- A. 親 NFR（local-only・no runtime fetch）継承 + practices Q2: US-06 UI/契約テストを `bun run check` に含める。新 coverage 床の新設はしない
- B. dashboard Bridge 経路に新規 branch coverage 95% 床を追加
- X. その他（具体的に記入）

[Answer]: A

## Q7. スコープ外の明示

requirements.md の Out of Scope に必ず含めるものはどれですか？（select all that apply）

- A. B3 deep-link 再実装（#29）
- B. B5 upstream 差分レポート（#31）
- C. locale/untranslated 再実装
- D. ターミナル注入・会話投稿・クラウドホスティング・workflows 変更
- E. 上記すべて
- X. その他（具体的に記入）

[Answer]: E

---

## Consolidated Summary

| Q | Answer | Decision |
|---|--------|----------|
| Q1 | A | FR-B4.* 差分採番、親/Bolt3 参照継承 |
| Q2 | E | US-06 Must 四点セット |
| Q3 | A | US-09 Should 切下げ可 |
| Q4 | A | excerpt マウント禁止、正本は Open in Docs |
| Q5 | A | 文言/type は FD で固定 |
| Q6 | A | NFR 継承 + US-06 check テスト |
| Q7 | E | Out of Scope 一式 |

Looks correct / Request changes?

- Looks correct
- Request changes

[Answer]: Looks correct
