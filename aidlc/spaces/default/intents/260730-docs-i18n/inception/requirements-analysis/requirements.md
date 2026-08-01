# Requirements — Docs i18n

> ステージ: requirements-analysis (Inception 2.3) / 2026-07-31  
> Intent: `260730-docs-i18n`  
> 根拠: [requirements-analysis-questions.md](./requirements-analysis-questions.md)（Looks correct）  
> 上流: [intent-statement.md](../../ideation/intent-capture/intent-statement.md) / [scope-document.md](../../ideation/scope-definition/scope-document.md) / [intent-backlog.md](../../ideation/scope-definition/intent-backlog.md) / [wireframes.md](../../ideation/rough-mockups/wireframes.md) / [team-practices.md](../practices-discovery/team-practices.md) / codekb `aidlc-guide`

## Intent Analysis

拡張内で aidlc-workflows 公式 docs（guide + reference）を **en/ja 同目次・同スタイルで切り替え**て読めるようにし（S-docs-1）、upstream 追従は差分レポート＋人手翻訳 PR で回す。社内別ドキュメントサイトは作らない。表示面は VS Code / Cursor 拡張 Webview のみ。

## Functional Requirements

優先度: Must / Should。proto-Units（Q1 = A）に対応。

### FR-U1 — Upstream snapshot ingest（Must / U1 / M5）

| ID | 要件 | 受入（要約） |
|----|------|--------------|
| FR-U1.1 | 公式 `docs/guide` + `docs/reference` の en スナップショットをモノレポに取り込む | ツリーが `docs/guide/<locale>/` / `docs/reference/<locale>/`（practices: `en`/`ja`）に存在し、版が追跡できる |
| FR-U1.2 | `sourceVersion` をリポジトリ内マニフェストに記録する | ファイル `docs/official-docs.manifest.json`（リポジトリルート相対）に JSON `{"sourceVersion":"<string>","source":"aidlc-workflows","capturedAt":"<ISO-8601>"}` があり、`sourceVersion` は空でない文字列。FR-U2.4 はこのフィールドを読む |

### FR-U2 — Bundled docs reader + locale switch（Must / U2 / M1+M2 / S-docs-1）

| ID | 要件 | 受入（要約） |
|----|------|--------------|
| FR-U2.1 | 拡張内 Docs Shell で同梱 docs をオフライン閲覧できる | 実行時に公式 docs をネットワーク fetch しない（NFR-1） |
| FR-U2.2 | 左 TOC + 右本文 + 上部言語切替／版（wireframes W1） | TOC からページ選択し本文が表示される |
| FR-U2.3 | en ↔ ja 切替で同一パスを維持し、アンカーはベストエフォート | 切替後: (1) 同一 `path` を開く (2) 対象 locale に同一 `anchor` が存在すればその見出しへスクロール／フォーカス (3) **anchor が無い場合はページ先頭へ**（locale コントロールはユーザー選択を維持）。未訳ページ自体の扱いは FR-U2.5 |
| FR-U2.4 | Docs Shell ヘッダに `sourceVersion` を常時表示 | ユーザーが現在の同梱版をヘッダで確認できる（Q3 = A） |
| FR-U2.5 | locale=ja で未訳ページのとき | **en 本文** + **可視 notice**（例: 「日本語訳はまだありません — 英語を表示しています」）+ **locale コントロールは ja のまま**（Q2 = A） |
| FR-U2.6 | API は `/api/official-docs/:locale/*` | 既存 `/api/guides`・`/api/docs-settings` と衝突しない |

### FR-U3 — Deep links from Dashboard（Must / U3 / M4）

| ID | 要件 | 受入（要約） |
|----|------|--------------|
| FR-U3.1 | 拡張内 Dashboard → Docs Shell の深リンク | 同一拡張ホスト内で: (1) Dashboard が `openOfficialDoc` 相当の postMessage／コマンドを発行し、payload は `{ locale, path, anchor? }`、(2) Docs Shell（またはホスト）がそれを受け `/api/official-docs/:locale/*` 相当で本文を開き、`anchor` があればその見出しへスクロール／フォーカスする。外部ブラウザを開かない |
| FR-U3.2 | リンク文言は目的ページが分かる | 「Docs」単独ラベル禁止（wireframes W5）。例: `Docs: Intent Capture` |
| FR-U3.3 | stage→docs 対応表 | 静的マップが少なくとも次の slug を解決する: `intent-capture`, `feasibility`, `scope-definition`, `rough-mockups`, `reverse-engineering`, `practices-discovery`, `requirements-analysis`（各 `path`＋任意 `anchor`）。未登録 slug は Docs Shell トップへフォールバック |

### FR-U4 — Docs Bridge degrade（Must / U4 / M6）

| ID | 要件 | 受入（要約） |
|----|------|--------------|
| FR-U4.1 | 旧抜粋 UI は抜粋本文を主に出さない | **Open in Docs** 誘導が主操作（Q6 = A） |
| FR-U4.2 | 本文の正本は同梱 Docs Shell | 抜粋本文を正本として新規追加しない |
| FR-U4.3 | bridge-map ナビ／用語補助（scope S2 / Should） | 既存 bridge-map の用語・ナビ用途は残してよい。新規学習者向け本文は FR-U2 に寄せる。切り下げ時は本項のみ落とせる |

### FR-U5 — Manual translation PR workflow（Must / U5 / M3）

| ID | 要件 | 受入（要約） |
|----|------|--------------|
| FR-U5.1 | ja 更新は人手レビュー可能な別 PR で行う | 継続の機械翻訳自動同梱はない（O1）。PR に `docs/**/ja/**`（または同等）の差分がレビュー対象として含まれる |
| FR-U5.2 | 初期 ja ブートストラップ | 少なくとも **1 ページ以上** の `docs/guide/ja/`（または reference）がリポジトリに存在し、locale=ja で FR-U2.2 により表示できる。以降の追従は FR-U5.1 |

### FR-U6 — Upstream diff report（Should / U6 / S1）

| ID | 要件 | 受入（要約） | 優先度 |
|----|------|--------------|--------|
| FR-U6.1 | upstream 更新の差分レポートを生成できる | レポートが翻訳 PR（FR-U5）の入口になる | **Should**（切り下げ可 — Q4 = A） |

## Non-Functional Requirements

| ID | 要件 | 優先度 | 出典 |
|----|------|--------|------|
| NFR-1 | 実行時に公式 docs を fetch しない（オフライン可読） | Must | Q5 = F / A |
| NFR-2 | bundled docs 読み取りは `guardPath` + locale コンテンツルート。**否定テスト**を `bun run check` に含める | Must | Q5 = F / B · practices Q8 |
| NFR-3 | locale 解決／コンテンツ読込モジュールは **branch coverage 95%** | Must | Q5 = F / C · practices Q2 |
| NFR-4 | Windows Git Bash + macOS でパス／起動が通る | Must | Q5 = F / D |
| NFR-5 | VSIX サイズ上限（数値） | TBD | Q5 = F / E — **後段 NFR ステージで数値化**。現時点はプレースホルダ |
| NFR-6 | VSIX に secrets / `.env` / `aidlc/` ランタイムを含めない | Must | practices package hygiene |
| NFR-7 | 初期 a11y（Docs Shell）: (1) TOC と本文がキーボードのみで辿れる (2) ページに h1、landmarks に nav+main (3) 言語切替に現在 locale の可視ラベル。WCAG 2.1 AA の完全適合は後段 | Should | rough-mockups Q6 = A / W1 a11y |

## Constraints

- 表示面: VS Code / Cursor 拡張のみ（ブラウザ副経路は対象外）
- スタック: 既存 AIDLC Guide（TS / bun / Vite / React / Extension API）
- API / ツリー: practices 肯定どおり（`en`/`ja`、`docs/guide|reference/<locale>/`、`/api/official-docs`）
- aidlc-workflows エンジン／ステージ定義は変更しない
- ローカル専用・クラウドなし

## Assumptions

- A1: M5 完了まで公式コンテンツは空になりうる — U1 が他 Must の前提
- A2: 部分 ja で S-docs-1 を満たせる（全ページ完訳は Could）
- A3: Dashboard 深リンクは拡張内 Webview を指す

## Out of Scope

- 継続的機械翻訳の自動同梱・自動公開
- 社内 CMS / 別ドキュメントサイト
- クラウド docs ホスティング
- harness-engineering 等 guide+reference 外の初期同梱
- i18n メッセージカタログ枠組みによる本文切替

## Traceability（要約）

| 成果 | FR / NFR |
|------|----------|
| S-docs-1 | FR-U2.* |
| scope M1–M6 | FR-U1–U5 |
| scope S1 | FR-U6（Should） |
| scope S2 | FR-U4.3（Should） |
| wireframes W2 未訳 | FR-U2.5 |
| practices containment / 95% | NFR-2, NFR-3 |

## Open Questions

- NFR-5 の具体的 MB 上限（NFR ステージ）
- Diff report（FR-U6）の出力形式（ファイル／PR コメント等）は Units / Functional Design で確定
- `openOfficialDoc` の最終コマンド名／メッセージ type 文字列は Functional Design で固定（契約形は FR-U3.1）

## Review

**Reviewer:** aidlc-product-lead-agent  
**Verdict:** READY  
**Date:** 2026-07-31

### What holds

**FR-U2.3 (anchor fallback):** Now testable to three distinct conditions — (1) same path opened, (2) anchor exists in target locale → scroll/focus, (3) anchor absent → page top. Locale control persistence stated. Cross-reference to FR-U2.5 for the untranslated-page case is correct and avoids duplication. QA can write three separate test cases from this cell.

**FR-U3.3 (named stage slugs):** All seven slugs enumerated explicitly (`intent-capture`, `feasibility`, `scope-definition`, `rough-mockups`, `reverse-engineering`, `practices-discovery`, `requirements-analysis`). Fallback for unregistered slugs → Docs Shell top is stated. Engineering can build the static map and QA can enumerate the matrix.

**Remainder of artifact:**
- FR-U1.2: JSON schema specified (field names + types). FR-U2.4 consumer cross-ref present. Testable.
- FR-U2.5: Three conditions (en body + visible notice + locale=ja maintained) — each independently assertable.
- FR-U3.1: postMessage payload shape `{ locale, path, anchor? }` given. No-external-browser constraint stated. Final command name appropriately deferred to Functional Design (Open Question).
- NFR-2/3: `bun run check` negative test hook named; 95% branch coverage threshold is a number QA can check.
- NFR-7: Three a11y conditions enumerated; WCAG 2.1 AA full conformance correctly deferred.
- Open Questions scope-contain the three genuinely unresolved items (VSIX size, diff-report format, command name) to downstream stages without blocking engineering start.
- Traceability row covers every scope milestone (M1–M6, S1, S2, S-docs-1, W2, W5).

### Minor observation (not a blocker)

FR-U2.3 row header reads "アンカーはベストエフォート" while the acceptance cell is now precise (try → fallback to top). The row header label is cosmetically imprecise but the acceptance criteria — which is what QA and engineering read — is unambiguous. Fix in a future pass if desired; does not block engineering start.

**Engineering can start without returning with questions.**


