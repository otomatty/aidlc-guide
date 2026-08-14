# Business Logic Model — Unit: reader-core

> functional-design (3.1) / Unit: reader-core (kind: library, L) / 2026-07-23
> 入力: unit-of-work.md U1 + unit-of-work-story-map.md（US-09a/US-15）+ requirements.md（FR-1）+ components.md C2 + component-methods.md（Reader API）+ services.md

## モジュール別ロジック（components.md C2 の内部構造に対応）

### L1: `parse/` — state パース（FR-1.1、State Version 依存の唯一の場所）

```
readState(recordDir):
  0. サイズ上限: stat で 10MB 超は {error, reason:"file-too-large"}（L6 と同一の読取時 bound）
  1. <recordDir>/aidlc-state.md を読む → 不在/読取不能: {error, reason:"state-missing|state-unreadable"}
  2. Version 検知: 「## Project Information」内の「- **State Version**: <n>」を抽出
     → 欠落 or n≠8: {unsupported, version:<n|"unknown">}   ← C-T3: 現行のみサポート
  3. セクション抽出（business-rules.md の文法規則 G-1〜G-6 による行指向パース）:
     Project Information / Scope Configuration / Workspace State / Execution Plan Summary /
     Runtime State / Phase Progress / Stage Progress（checkbox 行）/ Current Status /
     Session Resume Point（実 State Version 8 ファイルの全9セクション。未知セクションは無視）
  4. WorkflowModel を構築して {ok, value}
     個別フィールドの欠落・不正は WorkflowModel の該当フィールドを
     {unparseable: reason} でマークし全体は {ok}（局所縮退 — NFR-6）
```

### L2: `tree/` — 成果物ツリー走査（FR-1.2）

```
buildMatrix(recordDir, constructionStageSlugs):
  0. constructionStageSlugs は L1 の WorkflowModel.stages（phase===CONSTRUCTION の slug 集合）
     から**ファサードが渡す**（tree/ に stage 知識をハードコードしない — BR-RC-4 の例外条項参照）
  1. construction/ 直下のディレクトリ = ユニット候補（constructionStageSlugs に一致する名前は
     ステージ横断ディレクトリ [stage diary 等] として除外）
  2. 各 <unit>/<stage>/ の *.md を数える → MatrixCell {count}
  3. verdict 抽出: セル内の主要成果物（*.md）を後方から走査し、最後の「## Review」
     セクションの「**Verdict:** READY|NOT-READY」を読む → verdict（無ければ null）
  4. 読めないセルは cell.error に理由（他セルは正常続行 — 部分欠落 = 失敗モード④）
  ※ 走査は readdir + 対象ファイルの部分読取のみ。593ファイル規模で全内容を読まない
    （verdict はファイル末尾付近にあるため tail 読みで足りる — 性能は nfr で規定）

buildMatrixForUnit(recordDir, unit, constructionStageSlugs):   ← 変更駆動の部分再構築（NFR-3 経路）
  上と同じ手順を <unit> 1ディレクトリに限定して実行し、その unit の MatrixCell 行のみ返す。
  watch の scope "matrix:<unit>" が unit を特定するため、変更反映で 593 全体を再走査しない
  （全体走査 buildMatrix は起動時の背景構築専用 — nfr-requirements P-RC-2a/2b の予算分担）。
```

### L3: `audit/` — 監査イベント抽出（FR-1.3）

```
readAuditEvents(recordDir, limit):
  1. <recordDir>/audit/*.md（クローン別シャード）を列挙 → 0件: {ok, value:[]}（監査なしは正常）
  2. 各シャードを「---」区切りブロックに分割し、**Event**/**Timestamp**/**Stage** フィールドを抽出
  3. 全シャードをマージし Timestamp 降順で limit 件 → {ok, value}
  4. シャード単位の読取不能: そのシャードをスキップし value と併せて warnings に記録（失敗モード⑤の局所縮退）
```

### L4: `intents/` — インテント解決（FR-1.4）

```
resolveIntents(rootPath):
  1. <root>/aidlc/active-space（cursor）→ 不在: "default"
  2. spaces/<space>/intents/active-intent（cursor）→ intent 名
  3. spaces/<space>/intents/ 直下のディレクトリ列挙 = 全インテント
  4. cursor が指す先が実在: {ok, {active, all}} / cursor 不在・壊れ・宙吊り: {ok, {active:null, all}}（失敗モード①②）
```

### L5: `watch/` — ファイル監視（FR-1.5）

```
watch(recordDir, cb):
  chokidar で監視: aidlc-state.md（ファイル）+ construction/（再帰）+ audit/（再帰）
  → イベントをディレクトリ粒度で 300ms debounce → 影響 scope を分類
    （state | matrix:<unit> | audit）→ cb({type:"change", scope, path})
  watcher 障害時（再購読3回失敗）: cb({type:"watch-warning", reason}) — WatchEvent 判別可能ユニオン
  戻り値 dispose() が watcher を close
```

### L6: `read-artifact` — 成果物本文の読取境界（FR-2.4 の一次 enforcement）

```
readArtifact(recordDir, relPath):
  0. サイズ上限: stat で 10MB 超は {error, reason:"file-too-large"}（読み込み前に拒否 —
     読取時の一時メモリ確保を bound する。readState も同じ上限を適用）
  1. abs = path.resolve(recordDir, relPath)
  2. rel = path.relative(recordDir, abs)
  3. 拒否条件（いずれかで {error, reason:"outside-record"}）:
     - rel が ".." で始まる（トラバーサル / 記録外絶対パス — path.relative が吸収）
     - path.isAbsolute(rel)（別ドライブ等）
     - realpath(abs) を同じ手順で再検査して失敗（シンボリックリンク脱出）
     ※ startsWith プレフィックス比較は使わない（/rec/foo と /rec/foobar を誤許可するため）
  4. 通過: 本文を読んで {ok, value}。不在: {error, reason:"artifact-not-found"}
  呼出側（mcp-server / dashboard-server）の検査は二重化（defense in depth）であり、一次はここ。
```

### L7: `index.ts` — ファサード

`createReader(rootPath)` が L1〜L6 を束ね、component-methods.md の 7 メソッドを公開。

- **recordDir の解決**: 各読取メソッドの呼出しごとに L4 で active intent を再解決して recordDir を導く（インテント切替が次の読取から反映される。キャッシュしない）。`getIntents().active === null` のとき、recordDir を要する5メソッド（getWorkflow/getMatrix/getAuditEvents/getNextStep/readArtifact）は `{error, reason:"no-active-intent"}` を返す（失敗モード①の全メソッド版 — UI は EmptyState を出す）。
- `getNextStep()` は L1 の WorkflowModel から「Stage Progress の EXECUTE 行のうち現在ステージより後の最初の未完了」を返す（FR-2.3 のデータ源、NextStepCallout/US-02 が消費）。
- `getMatrix()` は L1 → constructionStageSlugs を取り出して L2 へ渡す（L2 の step 0）。

## エラーハンドリング方針

全メソッドが ReadResult（throw 禁止 — team.md 規約3）。「全体 error」は入口級の失敗（state 不在等）のみ。要素級の失敗はモデル内の局所マーク（cell.error / warnings / unparseable フィールド）で表現し、健全部分を返す（US-15 の5モード対応表は business-rules.md）。

## Review

**Verdict:** READY

- **readArtifact (finding 1, resolved)** — L6 now specifies a concrete containment algorithm: `path.resolve(recordDir, relPath)` → `path.relative(recordDir, abs)` → reject on leading `".."` or `path.isAbsolute(rel)` → `realpath` re-check via the same two steps for symlink escape, all mapped to `{error, reason:"outside-record"}`. `startsWith` is explicitly called out and rejected as unsafe (`/rec/foo` vs `/rec/foobar`), matching the test-boundary case in domain-entities.md line 88. Not-found is a distinct reason (`"artifact-not-found"`). Primary-vs-double-check roles are now stated: "呼出側（mcp-server / dashboard-server）の検査は二重化（defense in depth）であり、一次はここ" (L6, line 82).
- **tree/ exclusion (finding 2, resolved)** — `buildMatrix(recordDir, constructionStageSlugs)` now takes the exclusion set as a parameter (L2, line 27), sourced explicitly from "L1 の WorkflowModel.stages（phase===CONSTRUCTION の slug 集合）から**ファサードが渡す**" (line 28). BR-RC-4 in business-rules.md (line 24) states the exception in full: tree/ stays version-independent except that the cross-stage-directory exclusion set is received as an argument rather than hardcoded, with the knowledge source pinned to parse/. L7 confirms the wiring: "getMatrix() は L1 → constructionStageSlugs を取り出して L2 へ渡す" (line 91).
- **total sourcing (finding 3, resolved)** — G-6 is present in business-rules.md (line 15): field (`Execution Plan Summary` → `Total Stages`) primary, EXECUTE-row-count fallback on absence, and on disagreement the field value wins with the mismatch recorded in `warnings` ("state はエンジンの所有物 — reader は読むだけで正誤判定しない"). domain-entities.md's `WorkflowModel.total` comment is updated to match: "G-6（Total Stages フィールド優先、EXECUTE 行数フォールバック、不一致は warnings）" (line 39).
- **facade threading (finding 4, resolved)** — L7 states per-call recordDir re-resolution explicitly: "各読取メソッドの呼出しごとに L4 で active intent を再解決して recordDir を導く（インテント切替が次の読取から反映される。キャッシュしない）" (line 89), and names the no-active-intent behavior for exactly the 5 record-dependent methods (`getWorkflow`/`getMatrix`/`getAuditEvents`/`getNextStep`/`readArtifact`) → `{error, reason:"no-active-intent"}`, matching the `"no-active-intent"` entry in domain-entities.md's standard-reason list (line 85).
- **minor: section list (resolved)** — L1 step 3 now enumerates the real 9 sections (Project Information / Scope Configuration / Workspace State / Execution Plan Summary / Runtime State / Phase Progress / Stage Progress / Current Status / Session Resume Point) and labels the count "全9セクション" — the list and the stated count agree.
- **Regression check** — Standard error-reason strings (`state-missing`, `state-unreadable`, `no-active-intent`, `outside-record`, `artifact-not-found`) are used consistently across business-logic-model.md and domain-entities.md's canonical list (line 85); no orphaned or mismatched reason strings found. `StageStatus`'s 6 values still map 1:1 to G-3's 6 marks. `Verdict` type usage in L2 step 3 matches. No new contradictions introduced by the revisions.

