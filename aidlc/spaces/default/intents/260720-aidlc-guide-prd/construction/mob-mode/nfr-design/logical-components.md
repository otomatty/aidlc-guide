# Logical Components — Unit: mob-mode

> nfr-design (3.3) / Unit: mob-mode / 2026-07-25
> 入力: functional-design（U5 所有表 + M1〜M3）+ 本ステージ設計文書

## モジュール構成（U5/U6 の既存パッケージへの追加ファイル — 新パッケージを作らない）

> **Unit 名とパッケージ名の対応**（application-design components.md の7パッケージ構成どおり）:
> U5 `dashboard-server` = `packages/dashboard-server` / U6 `dashboard-ui` = **`packages/dashboard`**（SPA 本体）。
> 以下のパス表記はパッケージ名基準。

| モジュール | 配置 | 責務 | 実装所有 |
|-----------|------|------|---------|
| `exposure-notice.ts` | packages/dashboard-server/src/ | `buildExposureNotice(port)`: NIC 列挙 → `ExposureNotice`（失敗時 addresses 空 — R-MM-2）。U5 の警告定数を import して束ねる | 本 Unit |
| `ReadOnlyBadge.tsx` | packages/dashboard/src/components/ | `hostMode` で表示する `role="status"` バッジ（M2） | 本 Unit |
| `LiveStatus.tsx` | packages/dashboard/src/components/ | `live` slice → `LiveStatusView` 導出 → 4状態表示（`role="status"` + `aria-live="polite"`、M3） | 本 Unit |
| `liveStatusView.ts` | packages/dashboard/src/store/ | `AppState.live` → `LiveStatusView` の純関数（R-MM-3 の嘘防止をここで型保証） | 本 Unit |
| （既存）`server.ts` の bind 分岐 / AnswerWriter モードゲート / WS broadcast | packages/dashboard-server/src/ | — | **U5**（本 Unit は変更しない） |

## データフロー

```
起動（U5 serve, host=true / packages/dashboard-server）
  └ exposure-notice.buildExposureNotice(port) → U5 警告定数 + addresses を stdout

ブラウザ（U6 dashboard-ui = packages/dashboard のツリー内）
  ├ Header → ReadOnlyBadge（serverMode.hostMode が true のとき）
  └ Header → LiveStatus ← liveStatusView(AppState.live)
```

本 Unit は**新パッケージ・新プロセスを作らない**（ADR-04）。追加するのは上記4ファイルのみで、既存の U5 サーバ挙動には手を入れない。テスト: exposure-notice（列挙・失敗時）/ liveStatusView（4状態）/ 2コンポーネントの RTL（role・文言）+ 受入条件の E2E（business-rules）。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25

- **Finding 1 (iteration 1: `packages/dashboard/...` vs. `dashboard-ui` naming) — RESOLVED.** The new mapping note (lines 8-10) states U5 `dashboard-server` = `packages/dashboard-server` and U6 `dashboard-ui` = `packages/dashboard`. Cross-checked directly against the canonical contract, `inception/application-design/components.md` lines 16-17 and the C5/C6 headers (lines 55, 61): the 7-package list is `dashboard-server/` and `dashboard/` — there is no package literally named `dashboard-ui` anywhere in that contract. `dashboard-ui` is the unit name, `dashboard` is the package name, and the mapping note now states this explicitly. The prior finding's premise (an inconsistent package name) does not hold once unit-name vs. package-name is disambiguated; the note removes the ambiguity a developer would otherwise hit.
- **Internal consistency of module paths.** All five rows of the module table use `packages/dashboard-server/src/` or `packages/dashboard/src/...`, matching the mapping note one-for-one. No row uses `dashboard-ui` as a path segment.
- **Dataflow labels.** The dataflow block's parentheticals ("U5 serve, host=true / packages/dashboard-server", "U6 dashboard-ui = packages/dashboard のツリー内") consistently pair the unit id with its mapped package name, matching the table above it.
- **Sibling precedent check.** Reading `construction/dashboard-ui/nfr-design/logical-components.md` for the stated precedent was correctly refused by the reviewer-scope hook (sibling-unit path outside this unit's dispatch). This does not block verdict: `components.md` is the authoritative shared contract for package naming and is sufficient on its own to confirm the mapping note is accurate.
- **Regression.** No new contradictions found: ownership boundaries (U5 owns bind/AnswerWriter/broadcast, unchanged by this unit), the "no new package/process" constraint, and the four-file addition scope are all stated once and used consistently throughout the document.

**Disposition:** The sole prior finding is resolved with checkable evidence against the shared contract. No new issues found within scope. READY.
