# Business Logic Model — Unit: dashboard-server

> functional-design (3.1) / Unit: dashboard-server (kind: service, M) / 2026-07-24
> 入力: unit-of-work.md U5 + unit-of-work-story-map.md + requirements.md（FR-4/6/7, NFR-1/2/3/7）+ components.md C5 + component-methods.md（API 表）+ services.md（段階的初回描画）

## 起動シーケンス

```
serve(opts: {port, host?: boolean}):
  1. dist/ 存在チェック（packages/dashboard/dist/）→ 不在: 起動エラー「先に build:dashboard を実行」exit 1
  2. reader = createReader(workspaceRoot) / bridge = createBridge()
  3. bind: host 指定なし → 127.0.0.1（既定）/ --host → 0.0.0.0 + 公開警告を stdout
     警告文（US-19）: 「LAN に公開します: レンダリングされた aidlc 成果物・監査内容
     （ユーザーが貼り付けた秘密を含み得る）が同一ネットワークの全端末から閲覧可能になります」
  4. 第1段: HTTP/WS listen 開始（この時点で /api/workflow 応答可能 — state 1枚パースのみ）
  5. 第2段: 背景で reader.getMatrix()（全走査）→ 完了で WS broadcast {type:"matrix-ready", matrix}
  6. reader.watch() 購読 → 変更を scope 別に処理（下記）
```

## 変更伝搬（NFR-3 経路）

```
watch cb:
  {type:"change", scope:"state"}        → getWorkflow + getNextStep 再取得 → WS broadcast {type:"change", scope, workflow, nextStep}（WsMessage 契約どおり — NextStepCallout のライブ更新 FR-4.6）
  {type:"change", scope:"matrix:<u>"}   → buildMatrixForUnit(u) → WS broadcast {type:"change", scope, cells}
  {type:"change", scope:"audit"}        → getAuditEvents 再取得 → WS broadcast {type:"change", scope, events}
  {type:"watch-warning"}                → WS broadcast {type:"live-status", degraded:true, reason}
```

## AnswerWriter — 唯一の書込経路（FR-6.2 / US-14 / NFR-1）

```
POST /api/answer {file, line, value}:                    ← フィールド名は component-methods.md の契約どおり
  1. モードゲート: --host 起動中は無条件 403 {error:"read-only-mode"}（US-11 — 参加者/ドライバー区別なし、ADR-04）
  2. ファイル名ゲート: basename が *-questions.md パターンでなければ 403 {error:"not-a-questions-file"}
  3. パスゲート: reader-core が named export する `guardPath` 純関数（nfr-design S-RC-2 で
     readArtifact 専用でなく再利用可能な util として設計・公開されるもの）で記録配下のみ許可 →
     403 {error:"outside-record"}
  4. 行ゲート: 対象 line の行が /^\[Answer\]:/ で始まらなければ 403 {error:"not-an-answer-line"}
  5. 検証つき置換の構築（**書込前**）: 元バイト列を保持したまま対象行のみオフセット置換で
     `[Answer]: <value>` に差し替えた新バイト列を構築し、対象行以外のバイト列が完全一致する
     ことを assert（改行コード・BOM を保存 — 行分割・再結合をしない）。不一致は 500
     {error:"write-verification-failed"} で**書き込まない**（BR-DS-7）
  6. コミット: 検証済み新バイト列を tmp ファイルへ全文書き → rename で atomic 置換
     （書きかけ状態を晒さない）
  7. 成功: {ok} → watch が変更を検知し通常の伝搬経路で全クライアントに反映
```

## REST ハンドラ（component-methods.md の表を実装）

- `GET /api/workflow` → reader.getWorkflow() + reader.getNextStep() + **`serverMode: { hostMode: boolean }`**（第1段 — Matrix 含まない。hostMode は `--host` 起動中を示し、クライアントが編集 UI を DOM から外す判断に使う [US-11 の二重防御の片翼。サーバ側 403 が最終防衛線]）
- `GET /api/matrix` → 構築済みキャッシュ or {building:true}
- `GET /api/artifact?path=` → reader.readArtifact()（guard 二重化）
- `GET /api/stage/:slug` → bridge.resolveStage()
- `GET /api/glossary/:term` → bridge.resolveTerm()
- `GET /api/links` → bridge.projectLinks()
- 静的: それ以外のパスは dist/ から配信（SPA fallback → index.html）

ReadResult → HTTP 写像: {ok}→200 / {unsupported}→200 + unsupported ペイロード（UI が解析不可表示 — 500 にしない） / {error}→200 + error ペイロード（入口級のみ 404/403 相当を使い分け: outside-record→403, artifact-not-found→404, no-active-intent→200+empty ペイロード）

## Review

**Verdict:** READY

Re-verification of the 4 defects + 1 minor from iteration 1, plus a regression pass. Evidence:

1. **AnswerWriter verify-before-commit ordering (was: verify-after-commit) — FIXED.** Steps are now correctly sequenced: step 5 "検証つき置換の構築（**書込前**）" builds the new byte sequence and asserts full byte-invariance outside the target line *before* any write, with explicit "不一致は 500 {error:"write-verification-failed"} で**書き込まない**" (business-logic-model.md:39-42); step 6 "コミット: 検証済み新バイト列を tmp ファイルへ全文書き → rename で atomic 置換" only runs after verification passes (:43-44). BR-DS-7 restates the same order ("atomic write...byte-invariance 検証を書込前に実施。検証失敗は 500 で書き込まない", business-rules.md:16). Domain-entities.md's test-boundary list ("byte-invariance golden + atomic rename", domain-entities.md:34) matches this order.

2. **guardPath named-export citation — PARTIALLY VERIFIED, one side out of technical reach.** business-logic-model.md step 3 now explicitly cites the cross-unit integration point: "reader-core が named export する `guardPath` 純関数（nfr-design S-RC-2 で readArtifact 専用でなく再利用可能な util として設計・公開されるもの）" (business-logic-model.md:36-37) — this resolves the dashboard-server-side half of the original defect (no longer inventing an unnamed/undocumented reader-core function). I attempted the sibling spot-check on `construction/reader-core/nfr-design/logical-components.md` per the task's READ SCOPE, but the reviewer-scope hook refused it as a sibling-unit read not on the dispatch exempt list. I could not independently confirm from reader-core's own artifact that it documents this export for this consumer; that confirmation belongs to reader-core's own review pass or must be added to this pass's exempt list by the orchestrator. Not treated as a dashboard-server defect since the citation on this unit's side is now correct and specific.

3. **`line` field naming — FIXED, consistent everywhere.** `AnswerRequest { file: string; line: number; value: string; }` (domain-entities.md:22), `POST /api/answer {file, line, value}` (business-logic-model.md:33), line-gate step references "対象 line の行" (business-logic-model.md:38). Grep for `lineIndex` across all three artifacts returns zero matches — no stray old field name remains.

4. **State-change broadcast workflow+nextStep — FIXED.** Business-logic-model.md's watch-callback table: `{type:"state"} → getWorkflow + getNextStep 再取得 → WS broadcast {type:"change", scope, workflow, nextStep}（WsMessage 契約どおり）` (business-logic-model.md:24). Matches the WsMessage union member `{ type: "change"; scope: "state"; workflow: WorkflowModel; nextStep: NextStep }` (domain-entities.md:17) exactly — field names and cardinality agree between the two artifacts.

5. **BR-DS-5 phantom rebuild endpoint — FIXED (minor).** Now reads "明示再構築エンドポイントは持たない（必要になったら追加 — YAGNI）" (business-rules.md:14) — states the absence explicitly instead of referencing a nonexistent endpoint. Confirmed no rebuild route appears in the REST handler list (`GET /api/matrix` → "構築済みキャッシュ or {building:true}", business-logic-model.md:51); no other reference to a rebuild endpoint exists anywhere in the three artifacts.

**Regression check:** No new contradictions found. AnswerWriter step count is consistently "7 ステップ" across business-rules.md (BR-DS-1) and domain-entities.md's test-boundary section. Error-identifier list is identical between business-rules.md:20 and domain-entities.md:23-24. ReadResult→HTTP mapping (500-avoidance, BR-DS-4) is unchanged and still consistent with the fail-soft NFR-6 mandate.

**Open item carried forward (not a dashboard-server blocker):** confirm reader-core's `logical-components.md` documents `guardPath` as a named export intended for this consumer — could not be checked in this pass due to reviewer-scope hook enforcement; recommend the orchestrator add it to the exempt list for a follow-up spot-check, or have it confirmed in reader-core's own review pass.
