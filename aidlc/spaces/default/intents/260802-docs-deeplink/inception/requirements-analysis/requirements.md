# Requirements — Docs i18n Bolt 3（StageCard Deep Links）

> ステージ: requirements-analysis (Inception) / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 根拠: [requirements-analysis-questions.md](./requirements-analysis-questions.md)（Looks correct）  
> 上流: [intent-statement.md](../../ideation/intent-capture/intent-statement.md) / [scope-document.md](../../ideation/scope-definition/scope-document.md) / codekb `aidlc-guide`（business-overview / architecture / code-structure）  
> 親要件: [`260730-docs-i18n` requirements.md](../../../260730-docs-i18n/inception/requirements-analysis/requirements.md) の **FR-U3.1–U3.3 を参照継承**（Q1 = A）。本ファイルは Bolt 3 差分のみを FR-B3.* / NFR-B3.* で定義する。  
> 改訂: product-lead NOT-READY（F1–F5）対応。

## Intent Analysis

Bolt 2（PR [#34](https://github.com/otomatty/aidlc-guide/pull/34)）まで Docs Shell・locale/untranslated は完成した。Bolt 3（Issue [#29](https://github.com/otomatty/aidlc-guide/issues/29)）は **ドライバーが StageCard から拡張内 Docs Shell に着地できる**よう、US-05 / FR-U3 を実装完了する。B4–B5 は対象外。

## Inherited（親要件・再仕様化しない）

| 親 ID | 要約 | Bolt 3 での扱い |
|-------|------|-----------------|
| FR-U3.1 | openOfficialDoc `{locale, path, anchor?}`、外部ブラウザなし | 継承。細部は FR-B3-1 / FR-B3-4 |
| FR-U3.2 | リンク文言は目的が分かる。bare `Docs` 禁止 | 継承。細部は FR-B3-2 |
| FR-U3.3 | 7 slug 静的 map。未登録 → Shell top | 継承。細部は FR-B3-3 |
| NFR-1 / NFR-2 | local-only / guardPath | 継承（NFR-B3-1） |

## Implementation touch points（パッケージ）

| 順 | パッケージ | Bolt 3 で担うこと |
|----|------------|-------------------|
| 1 | `packages/shared-types`（必要なら） | openOfficialDoc payload 型 |
| 2 | `packages/vscode-extension` | openOfficialDoc ホストハンドラ |
| 3 | `packages/dashboard` | StageCard OpenOfficialDocLink；Docs Shell locale deep-link |
| 4 | `packages/official-docs` | 既存 `STAGE_DOC_MAP` 利用（集合変更なし） |

## Functional Requirements

### FR-B3-1 — openOfficialDoc 契約（Must / scope M3/M4）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B3-1.1 | Dashboard（または同等）がホストへ openOfficialDoc 相当メッセージを発行する | **Mapped:** payload は `{ locale, path, anchor? }` で `path` は非空文字列。**Unmapped:** payload は `{ locale }` のみ（`path`/`anchor` キーなし、または `path` を送らない）。どちらの形も `locale` は必須（Q2 = E） |
| FR-B3-1.2 | `locale` は last-used preference、未設定時は `en` | preference 設定時はその値；未設定時は `en` |
| FR-B3-1.3 | マップ済み経路で外部ブラウザ／`target=_blank` を開かない | StageCard 活性化後、ホスト内 Docs Shell が開く（Q2 = B / Q6 = A） |
| FR-B3-1.4 | メッセージ type / コマンド名文字列は Functional Design でピン留めする | Open Question。契約形は FR-B3-1.1 |

### FR-B3-2 — リンクラベル（Must / scope M2）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B3-2.1 | StageCard の docs リンク文言はステージ名を含み、bare `Docs` alone ではない | ラベル文字列にステージ表示名が含まれる（例: `Docs: Intent Capture`）。ラベルが正確に `Docs` のみ＝Fail（Q3 = B / 親 FR-U3.2） |

### FR-B3-3 — stage→docs map（Must / scope M1/M5）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B3-3.1 | 静的 map が次の 7 slug を非空 `path`（+ 任意 `anchor`）へ解決する | `intent-capture`, `feasibility`, `scope-definition`, `rough-mockups`, `reverse-engineering`, `practices-discovery`, `requirements-analysis`（Q4 = A） |
| FR-B3-3.2 | 本 Bolt で slug 集合を増やさない | 追加は別変更 |
| FR-B3-3.3 | 未登録 slug は Docs Shell を **top** で開く | FR-B3-1.1 の Unmapped 形を発行し、Shell は path 未選択のトップ状態（Q4 = A / scope M5） |

### FR-B3-4 — Docs Shell 着地（Must / scope M3/M4）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B3-4.1 | Mapped payload の `path` でそのページを開く | Shell の表示 path = payload.path |
| FR-B3-4.2 | anchor 着地（Bolt 2 FR-B2-3 先例を本記録に内联） | (1) `anchor` あり＋見出しあり → その見出しへスクロール／フォーカス (2) `anchor` あり＋見出しなし → ページ先頭 (3) `anchor` なし → ページ先頭 |
| FR-B3-4.3 | `locale` を Shell 表示に適用する | Shell が payload.locale の言語でコンテンツを取得／表示する（コントロールの現在 locale も一致） |
| FR-B3-4.4 | deep-link は one-shot 消費する | 再レンダーで同じ target を再適用しない（Q5 = E） |

### FR-B3-5 — レガシー置換（Must / Q6）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B3-5.1 | マップ済み StageCard 経路は `docsOpenHref` / IDE `open-doc` を使わない | openOfficialDoc 経路のみ（Q6 = A） |

### FR-B3-6 — 検証（Must / Demo）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B3-6.1 | slug map・payload・unmapped→top の自動テストを `bun run check` 対象に含める | 失敗で check が赤 |
| FR-B3-6.2 | Demo: intent-capture StageCard → Docs Shell 着地 | 手動: intent-capture StageCard の docs リンク活性化後、Docs Shell が intent-capture の map path で開き、外部ブラウザが開いていないこと。E2E でも可（scope M6） |

## Non-Functional Requirements

| ID | 要件 | 優先度 | 出典 |
|----|------|--------|------|
| NFR-B3-1 | 実行時に公式 docs をネットワーク fetch しない。深リンクも拡張ホスト内で完結（親 NFR-1） | Must | Q7 = A |
| NFR-B3-2 | 受入対象サーフェスは **VS Code / Cursor 拡張**。ブラウザ副経路は Bolt 3 Fail 条件にしない | Must | rough-mockups Q5 = A |
| NFR-B3-3 | 新規 branch coverage 95% 床は必須化しない（配線が主。既存 check / Bolt 2 床は維持） | Must（否定） | Q7 = A |

## Constraints

- スタック: 既存 TypeScript / bun / Vite / React / VS Code Extension API
- locale: `en` / `ja` のみ
- ローカル専用。aidlc-workflows エンジン変更なし

## Assumptions

| ID | 内容 | 出典 |
|----|------|------|
| A1 | openOfficialDoc の最終メッセージ type / コマンド名は Functional Design で固定する（本ステージでは形のみ） | Open Question / intent |
| A2 | Docs Shell の path/anchor 着地口は Bolt 2（PR #34）で利用可能 | intent / Bolt 2 |
| A3 | 7 slug 一覧と `STAGE_DOC_MAP` の path/anchor は本 Bolt で変更しない | Q4 = A / scope |

## Out of Scope

- B4 BridgeRedirectPanel（#30）
- B5 upstream 差分レポート（#31）
- locale keep-path / missing_ja の再実装（Bolt 2 完了）
- 7 slug 以外への map 拡張
- クラウド / CMS / 実行時 fetch

## Open Questions

- openOfficialDoc の最終メッセージ type / コマンド名 → Functional Design

## Traceability

| 上流 | 本要件 |
|------|--------|
| scope M1–M6 | FR-B3-1…6 |
| 親 FR-U3.1–U3.3 | Inherited + FR-B3-* |
| intent US-05 / Issue #29 | Intent Analysis + FR-B3-* |
| codekb architecture / code-structure | Implementation touch points |
| rough-mockups Q5 = A | NFR-B3-2 |
| Q7 = A | NFR-B3-1, NFR-B3-3 |

## Review

**Reviewer:** aidlc-product-lead-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

**Findings resolved:** F1 payload mapped/unmapped shapes; F2 anchor cases inlined; F3 label testable; F4 Assumptions; F5 Consolidated Summary Confirmation. Engineering can start without returning with questions.
