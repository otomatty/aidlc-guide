# Intent Backlog — Docs i18n Bolt 4（proto-Units）

> ステージ: scope-definition (Ideation 1.4) / 作成日: 2026-08-03  
> 根拠: [scope-document.md](./scope-document.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [feasibility-assessment.md](../feasibility/feasibility-assessment.md)  
> 優先度: MoSCoW + シーケンス（契約／リスク優先）  
> 追跡: Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)

## Prioritization Summary

| MoSCoW | proto-Units |
|--------|-------------|
| Must | U1, U2, U3 |
| Should | U4 |
| Could | U5 |
| Won't (Bolt 4) | B3 再実装 / B5 差分レポート / locale 再実装 / ターミナル注入 / 会話投稿 / 大規模ツリー / 別着地口 |

## Proto-Units

### U1 — Bridge excerpt 非マウント（Must / 先頭）

- **価値:** Legacy Bridge を正本から外し、二重正本を解消する  
- **成果の目安:** excerpt が記事としてマウントされない（US-06）  
- **依存:** Bolt 1 dashboard Bridge 経路  
- **スコープ ID:** M1 / constraint-register C-T6  

### U2 — Open in Docs primary CTA（Must）

- **価値:** 一次導線を同梱 Docs（Docs Shell）に寄せる  
- **成果の目安:** Open in Docs が primary CTA で、Bolt 3 の `openOfficialDoc` / Shell 着地を再利用する  
- **依存:** U1（導線としての Bridge）+ Bolt 3 着地契約 / constraint-register C-T4, C-T7  
- **スコープ ID:** M2  

### U3 — Demo: Bridge → Open in Docs → Shell（Must）

- **価値:** 「正本は同梱 Docs のみ」を受入で示せる  
- **成果の目安:** Demo 手順が再現できる  
- **依存:** U1, U2  
- **スコープ ID:** M3  

### U4 — US-09 glossary / 補助 UI（Should）

- **価値:** 補助体験の維持（切下げ可）  
- **成果の目安:** 残すなら壊さない／なくても US-06 DoD だけで完了  
- **依存:** U1  
- **スコープ ID:** S1 / C-O2  

### U5 — Bridge 文言・視覚のブラッシュアップ（Could）

- **価値:** 導線 UI の微調整  
- **依存:** U2（CTA 文言は Functional Design で固定）  
- **スコープ ID:** C1  

## Value Stream（粗い流れ）

```text
[Bolt 1–3: Docs Shell + openOfficialDoc + /api/official-docs]
        │
        ▼
   U1 Bridge excerpt 非マウント
        │
        ▼
   U2 Open in Docs primary CTA
        │
        ├──► U3 Demo 検証
        └──► U4 US-09 (Should, 切下げ可)
```

## Delivery Notes

- ハードデッドラインなし  
- 切り下げ順（必要時）: U5 → U4。U1/U2/U3 は切り下げない  
- Units Generation 以降で正式 Unit 境界に再分割してよい（本ファイルは proto）  
