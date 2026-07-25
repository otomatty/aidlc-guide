# Business Logic Model — Unit: mob-mode

> functional-design (3.1) / Unit: mob-mode (kind: service, M) / 2026-07-25
> 入力: unit-of-work.md U8 + unit-of-work-story-map.md（US-10/11/19）+ requirements.md（FR-7.1/7.2/7.3, NFR-7）+ components.md C5 + decisions.md ADR-04 + refined-mockups M-3 + dashboard-server の functional-design（U5 が既に所有する挙動）

## U5 が既に所有する挙動（本 Unit は**再実装しない**）

ADR-04 のとおり Mob モードは dashboard-server の動作モードであり、以下は **U5 の construction 成果物が実装済み**。本 Unit はこれらを再定義せず、参照のみ行う（重複実装・二重仕様を作らない）:

| 挙動 | 所有 |
|------|------|
| bind 分岐（既定 127.0.0.1 / `--host` で 0.0.0.0）と公開警告文字列の出力 | U5: dashboard-server BLM「起動シーケンス」 |
| `serverMode.hostMode` を `GET /api/workflow` に載せる | U5: dashboard-server BLM「REST ハンドラ」 |
| `--host` 中の `POST /api/answer` 無条件 403 | U5: dashboard-server BLM「AnswerWriter」step 1 / BR-DS-3 |
| 全クライアント同一の WS broadcast | U5: BR-DS-6 |

## 本 Unit が実装する差分（U8 の construction 作業範囲）

### M1: 待受アドレスの列挙と提示（US-19 の「共有すべき URL」— U5 の警告文字列を補う）

```
buildExposureNotice(port):
  1. os.networkInterfaces() から外部到達可能な IPv4（internal=false）を列挙
  2. ExposureNotice { warning: <U5 が持つ定数警告>, addresses: ["http://<ip>:<port>", …] } を構築
  3. --host 起動時に U5 の警告に続けて addresses を表示（参加者に配る URL が一目で分かる）
     loopback 起動時は addresses = ["http://127.0.0.1:<port>"] のみ
```

### M2: ReadOnlyBadge（US-11 / M-3）

```
hostMode === true のとき Header に表示: role="status" のテキストバッジ
  「READ-ONLY · 参加者ビュー」
（編集 UI の DOM 不在は artifact-viewer S-AV-2 が担当 — 本 Unit はバッジの提示のみ）
```

### M3: LiveStatus（US-10 / M-3 — 本 Unit の主要 UI 成果物）

WS 接続の健全性をユーザーに可視化する。`AppState.live`（dashboard-ui domain-entities）を唯一のデータ源とする。

| live の状態 | 表示（`role="status"` + `aria-live="polite"`） |
|------------|--------------------------------|
| `connected=false`（初回接続前） | 「接続中…」（M-3 loading） |
| `connected=true, degraded=false` | 「ライブ更新中 · 最終更新 <相対時刻>」（最終更新は直近の change 受信時刻） |
| `connected=false`（切断後・再接続待ち） | 「切断・再接続中…」（M-3 error。dashboard-ui の指数バックオフ再接続と連動） |
| `connected=true, degraded=true` | 「更新が止まっています（<reason>）」（サーバの `live-status` メッセージ由来 = reader の watch-warning 伝播） |

- 表示は**ドライバー・参加者の両方**に出す（モードで出し分けない — 双方がライブ性を知るべき）。
- 相対時刻は `Intl.RelativeTimeFormat`（dashboard-ui の tech-stack と同じ方針）。

## エラー・境界

- `--host` 起動失敗（ポート使用中・bind 権限）→ **起動エラーで終了**（黙って loopback に落とさない — U5 の bind 分岐に対する本 Unit の要求）。
- NIC 列挙に失敗しても起動は継続（addresses を空にして警告のみ表示 — 公開自体は成立している）。
- 認証は持たない（スコープ外 — トンネル公開時の認証注意は ops-guides の責務 / NFR-7）。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25 (iteration 2, final)

- **U5/U8 duplication (blocking, iteration 1) — resolved.** BLM now opens with an explicit "U5 が既に所有する挙動" table (bind branching + warning string, `serverMode.hostMode` on `GET /api/workflow`, unconditional 403 on hostMode writes, uniform WS broadcast) before any of the unit's own logic, each row citing the owning U5 artifact/rule. The unit's own delta is then unambiguous: M1 address enumeration (`buildExposureNotice`), M2 ReadOnlyBadge, M3 LiveStatus. Cross-checked against the passed `unit-of-work.md`: U8's note ("`kind: service` は「サーバ挙動（bind/broadcast/403）が作業の重心」…独立デプロイ体を意味しない") and BR-MM-4 ("参加者専用の配信経路・データ整形を作らない…実装単一化") both anticipate exactly this consolidation into U5's process — the ownership table is a legitimate resolution, not a new contradiction. `business-rules.md`'s opening note additionally preserves U8's requirement/verification ownership of the U5-implemented behaviors (BR-MM-1/2/3/5/6 + the 受入条件 E2E checks), so U8 doesn't lose its "作業の重心" scope, it just stops re-specifying algorithms U5 already owns.
- **LiveStatus underspecified (blocking, iteration 1) — resolved.** M3 now defines: the data source (`AppState.live` from dashboard-ui domain-entities, sole source of truth), all 4 states (connecting / live+lastChangeAt / reconnecting / degraded+reason) each mapped to concrete Japanese copy, the a11y contract (`role="status"` + `aria-live="polite"`), and explicit dual-surface coverage ("表示はドライバー・参加者の両方に出す"). `domain-entities.md` backs this with a `LiveStatusView` discriminated union (4 variants, 1:1 with the BLM table) and a dedicated test-boundary section (4-state derivation from `AppState.live`, plus the `role`/`aria-live` a11y assertion). Implementable without further architect input.
- **R-DS-3 citation (non-blocking, iteration 1) — resolved on visible evidence.** The malformed "R-DS-3" reference is now consistently formatted as `BR-DS-3` and `BR-DS-6` (matching the `BR-<unit>-<n>` convention this unit's own `business-rules.md` uses for `BR-MM-*`). Full existence-check against dashboard-server's actual `business-rules.md` is outside this review's pass-list (sibling-unit construction paths are hook-blocked and were not included in the dispatch); the fix as written resolves the format defect that was flagged.
- **business-rules.md constraint/own-work split — present.** The file opens with an explicit note: BR-MM-1/2/3/5/6 are "U5（dashboard-server）実装が満たすべき制約" that this unit requires and verifies (not implements), while BR-MM-4/7 and the 受入条件 section are this unit's direct work. This is consistent with the BLM ownership table and gives a developer an unambiguous read of what to build vs. what to test against.
- **Regression** — no new contradictions found. `business-rules.md`'s 受入条件 (LiveStatus 4-state check, ReadOnlyBadge `role="status"`, address list in startup output, 403 on hostMode writes, no edit DOM for participants) match 1:1 against the BLM/domain-entities specs. BR-MM-7's ops-guides cross-reference is corroborated by `unit-of-work.md` U9's responsibility line (Live Share guide's "モブ中の回答記入" section = ADR-04 tradeoff). One informational, non-blocking follow-up: M2's cross-reference to "artifact-viewer S-AV-2" for the participant edit-DOM-absence is a new sibling-unit component ID not resolvable against the passed `unit-of-work.md` (which only carries Unit-level responsibility text, no component IDs) or within this review's read scope — worth a spot-check at integration time, but U8's own acceptance criterion ("参加者ブラウザの DOM に編集要素が存在しない") does not structurally depend on that citation being correct, so it does not block this unit's design.
