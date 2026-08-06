# Requirements — Docs i18n Bolt 4（Bridge Degrade）

> ステージ: requirements-analysis (Inception) / 2026-08-03  
> Intent: `260802-docs-bridge`  
> 根拠: [requirements-analysis-questions.md](./requirements-analysis-questions.md)（Looks correct）  
> 上流: [intent-statement.md](../../ideation/intent-capture/intent-statement.md) / [scope-document.md](../../ideation/scope-definition/scope-document.md) / codekb `aidlc-guide` / [team-practices.md](../practices-discovery/team-practices.md)  
> 親・先行: [`260730-docs-i18n`](../../../260730-docs-i18n/inception/requirements-analysis/requirements.md) / [`260802-docs-deeplink` FR-B3.*](../../../260802-docs-deeplink/inception/requirements-analysis/requirements.md) を **参照継承**（Q1 = A）。本ファイルは Bolt 4 差分のみを FR-B4.* / NFR-B4.* で定義する。  
> 追跡: Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)

## Intent Analysis

Bolt 3 まで StageCard → `open-official-doc` → Docs Shell は成立した。Bolt 4 は **Legacy Bridge / StageCard の excerpt 正本体験をやめ、Open in Docs を一次導線にする**（US-06）。正本は同梱 Docs のみ。US-09 glossary は Should（切下げ可）。

## Inherited（再仕様化しない）

| 先行 ID | 要約 | Bolt 4 での扱い |
|---------|------|-----------------|
| FR-B3-1 / open-official-doc | `{ locale, path?, anchor? }`、外部ブラウザなし | **再利用**（FR-B4-2）。再実装しない |
| FR-B3-4 Docs Shell 着地 | path/anchor/locale/one-shot | 継承 |
| NFR-B3-1 local-only | 実行時 fetch なし | 継承（NFR-B4-1） |
| team-practices Testing | US-06 UI/契約テストを `bun run check` に | NFR-B4-2 |

## Implementation touch points（パッケージ）

| 順 | パッケージ | Bolt 4 で担うこと |
|----|------------|-------------------|
| 1 | `packages/dashboard` | StageCard / Legacy Bridge: excerpt 非マウント；Open in Docs primary CTA |
| 2 | `packages/vscode-extension` | 既存 `open-official-doc` ハンドラを CTA が叩く（変更最小） |
| 3 | `packages/docs-bridge` | excerpt API は残ってよいが **製品 UI はマウントしない** |
| 4 | `packages/shared-types` | 既存 open-official-doc 型を再利用 |

## Functional Requirements

### FR-B4-1 — excerpt 非マウント（Must / scope M1）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B4-1.1 | Legacy Bridge / StageCard の公式 docs 導線 UI で、`doc.excerpt` を記事本文としてマウントしない | `data-testid="docs-excerpt"`（または同等）が表示されない。スクリーンリーダーが Bridge 上で正本記事を読まない（Q2 = A / Q4 = A） |
| FR-B4-1.2 | excerpt 非マウントは Must DoD。API が excerpt を返しても UI は載せない | UI 契約で Fail を判定（バックエンド削除は必須でない） |

### FR-B4-2 — Open in Docs primary CTA（Must / scope M2）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B4-2.1 | Open in Docs（最終文言は FD）が **primary** CTA である | 視覚的・キーボード双方で主操作。二次のみ＝Fail（Q2 = B） |
| FR-B4-2.2 | CTA 活性化は Bolt 3 の `open-official-doc` ホスト契約を発行する | message type は既存 `open-official-doc`；payload 形は FR-B3-1.1 に準拠（Q2 = C） |
| FR-B4-2.3 | マップ済み／未マップとも外部ブラウザを開かない | Docs Shell 内着地（FR-B3-1.3 継承） |
| FR-B4-2.4 | 文言・アクセシブルネームの最終文字列は Functional Design でピン留め | 本要件は契約意図のみ（Q5 = A） |

### FR-B4-3 — Demo / 検証（Must / scope M3）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B4-3.1 | Demo: Legacy Bridge → Open in Docs → Docs Shell | 手動（または E2E）: Bridge から活性化後、Shell が開き外部ブラウザが開かない。「正本は同梱 Docs のみ」が示せる（Q2 = D） |
| FR-B4-3.2 | US-06 の UI/契約自動テストを `bun run check` に含める | excerpt 非マウント + CTA→`open-official-doc` の失敗で check が赤（Q6 = A / team-practices） |

### FR-B4-4 — US-09 glossary / 補助（Should）

| ID | 要件 | 受入 |
|----|------|------|
| FR-B4-4.1 | glossary / 補助 UI は残ってよい | Should。欠けても FR-B4-1…3 が満たせば Bolt 4 完了（Q3 = A） |
| FR-B4-4.2 | US-09 を Must DoD に含めない | 切下げ可 |

## Non-Functional Requirements

| ID | 要件 | 優先度 | 出典 |
|----|------|--------|------|
| NFR-B4-1 | 実行時に公式 docs をネットワーク fetch しない。CTA も拡張ホスト内で完結 | Must | Q6 = A |
| NFR-B4-2 | US-06 UI/契約テストを `bun run check` に含める。新規 branch coverage 95% 床は **新設しない** | Must | Q6 = A |
| NFR-B4-3 | 受入対象サーフェスは **VS Code / Cursor 拡張** Webview | Must | rough-mockups Q5 = A |

## Constraints

- スタック: 既存 TypeScript / bun / Vite / React / VS Code Extension API
- 並行の別着地口を増やさない（`open-official-doc` 再利用）
- ローカル専用。aidlc-workflows エンジン変更なし

## Assumptions

| ID | 内容 | 出典 |
|----|------|------|
| A1 | Bolt 3 の `open-official-doc` / Docs Shell 着地は利用可能 | intent / CodeKB TX-3b |
| A2 | Open in Docs 最終文言・a11y ネームは Functional Design で固定 | Q5 = A |
| A3 | US-09 切下げでも US-06 DoD だけで Bolt 4 完了 | Q3 = A / scope S1 |

## Out of Scope

- B3 deep-link / StageCard 経路の再実装（#29）（Q7 = A）
- B5 upstream 差分レポート（#31）（Q7 = B）
- locale/untranslated 再実装（Q7 = C）
- ターミナル注入・会話スレッド投稿・クラウドホスティング・workflows 変更（Q7 = D）
- 新規ルーティングライブラリ

## Open Questions

- Open in Docs の最終表示文言 / アクセシブルネーム → Functional Design

## Traceability

| 上流 | 本要件 |
|------|--------|
| scope M1–M3 / S1 | FR-B4-1…4 |
| intent US-06 / Issue #30 | Intent Analysis + FR-B4-* |
| intent US-09 Should | FR-B4-4 |
| FR-B3-1 / open-official-doc | FR-B4-2 再利用 |
| codekb architecture TX-3b / StageCard excerpt | Implementation touch points |
| team-practices Testing Posture Q2 | NFR-B4-2 / FR-B4-3.2 |

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY  
**Date:** 2026-08-03  
**Note:** Inline review (Task API limit previously); checklist applied.

### What holds

- Must FR-B4-1…3 cover Q2=E / scope M1–M3 with testable acceptance.
- US-09 kept Should (FR-B4-4) — not a Must-fail.
- open-official-doc reuse explicit; no parallel landing (Q4/Q5).
- Out of Scope matches Q7=E.
- Traceability to intent-statement, scope-document, codekb, team-practices.
