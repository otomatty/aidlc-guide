# Intent Backlog — Docs i18n Bolt 3（proto-Units）

> ステージ: scope-definition (Ideation 1.4) / 作成日: 2026-08-02  
> 根拠: [scope-document.md](./scope-document.md)  
> 優先度: MoSCoW + シーケンス（契約優先）  
> 上流: intent-statement / feasibility-assessment / constraint-register

## Prioritization Summary

| MoSCoW | proto-Units |
|--------|-------------|
| Must | U1, U2, U3, U4 |
| Should | — |
| Could | — |
| Won't (Bolt 3) | B4 Bridge / B5 差分 / Bolt 2 再実装 / map 拡張 / クラウド |

## Proto-Units

### U1 — openOfficialDoc 契約（Must / 先頭）

- **価値:** dashboard と extension が同じ `{locale,path,anchor?}` を話す  
- **成果の目安:** メッセージ type 文字列と payload 型が shared-types（または同等）に固定され、テスト可能  
- **依存:** 親 US-05 / FR-U3.1  
- **スコープ ID:** M3  

### U2 — vscode-extension host handler（Must）

- **価値:** ホストが Docs Shell を開き deep-link を渡す  
- **成果の目安:** openOfficialDoc 相当で Shell が開き、外部ブラウザを起動しない  
- **依存:** U1  
- **スコープ ID:** M3, M4  

### U3 — StageCard DocsLink 配線（Must）

- **価値:** ドライバーがカードから公式 docs に着地できる  
- **成果の目安:** 7 slug 解決・ラベル ≠ bare Docs・レガシー `docsOpenHref` をマップ経路で使わない；unmapped→top  
- **依存:** U1, U2, `STAGE_DOC_MAP`  
- **スコープ ID:** M1, M2, M4, M5, M6  

### U4 — Docs Shell locale deep-link 適用（Must）

- **価値:** payload の locale で着地し、path/anchor と整合  
- **成果の目安:** deep-link 状態に locale を含め、初回適用後に消費される  
- **依存:** U2、Bolt 2 Shell 着地口  
- **スコープ ID:** M3, M4  

## Value Stream（粗い流れ）

```text
[Bolt 1/2: Docs Shell + stage-map + locale]
        │
        ▼
   U1 openOfficialDoc 契約
        │
        ▼
   U2 vscode-extension host
        │
        ├──► U3 StageCard 配線
        │
        └──► U4 Shell locale 適用
                │
                ▼
           Demo: intent-capture → Shell
```

## Delivery note

親 bolt-plan の unit 名は `docs-navigation`（StageCard + openOfficialDoc）。U1–U4 はその unit 内の実装スライス。Units Generation で正式 unit に畳む。
