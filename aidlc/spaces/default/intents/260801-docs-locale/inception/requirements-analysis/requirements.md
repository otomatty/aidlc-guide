# Requirements — Docs i18n Bolt 2（Locale + Untranslated）

> ステージ: requirements-analysis (Inception) / 2026-08-01  
> Intent: `260801-docs-locale`  
> 根拠: [requirements-analysis-questions.md](./requirements-analysis-questions.md)（Looks correct）  
> 上流: [intent-statement.md](../../ideation/intent-capture/intent-statement.md) / [scope-document.md](../../ideation/scope-definition/scope-document.md) / codekb `aidlc-guide`（business-overview / architecture / code-structure）  
> 親要件: [`260730-docs-i18n` requirements.md](../../../260730-docs-i18n/inception/requirements-analysis/requirements.md) の **FR-U2.3 / FR-U2.5 / NFR-3 を参照継承**（Q1 = A）。本ファイルは Bolt 2 差分のみを FR-B2.* / NFR-B2.* で定義する。  
> 改訂: product-lead NOT-READY（F1–F7）対応 — keep-path 条件、パッケージ境界、既存 wire 契約の固定。

## Intent Analysis

Bolt 1（PR [#26](https://github.com/otomatty/aidlc-guide/pull/26)）で同梱 Docs Shell・locale 制御の縦スライスは成立した。Bolt 2（Issue [#28](https://github.com/otomatty/aidlc-guide/issues/28)）は **部分 `ja` でも S-docs-1 が成立する**よう、keep-path・未訳 notice・欠落アンカー・coverage 床を契約どおり実装完了する。B3–B5 と workflow live sync（#33）は対象外。

## Inherited（親要件・再仕様化しない）

| 親 ID | 要約 | Bolt 2 での扱い |
|-------|------|-----------------|
| FR-U2.3 | en↔ja で同一 path。anchor あれば移動、無ければページ先頭。locale コントロールは維持 | 継承。細部は FR-B2-1 / FR-B2-3 |
| FR-U2.5 | locale=ja で未訳時: en 本文 + 可視 notice + locale は ja | 継承。細部は FR-B2-2 / FR-B2-4 |
| NFR-3 | locale 解決／コンテンツ読込の branch coverage 95% | 継承。対象範囲は NFR-B2-1 |

## Implementation touch points（パッケージ）

論理 Unit 名 `docs-shell` は UI 境界の呼び名。実装パッケージは次（scope Sequencing + codekb）:

| 順 | パッケージ | Bolt 2 で担うこと |
|----|------------|-------------------|
| 1 | `packages/official-docs` | locale 解決、missing_ja、anchorApplied、coverage 床の対象 |
| 2 | `packages/shared-types` | `OfficialDocsPage` wire 契約の維持（破壊的リネーム禁止） |
| 3 | `packages/api-core` | `/api/official-docs` が `OfficialDocsPage` をそのまま返す |
| 4 | `packages/dashboard` | Docs Shell UI: locale 切替、notice 表示、anchor スクロール／先頭 |
| 5 | `packages/vscode-extension` | 拡張ホスト上で Docs Shell を開く経路（受入シナリオの実行面） |

## Functional Requirements

### FR-B2-1 — keep-path 切替（Must / scope M1）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B2-1.1 | ユーザーが Docs Shell で en↔ja を切り替えたとき、**ドキュメント相対 path は変わらない**。対象 locale にファイルが無くても path は維持し、未訳は FR-B2-2 に従う | Given path `P` を表示中 When locale を `en`↔`ja` に切り替える Then 応答／ビューの `path` は `P` のまま（「存在すれば」条件は付けない） |
| FR-B2-1.2 | 切替後、両 locale の TOC に path `P` が存在するとき、TOC 選択は `P` をハイライトしたまま | Given 両 TOC に `P` がある When locale を切り替える Then TOC 選択は `P` |
| FR-B2-1.3 | 片方の locale TOC にだけ `P` があるとき | path `P` の本文ビューは維持する（FR-B2-1.1）。TOC ハイライトは「`P` が現 TOC にあれば選択、無ければ選択なし（本文は `P` のまま）」とする |
| FR-B2-1.4 | 検索クエリや一時 UI 状態は keep-path の対象外 | 追従を要求しない（Q4 = E） |

### FR-B2-2 — missing-ja notice（Must / scope M2）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B2-2.1 | `localeRequested=ja` で `ja` 本文が無いとき、**en 本文**を返す／表示する | `localeServed=en` かつ `bodyMarkdown` は en。`notice="missing_ja"` |
| FR-B2-2.2 | そのとき**可視 notice**で未訳であることが意味として分かる | `notice="missing_ja"` のとき UI がバナー等を表示する（文言コピーは実装可） |
| FR-B2-2.3 | notice コンテナは `role="status"`（または同等の live region）を持つ | DOM / a11y ツリーで確認できる |
| FR-B2-2.4 | locale コントロール／現在 locale 表示は **ユーザー選択の `ja`（= localeRequested）のまま** | UI が `localeServed` に引きずられてコントロールを `en` に切り替えない |
| FR-B2-2.5 | 該当ページ表示中は notice を常時表示してよい。dismiss しても同一セッションの再訪で再表示してよい | dismiss 永続化は不要（Q3 = A） |

### FR-B2-3 — missing-anchor フォールバック（Must / scope M3）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B2-3.1 | リクエストに `#anchor` があり、本文見出しに存在する場合 | `anchorApplied="scrolled"`。UI はその見出しへスクロール／フォーカス |
| FR-B2-3.2 | `#anchor` があるが本文見出しに無い場合 | `anchorApplied="top"`。UI は**ページ先頭**へフォールバック |
| FR-B2-3.3 | anchor フォールバック後も locale コントロールはユーザー選択を維持する | 親 FR-U2.3 の第三条件。`localeRequested` が変わらない |

### FR-B2-4 — 既存 wire 契約が一次情報源（Must / Q5）

Bolt 2 は新規フィールド名を発明せず、既存 `OfficialDocsPage`（`packages/shared-types`）を正とする。

| ID | 要件 | 受入 |
|----|------|------|
| FR-B2-4.1 | `/api/official-docs/:locale/*`（または同等）は `OfficialDocsPage` を返す | 必須フィールド: `localeRequested`, `localeServed`, `path`, `bodyMarkdown`, `sourceVersion`, `anchorApplied`。未訳時は `notice: "missing_ja"` |
| FR-B2-4.2 | Docs Shell（`dashboard`）は上記フィールドを表示するだけである | 未訳判定を HTTP 404 推測やフロント独自フラグで再実装しない。`notice === "missing_ja"` で notice UI を出す |
| FR-B2-4.3 | 破壊的リネーム（例: `notice` → `untranslated`）は Bolt 2 で行わない | 既存テスト（`official-docs` / `dashboard`）が同一フィールド名で通る |

### FR-B2-5 — 検証（Must / Q10）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B2-5.1 | NFR-B2-1 の coverage 床と missing_ja / anchor 分岐テストは `bun run check` で自動検証される | 床未達または分岐テスト失敗で check が失敗する |
| FR-B2-5.2 | 拡張 Docs Shell で keep-path / missing-ja notice / missing-anchor の手動シナリオを実施する | PR または成果物に実施記録。スクリーンショットは任意 |

## Non-Functional Requirements

| ID | 要件 | 優先度 | 出典 |
|----|------|--------|------|
| NFR-B2-1 | 次のモジュール群で **branch coverage ≥ 95%** を `bun run check` に組み込む: `packages/official-docs/src/resolve.ts`, `packages/official-docs/src/roots.ts`, `packages/official-docs/src/markdown.ts`（heading / anchor 判定）。カバレッジ設定の glob がこれらを含むこと | Must | Q6 = A / scope M4 / 親 NFR-3 |
| NFR-B2-2 | 実行時に公式 docs をネットワーク fetch しない（親 NFR-1 継承） | Must | codekb / 親 |
| NFR-B2-3 | 受入対象サーフェスは **VS Code / Cursor 拡張の Docs Shell のみ**。ブラウザ / Mob LAN は Bolt 2 Fail 条件にしない | Must | Q7 = A |

## Should（切り下げ可）

| ID | 要件 | 受入 | 出典 |
|----|------|------|------|
| FR-B2-S1 | Docs Shell 本文ビューで、表示中ページのタイトル相当が見出しレベル 1（`h1`）としてマークアップされる | 少なくとも Docs Shell で開いた公式ページ本文の先頭タイトルが `h1`（または aria 同等）であること。ページ列挙の完全リストは求めない。未達でも Bolt 2 Must Fail にはしない | Q8 = A / scope S1 |

## Constraints

- スタック: 既存 TypeScript / bun / Vite / React / VS Code Extension API
- locale コード: `en` / `ja` のみ
- ローカル専用。クラウド / CMS / 実行時 fetch なし
- aidlc-workflows エンジン／ステージ定義は変更しない
- Wire: `OfficialDocsPage` / `OfficialDocsPageNotice = "missing_ja"` を維持

## Assumptions

- A1: Bolt 1 の同梱ツリー・API パス・locale コードは変更しない
- A2: 部分 `ja` で S-docs-1 を満たせる（全ページ完訳は不要）
- A3: notice の最終コピーライティングは実装で確定してよい（意味は `notice="missing_ja"`）

## Out of Scope

| ID | 内容 | 出典 |
|----|------|------|
| O1 | StageCard → Docs 深リンク（B3 / #29） | Q9 = E |
| O2 | BridgeRedirectPanel（B4 / #30） | Q9 = E |
| O3 | upstream 差分レポート本番化（B5 / #31） | Q9 = E |
| O4 | ダッシュボード workflow live sync 修正（Issue #33） | Q9 = E |
| O5 | 機械翻訳の自動同梱・社内 CMS・クラウド docs ホスティング | 親 / scope |

## Traceability

| 上流 | 本要件 |
|------|--------|
| intent S-docs-1 / scope M1 | FR-B2-1 |
| intent / scope M2 | FR-B2-2 |
| intent / scope M3 | FR-B2-3 |
| scope M4 / 親 NFR-3 | NFR-B2-1 |
| scope Sequencing (official-docs → api-core → dashboard) | Implementation touch points |
| scope S1 | FR-B2-S1（Should） |
| codekb architecture / code-structure | パッケージ配置・拡張第一 |
| 親 FR-U2.3 / FR-U2.5 / NFR-3 | Inherited 表 |
| shared-types `OfficialDocsPage` | FR-B2-4 |

## Open Questions

- notice の日本語／英語コピー最終文は実装で確定してよい（意味要件は FR-B2-2.2）
- NFR-B2-1 の coverage 設定キー名（vitest/c8 等）は Construction の ci-pipeline / build-and-test で既存 `check` に合わせる

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY  
**Date:** 2026-08-01

### What holds

**F1–F7 remediation:** All prior NOT-READY findings addressed in this revision. Keep-path no longer hedged; package touch points explicit; wire contract fixed to existing `OfficialDocsPage`; anchor fallback includes locale persistence; asymmetric TOC covered; coverage scoped to named files; Should h1 criterion is per-page testable.

**FR-B2-1 (keep-path):** FR-B2-1.1 maintains path `P` regardless of target-locale file presence, with missing content delegated to FR-B2-2. FR-B2-1.2 and FR-B2-1.3 give QA three distinct TOC cases (both locales, one locale only, search/UI excluded). Each is independently assertable.

**FR-B2-2 (missing-ja):** Acceptance criteria use wire fields (`localeRequested`, `localeServed`, `notice: "missing_ja"`) that match `packages/shared-types`. Visible notice, `role="status"`, and locale-control persistence are separate ACs. QA can assert API + DOM without guessing copy.

**FR-B2-3 (anchor):** Three outcomes map to `anchorApplied` enum (`scrolled`, `top`, plus inherited `none` when no anchor). FR-B2-3.3 closes the parent FR-U2.3 third condition gap from the prior review.

**FR-B2-4 (wire contract):** Brownfield-first — no invented field names. Required field list matches `OfficialDocsPage`. FR-B2-4.2 and FR-B2-4.3 make “UI displays, does not infer” reviewable and regression-testable against existing `official-docs` / `dashboard` tests.

**NFR-B2-1:** File-scoped coverage target removes ambiguity from the prior “module” wording. Engineering knows exactly what `bun run check` must enforce.

**Scope / traceability:** B3–B5 and Issue #33 remain in Out of Scope. Traceability table links M1–M4, scope Sequencing, parent FRs, and `shared-types`. Inherited table avoids duplicating parent FR-U2.3 / FR-U2.5 / NFR-3.

### Residual observations (non-blocking)

- **Open Question (coverage config key):** vitest/c8 key naming deferred to Construction — appropriate; does not block Functional Design or implementation start.
- **FR-B2-2.5 dismiss UI:** Still optional (Q3 = A). AC covers behavior *if* dismiss exists; vacuously satisfied if static banner only. Consistent with Q&A; not a Must gap.
- **FR-B2-S1 (Should):** Per-page manual check on any opened doc page — sufficient for a non-fail Should.

**Engineering can start without returning with questions.**
