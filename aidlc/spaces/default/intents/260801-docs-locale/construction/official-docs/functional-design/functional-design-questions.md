# Functional Design — Unit: official-docs

> ステージ: functional-design (Construction) / unit: **official-docs** (library)  
> Intent: `260801-docs-locale`（製品 Bolt 2）  
> 上流: [unit-of-work.md](../../../inception/units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [components.md](../../../inception/application-design/components.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [services.md](../../../inception/application-design/services.md)  
> 親 FD: `260730-docs-i18n` construction/official-docs — 再仕様化せず **差分ルール**のみ。  
> **Mode:** guided（推奨セット一括採用 · Looks correct）

---

## Q1. keep-path アルゴリズム

locale 切替時の path 扱いは？

- A. 要求 path を常に出力。対象 locale ファイル欠落でも別 path に書き換えない（FR-B2-1.1）。未訳は missing_ja 分岐へ
- B. 対象 locale に無ければ en 側の「近い」path へリライトしてよい
- X. その他（具体的に記入）

[Answer]: A

## Q2. missing_ja 分岐

- A. `locale=ja` かつ ja ファイル無し・en あり → Result ok 形で `localeServed=en`, `notice=missing_ja`, en body。en も無し → `not_found`
- B. ja 無しは常に `not_found`（UI が未訳を推測）
- X. その他（具体的に記入）

[Answer]: A

## Q3. anchor 規則

- A. 見出し ID 一致 → `scrolled`；リクエストに anchor あり・不一致 → `top`；anchor 無し → `none`（FR-B2-3）
- B. 不一致は `not_found`
- X. その他（具体的に記入）

[Answer]: A

## Q4. listToc と疎 TOC

- A. 要求 locale の TOC を返す。ja が疎でも path 集合はその locale ツリー準拠（ハイライト可否は UI が path 一致で判定）
- B. 常に en∪ja の union TOC を返す
- X. その他（具体的に記入）

[Answer]: A

## Q5. エラー／カバレッジ

- A. kinds: ok / missing_ja(page) / not_found / path_rejected / empty_content。branch coverage ≥95% on resolve/roots/markdown in `bun run check`
- B. coverage は後続 unit に委譲
- X. その他（具体的に記入）

[Answer]: A

---

## Consolidated Summary Confirmation

1. Q1=A keep-path 固定  
2. Q2=A missing_ja success-shaped  
3. Q3=A scrolled/top/none  
4. Q4=A locale TOC（union しない）  
5. Q5=A coverage 床 + error kinds  

[Answer]: Looks correct
