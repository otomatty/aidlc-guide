# Intent Backlog — Docs i18n Bolt 2（proto-Units）

> ステージ: scope-definition (Ideation 1.4) / 作成日: 2026-08-01  
> 根拠: [scope-document.md](./scope-document.md)  
> 優先度: MoSCoW + シーケンス（依存優先）

## Prioritization Summary

| MoSCoW | proto-Units |
|--------|-------------|
| Must | U1, U2, U3, U4 |
| Should | U5 |
| Could | U6 |
| Won't (Bolt 2) | B3 深リンク / B4 Bridge / B5 差分レポート / 大規模ツリー追加 / 自動 MT パイプライン |

## Proto-Units

### U1 — official-docs missing_ja / anchor 分岐（Must / 先頭）

- **価値:** locale 解決のコアロジックを完成させる  
- **成果の目安:** `resolvePage` が missing_ja と missing anchor を適切にハンドリングし、テストで網羅される  
- **依存:** Bolt 1 の `packages/official-docs`  
- **スコープ ID:** M1, M2, M3  

### U2 — api-core locale/notice 拡張（Must）

- **価値:** `/api/official-docs` が locale 維持と未訳情報を返せる  
- **成果の目安:** missing_ja 時の応答に notice フラグが含まれ、locale は `ja` のまま  
- **依存:** U1  
- **スコープ ID:** M2  

### U3 — dashboard Docs Shell locale/untranslated UI（Must）

- **価値:** S-docs-1（部分 `ja`）をユーザーが体験できる  
- **成果の目安:** keep-path 切替・未訳 notice（`role=status`）・anchor フォールバックが UI で動作  
- **依存:** U2  
- **スコープ ID:** M1, M2, M3  

### U4 — coverage 床導入（Must）

- **価値:** official-docs の品質が CI で担保される  
- **成果の目安:** branch coverage 95% が `bun run check` で効く  
- **依存:** U1（テスト対象のコードが存在すること）  
- **スコープ ID:** M4  

### U5 — Docs Shell h1 階層修正（Should）

- **価値:** Codex 指摘の a11y 改善  
- **成果の目安:** Docs Shell に見える h1 が存在する  
- **依存:** U3  
- **スコープ ID:** S1  
- **備考:** 必須外。同 PR で直してもよいし、別 PR でもよい  

### U6 — 未訳 notice 文言・デザイン改善（Could）

- **価値:** ユーザー体験の微調整  
- **依存:** U3  
- **スコープ ID:** C1  

## Value Stream（粗い流れ）

```text
[Bolt 1: packages/official-docs + api-core + dashboard]
        │
        ▼
   U1 official-docs (missing_ja / anchor)
        │
        ▼
   U2 api-core (locale/notice 拡張)
        │
        ▼
   U3 dashboard (Docs Shell UI)
        │
        ├──► U4 coverage 床
        └──► U5 h1 修正 (Should)
```

## Delivery Notes

- ハードデッドラインなし  
- 切り下げ順（必要時）: U6 → U5 → U4。U1/U2/U3 は切り下げない  
- Units Generation 以降で正式 Unit 境界に再分割してよい（本ファイルは proto）  
