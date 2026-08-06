# Functional Design — Unit: docs-navigation

> ステージ: functional-design (Construction) / unit: **docs-navigation** (ui)  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4** / Issue #30）  
> 上流: [unit-of-work.md](../../../inception/units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [components.md](../../../inception/application-design/components.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [services.md](../../../inception/application-design/services.md)  
> 親 FD: `260802-docs-deeplink` construction/docs-navigation — **再仕様化せず** Bolt 4 差分のみ。  
> **Answered:** Yes — recommended defaults `1,1,1,1,1,1` (2026-08-04)

---

## Q1. Open in Docs — visible label + accessible name（FR-B4-2.4）

Bolt 3 StageCard は `Docs: <Stage Name>`（`OpenOfficialDocLink`）。Bolt 4 Bridge degrade の **primary CTA** 最終文字列は？

1. **`Open in Docs`** — visible + `aria-label` とも固定。ステージ名は載せない（Issue #30 / US-06 文言に寄せる）**推奨**
2. **`Open in Docs: <Stage Name>`** — visible にステージ名を含め、`aria-label` も同文
3. **Keep Bolt 3 `Docs: <Stage Name>`** — Bridge / StageCard とも既存ラベルを primary として昇格するだけ
4. **Other** — 具体的に記入

[Answer]: 1

---

## Q2. Excerpt 非マウントの実装方針（FR-B4-1）

API が `doc.excerpt` を返しても UI は載せない（ADR-B4-002）。どう消す？

1. **UI-only omit** — StageCard / Bridge で `docs-excerpt` Accordion（および同等）をレンダーしない。API / docs-bridge は触らない **推奨**
2. **Null at boundary** — dashboard が受けた時点で excerpt を捨ててから描画（API は残す）
3. **API stop returning excerpt** — docs-bridge / api-core からも削除（Must 超過）

[Answer]: 1

---

## Q3. Primary CTA の見た目（FR-B4-2.1）

Open in Docs を primary にする視覚・キーボード階層は？

1. **Button `default`（solid）** as primary; any remaining aids are secondary/ghost。Tab 順で CTA が docs 導線の最初の操作 **推奨**
2. **Keep `link` variant** but make it the only docs control（excerpt 除去だけで primary を満たす）
3. **Other** — 具体的に記入

[Answer]: 1

---

## Q4. Bridge vs StageCard コンポーネント分割

1. **Reuse `OpenOfficialDocLink`**（または薄い Bridge wrapper）— StageCard と Legacy Bridge で同一 emit / testid `open-official-doc` **推奨**
2. **Separate Bridge CTA component** — Bridge 専用コンポーネント；契約テストは両方必須
3. **Other**

[Answer]: 1

---

## Q5. US-B4-S1（glossary / 補助）in FD

1. **Optional aids allowed** — 残してよいが excerpt-as-article を再導入しない。欠けても Must DoD 非 Fail **推奨**
2. **Remove all secondary docs UI** — Bridge は Open in Docs のみ
3. **Defer entirely** — FD に書かず Code Generation 判断

[Answer]: 1

---

## Q6. Demo-first 検証スライス（delivery plan Q4）

1. **Fixture Demo first** — テスト／フィクスチャで non-mount + CTA emit を緑にしてから production Bridge 配線を完成 **推奨**
2. **Production path first** — ライブ Bridge を先に直し、テストは後追い
3. **Single pass** — 区別しない

[Answer]: 1
