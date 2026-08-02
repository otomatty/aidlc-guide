# Functional Design — Unit: docs-shell

> ステージ: functional-design (Construction) / unit: **docs-shell** (ui)  
> Intent: `260801-docs-locale`（製品 Bolt 2）  
> 上流: [unit-of-work.md](../../../inception/units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [components.md](../../../inception/application-design/components.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [services.md](../../../inception/application-design/services.md)  
> 姉妹 unit FD: `../official-docs/functional-design/`（wire 契約は消費のみ・再仕様化しない）  
> 推奨セット: **全問 A**（application-design / stories と一致）

---

## Q1. LocaleControl / keep-path 表示

locale 切替後の path・コントロール表示は？

- A. `setLocale` 後もレスポンスの `path` を表示し続け、コントロールは常に `localeRequested`（`localeServed` に引きずられない）。FR-B2-1 / US-B2-01 / `syncLocaleControl`
- B. 未訳時はコントロールを `localeServed=en` に合わせてよい
- X. その他（具体的に記入）

[Answer]:

## Q2. missing_ja notice

- A. バナーは `page.notice === "missing_ja"` のときだけ。`role="status"`（または同等 live region）。色だけに依存しない。404/error envelope からは絶対に出さない（ADR-B2-001 / FR-B2-2 / US-B2-02）
- B. HTTP 404 からも「未訳かも」と推測してよい
- X. その他（具体的に記入）

[Answer]:

## Q3. TOC highlight

- A. `syncTocHighlight(toc, path)`: TOC ノード `path ===` 現在 page `path` なら選択、無ければ選択クリア。body path は `resolvePage` 側のまま（FR-B2-1.2/1.3）
- B. ja TOC が疎なら en TOC でハイライト補完する
- X. その他（具体的に記入）

[Answer]:

## Q4. anchor / focus

- A. `applyAnchor`: `scrolled` → 見出しへ focus/scroll；`top` → h1/main 先頭；`none` → 強制ジャンプなし（FR-B2-3 / US-B2-01）
- B. `top` は何もしない（ブラウザ既定任せ）
- X. その他（具体的に記入）

[Answer]:

## Q5. Fetch error UI

- A. `renderFetchError`: 404→not_found、400→path-rejected、503→empty/unavailable。いずれも missing_ja バナー禁止。empty_content の HTTP は **503**（component-methods 既定）
- B. empty_content は 404 に寄せる
- X. その他（具体的に記入）

[Answer]:

## Q6. Component hierarchy（frontend-components 向け）

- A. Docs Shell 内: LocaleControl · NoticeBanner · TocPanel · BodyView ·（Should）TitleH1。api-core 経由の wire のみ。`@aidlc-guide/official-docs` 直接 import 禁止
- B. dashboard から official-docs を直接呼んでよい
- X. その他（具体的に記入）

[Answer]:

## Q7. US-B2-S1 / 手動シナリオ

- A. h1（Should）は polish として設計に含めるが Must DoD 非失敗。手動シナリオ（keep-path / missing_ja notice / missing-anchor→top）は拡張 Docs Shell で記録（FR-B2-5.2 / US-B2-03）
- B. h1 と手動シナリオは本 unit FD から外す
- X. その他（具体的に記入）

[Answer]:

---

## Interaction mode

How would you like to answer these questions?

- A. Guide me — walk through each question interactively
- B. I'll edit the file — fill answers in the file, then say **done**
- C. Chat — discuss freely; extract decisions from conversation
- D. Accept recommended (all A) — adopt the recommended set, then confirm summary

[Answer]:

## Consolidated Summary Confirmation

[Answer]:
