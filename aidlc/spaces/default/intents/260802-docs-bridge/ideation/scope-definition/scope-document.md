# Scope Document — Docs i18n Bolt 4（Bridge Degrade）

> ステージ: scope-definition (Ideation 1.4) / 作成日: 2026-08-03  
> Intent: `260802-docs-bridge`  
> 根拠: [scope-definition-questions.md](./scope-definition-questions.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [feasibility-assessment.md](../feasibility/feasibility-assessment.md) / [constraint-register.md](../feasibility/constraint-register.md)  
> 追跡: Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)

## In Scope（Bolt 4 に含む）

### Minimum Viable Outcome（「できた」の定義）

**US-06 Bridge degrade:** Legacy Bridge が正本扱いにならない。excerpt は記事としてマウントされず、**Open in Docs** が一次 CTA となり、Demo（Legacy Bridge → Open in Docs → Shell）で「正本は同梱 Docs のみ」が示せる（Q1 = C）。

### Must（Bolt 4 必須）

| ID | 能力 | 出典 |
|----|------|------|
| M1 | **excerpt 非マウント** — Bridge 上で excerpt を記事正本としてマウントしない | Q2 = A / intent DoD / C-T6 |
| M2 | **Open in Docs primary CTA** — 一次操作が Docs Shell 着地（`openOfficialDoc` 再利用） | Q2 = A / intent DoD / C-T7 |
| M3 | **Demo** — Legacy Bridge → Open in Docs → Shell が再現できる | Q2 = A / intent Success Metrics |

### Should（Bolt 4 で望ましいが切り下げ可）

| ID | 能力 | 出典 |
|----|------|------|
| S1 | **US-09 glossary / 補助 UI** — 残っていてもよいが Must DoD に含めない | Q2 = A / C-O2 |

### Could（余裕があれば）

| ID | 能力 |
|----|------|
| C1 | BridgeRedirectPanel 文言・視覚のブラッシュアップ（Functional Design で固定後） |

## Out of Scope（Bolt 4 外）

| ID | 内容 | 出典 |
|----|------|------|
| O1 | Bolt 3 deep link / StageCard 経路の再実装 | Q5 = A / intent Out of scope |
| O2 | upstream 差分レポート本番化（B5 / #31） | Q5 = B |
| O3 | Bolt 2 locale/untranslated の再実装 | Q5 = C |
| O4 | 実ターミナル注入・会話スレッド直接投稿・大規模ツリー追加 | Q5 = D |
| O5 | クラウド／AWS 上の docs ホスティング | constraint C-T1 / feasibility |
| O6 | aidlc-workflows エンジン／ステージ定義の変更 | C-T5 / project Forbidden |
| O7 | 新規ルーティングライブラリや別着地口の追加 | C-T2 / C-T4 |

## Boundaries（境界）

- **実行時:** ネットワーク fetch なし。ローカル専用（C-T1）
- **統合面:** 拡張ホスト／Dashboard 内で完結（C-T3）。外部ブラウザ必須にしない
- **着地:** Bolt 3 の `openOfficialDoc` / Docs Shell / `/api/official-docs` を再利用（C-T4）。並行の別着地口を増やさない
- **スタック:** 既存 TS / bun / Vite / React / Extension API（C-T2）
- **正本契約:** Bridge は導線＋補助に縮退。正本は同梱 Docs のみ（intent Problem / DoD）

## Sequencing（並べ方）

**リスク／契約優先**（Q4 = A）:

1. **Bridge 縮退** — excerpt を記事マウントしない（M1）
2. **CTA 配線** — Open in Docs を primary にし `openOfficialDoc` を叩く（M2）
3. **Demo 検証** — Legacy Bridge → Open in Docs → Shell（M3）
4. **US-09（任意）** — glossary / 補助が残るなら維持、なければ切下げ（S1）

## Deadlines

ハードデッドラインなし（Q6 = A）。品質と運用可能性を優先（C-O1）。

## Traceability

| 上流 | 本スコープでの扱い |
|------|-------------------|
| intent-statement US-06 / DoD | M1, M2, M3（MVP = Q1 = C） |
| intent-statement US-09 Should | S1 |
| intent-statement B3/B5/locale 除外 | O1, O2, O3 |
| feasibility-assessment Go + C-T1〜C-T7 | Boundaries に継承 |
| constraint-register C-O2 | US-09 を Must DoD に入れない |

## Review

**Reviewer:** aidlc-product-agent (+ delivery context)  
**Verdict:** READY  
**Date:** 2026-08-03

### What holds

- In/Out boundary matches intent-statement and constraint-register (US-06 Must, US-09 Should, B3/B5/locale Won't).
- MVP (Q1=C) and sequencing (Q4=A) are consistent with feasibility-assessment Go recommendation.
- Proto-Units U1–U3 cover M1–M3; cut order protects Must DoD.
- Upstream artefacts referenced: intent-statement, feasibility-assessment, constraint-register.
