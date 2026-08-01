# Intent Backlog — Docs i18n（proto-Units）

> ステージ: scope-definition (Ideation 1.4) / 作成日: 2026-07-31  
> 根拠: [scope-document.md](./scope-document.md)  
> 優先度: MoSCoW + シーケンス（価値優先、ただし M5 を先頭）

## Prioritization Summary

| MoSCoW | proto-Units |
|--------|-------------|
| Must | U1, U2, U3, U4, U5 |
| Should | U6 |
| Could | U7 |
| Won't (初期) | 自動 MT パイプライン / 別 CMS / クラウド docs / エンジン改変 |

## Proto-Units

### U1 — Upstream docs snapshot ingest（Must / 先頭）

- **価値:** I1 解消。空コンテンツのまま UI を作らない  
- **成果の目安:** モノレポに `docs/guide` + `docs/reference`（en）と `sourceVersion` 相当の版情報が載る  
- **依存:** なし（最初）  
- **スコープ ID:** M5  

### U2 — Bundled docs reader + en/ja switch（Must / MVP）

- **価値:** S-docs-1 — 拡張内で同一 TOC／スタイルの言語切替閲覧  
- **成果の目安:** vscode-extension Webview で en/ja 切替、オフライン可読。ja は部分ページ可  
- **依存:** U1  
- **スコープ ID:** M1, M2  
- **Bootstrap:** 初期 ja は本セッションで AI 翻訳導入可（継続は U5）  

### U3 — Deep links from dashboard / StageCard（Must）

- **価値:** ワークフロー画面から同梱 docs へ一発で辿れる  
- **成果の目安:** StageCard 等から該当 docs アンカーへ遷移  
- **依存:** U2（少なくとも読める面があること）  
- **スコープ ID:** M4  

### U4 — Docs Bridge 縮退／誘導（Must）

- **価値:** 本文の二重正本を解消し、同梱サイトへ誘導  
- **成果の目安:** 既存抜粋 UI が縮退し、同梱 docs への導線になる  
- **依存:** U2  
- **スコープ ID:** M6  
- **Should 残件:** bridge-map ナビ／用語補助（S2）は U4 内または後続の薄い作業  

### U5 — Manual translation PR workflow（Must 運用）

- **価値:** ja の継続更新が承認付きで回る  
- **成果の目安:** 翻訳変更を別 PR でレビュー→マージする手順／パスが使える  
- **依存:** U1, U2（コンテンツと表示があること）  
- **スコープ ID:** M3  

### U6 — Upstream diff report automation（Should）

- **価値:** upstream 更新を見逃さず翻訳 PR の入口を自動化  
- **成果の目安:** 差分レポートが生成され、U5 に渡せる  
- **依存:** U1, U5  
- **スコープ ID:** S1  
- **備考:** MVP Done（Q1=B）には含めない。S-docs-1 の直後に回す（Q6=B）  

### U7 — Expand tree beyond guide+reference（Could）

- **価値:** harness-engineering 等の追加同梱  
- **依存:** U2 安定後  
- **スコープ ID:** C1  

## Value Stream（粗い流れ）

```text
[upstream aidlc-workflows docs]
        │
        ▼
   U1 snapshot ──► U2 reader + i18n (S-docs-1) ──► U3 deep links
                            │                         │
                            ├──► U4 Bridge redirect   │
                            └──► U5 translate PRs ◄───┘
                                        │
                                        ▼
                                   U6 diff report (Should)
```

## Delivery Notes

- ハードデッドラインなし  
- 切り下げ順（必要時）: U7 → U6 →（最終手段）U3/U4 の一部を遅延。U1/U2 は切り下げない  
- Units Generation 以降で正式 Unit 境界に再分割してよい（本ファイルは proto）  
