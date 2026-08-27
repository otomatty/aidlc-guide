# Dashboard Intent View Pin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard（webview と dashboard-server / Mob）が `aidlc/` 内の intent レコードをカーソルに依存せず選んで表示する。

**Architecture:** `GuideService` が表示ピン（ディレクトリ名）を持つ。`recordDir()` はそのピンを返す。`POST /api/select-intent` がピンを更新し watch を張り直す。VS Code は `workspaceState` に slug を保存する。MCP / `btw` / `/aidlc` は `active-intent` のまま。

**Tech Stack:** TypeScript, Vitest, React Testing Library, VS Code Extension API (`workspaceState`), Bun.

**Spec:** `docs/superpowers/specs/2026-08-27-dashboard-intent-view-pin-design.md`

## Global Constraints

- `aidlc/` には書かない（NFR-1）。`active-intent` ファイルの作成・更新は禁止。否定テストで確認する。
- `dashboard` は `reader-core` を import しない。
- api-core の Biome `noRestrictedImports`（write 系 `node:fs`）は select-intent でも破らない（メモリのみ）。
- パスは `node:path`。ハードコード区切り禁止。
- UI は日本語。表示中の行は色 + ✔ + 「（表示中）」の三重表現。
- 新テストは既存 `bun run check`（Vitest）配下。
- MCP / `btw` / エンジンの `/aidlc --doctor` は変えない。
- space 切替 UI は作らない。

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared-types/src/index.ts` | `no-selected-intent`, `IntentList.selected`, `WsMessage` の `intent-selected` |
| `packages/api-core/src/select.ts` | `electSelected` 純関数 |
| `packages/api-core/src/handlers/select-intent.ts` | `POST /api/select-intent`（ディスク書き込みなし） |
| `packages/api-core/src/service.ts` | ピン、`recordDir()`、watch 世代、`selectIntent` |
| `packages/api-core/src/handlers/read.ts` | `GET /api/intents` に `selected` を載せる |
| `packages/reader-core/src/index.ts` | `ReaderOptions.recordDir` を string または resolver に |
| `packages/reader-core/src/intents/resolve.ts` | `IntentList.selected: null` |
| `packages/dashboard-server/src/server.ts` | POST 振り分け |
| `packages/vscode-extension/src/guide-session.ts` | persist / `initialSelected` / handlePost |
| `packages/vscode-extension/src/doctor.ts` | レコード 1 件以上で ok |
| `packages/dashboard/src/services/select-intent.ts` | クライアント POST（answer とは別ファイル） |
| `packages/dashboard/src/components/IntentPicker.tsx` | 選択 UI |
| `packages/mcp-server/src/render.ts` | 新 reason の文言 |

---

### Task 1: 共有型

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/mcp-server/src/render.ts`（`REASON_TEXT` に 1 行）
- Modify: `packages/dashboard/src/store/derive-view-state.ts`（`REASON_TEXT` と `EMPTY_REASONS`）

**Interfaces:**
- Consumes: なし
- Produces: `StandardReason` に `"no-selected-intent"`。`IntentList.selected: string | null`。`WsMessage` に `{ type: "intent-selected" }`。

- [ ] **Step 1: 型を足す**

`StandardReason` に `"no-selected-intent"` を追加。

`IntentList` を次の形にする:

```ts
export interface IntentList {
  space: string;
  active: string | null;
  all: string[];
  /** Dashboard 表示ピン。reader-core は常に null。api-core が載せる。 */
  selected: string | null;
}
```

`WsMessage` に `| { type: "intent-selected" }` を追加。

`AnswerRequest` 直上のコメント「the system's only write」は「the system's only *disk* write」に直す。

- [ ] **Step 2: 文言マップを埋めてコンパイルを通す**

`packages/mcp-server/src/render.ts` の `REASON_TEXT`:

```ts
"no-selected-intent":
  "表示するインテントが選ばれていません。Dashboard の一覧から選んでください。",
```

`packages/dashboard/src/store/derive-view-state.ts`:

```ts
"no-selected-intent": "インテントを選んでください",
```

`EMPTY_REASONS` に `"no-selected-intent"` を追加。

reader-core の `resolveIntents` が返すオブジェクトに `selected: null` を足す（この Task で型が壊れるため。挙動はまだピンなし）。

IntentList リテラルを組み立てているテスト（`packages/dashboard/tests/intents.test.tsx`、`packages/dashboard-server/tests/read-handlers.test.ts`、`packages/reader-core/tests/intents.test.ts` など）に `selected: null`（または該当値）を足す。

- [ ] **Step 3: 型チェック**

Run: `bunx tsc --noEmit && bunx tsc --noEmit -p packages/dashboard && bunx tsc --noEmit -p packages/vscode-extension`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/shared-types/src/index.ts packages/mcp-server/src/render.ts packages/dashboard/src/store/derive-view-state.ts packages/reader-core/src/intents/resolve.ts packages/dashboard/tests/intents.test.tsx packages/dashboard-server/tests/read-handlers.test.ts packages/reader-core/tests/intents.test.ts
git commit -m "$(cat <<'EOF'
feat: add selected intent and no-selected-intent to the wire contract

EOF
)"
```

---

### Task 2: `electSelected`

**Files:**
- Create: `packages/api-core/src/select.ts`
- Test: `packages/api-core/tests/select.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:

```ts
export function electSelected(
  all: readonly string[],
  persisted: string | null,
): string | null
```

カーソルは見ない。仕様 §4 の4分岐。

- [ ] **Step 1: 失敗するテストを書く**

`packages/api-core/tests/select.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { electSelected } from "../src/select.ts";

describe("electSelected", () => {
  it("uses persisted when it is listed", () => {
    expect(electSelected(["a", "b"], "b")).toBe("b");
  });

  it("uses the lone record when persisted is missing", () => {
    expect(electSelected(["only"], null)).toBe("only");
  });

  it("returns null when several records and no persisted", () => {
    expect(electSelected(["a", "b"], null)).toBeNull();
  });

  it("ignores a deleted persisted slug and falls back to lone or null", () => {
    expect(electSelected(["a", "b"], "gone")).toBeNull();
    expect(electSelected(["a"], "gone")).toBe("a");
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認**

Run: `bunx vitest run packages/api-core/tests/select.test.ts`

Expected: FAIL（モジュールが無い）

- [ ] **Step 3: 実装**

`packages/api-core/src/select.ts`:

```ts
export function electSelected(
  all: readonly string[],
  persisted: string | null,
): string | null {
  if (persisted !== null && all.includes(persisted)) return persisted;
  if (all.length === 1) return all[0] ?? null;
  return null;
}

export function isIntentDirName(name: string, all: readonly string[]): boolean {
  if (name === "" || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return false;
  }
  return all.includes(name);
}
```

- [ ] **Step 4: テスト PASS**

Run: `bunx vitest run packages/api-core/tests/select.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api-core/src/select.ts packages/api-core/tests/select.test.ts
git commit -m "$(cat <<'EOF'
feat: elect Dashboard view intent without the active-intent cursor

EOF
)"
```

---

### Task 3: GuideService 表示ピンと `recordDir`

**Files:**
- Modify: `packages/api-core/src/service.ts`
- Modify: `packages/api-core/src/handlers/read.ts`（`ReadContext.selected`、`GET /api/intents` の overlay）
- Modify: `packages/reader-core/src/index.ts`（`ReaderOptions.recordDir` を `string | (() => Promise<ReadResult<string>>)` に）
- Test: `packages/api-core/tests/view-pin.test.ts`

**Interfaces:**
- Consumes: `electSelected`（Task 2）、`resolveIntents` / `intentsDirOf`（reader-core）
- Produces:

```ts
export interface GuideServiceConfig {
  // 既存フィールドに加えて:
  initialSelected?: string | null;
  onSelect?: (slug: string | null) => void;
}

export interface GuideService {
  // 既存に加えて:
  selectIntent(name: string): Promise<RouteResult>;
}
```

`ReadContext` に `selected(): string | null` を追加。

`recordDir()` の reason:

- `all.length === 0` → `{ error: true, reason: "no-active-intent" }`
- `all.length > 0` かつピンなし → `{ error: true, reason: "no-selected-intent" }`
- ピンが `all` に含まれる → そのパス

構築時 `config.recordDir`（string）があるときは従来どおり固定パス。表示ピンはそのとき使わない。

ピンが選挙結果と食い違ったらメモリを合わせ `onSelect` を呼ぶ。`onSelect` の throw は握りつぶす。

- [ ] **Step 1: 失敗するテスト**

`packages/api-core/tests/view-pin.test.ts` — 一時ディレクトリに intent を 2 件（state ファイル付き）置き、`createGuideService({ workspaceRoot })`（カーソルなし）で:

1. `readContext.recordDir()` が `no-selected-intent`
2. `GET` 相当で intents の `selected === null`、`all` が 2 件
3. `initialSelected` が listed なら `recordDir()` がそのパス
4. 1 件だけならカーソルなしでもそのパス（lone-intent）

カーソルファイルは作らない。

- [ ] **Step 2: 失敗を確認**

Run: `bunx vitest run packages/api-core/tests/view-pin.test.ts`

Expected: FAIL

- [ ] **Step 3: 実装**

`createGuideService` 内:

```ts
let pin: string | null = config.initialSelected ?? null;
let selecting: Promise<void> | null = null;

async function listed(): Promise<ReadResult<IntentList>> {
  return await resolveIntents(workspaceRoot);
}

async function recordDirFromPin(): Promise<ReadResult<string>> {
  if (config.recordDir !== undefined) return { ok: true, value: config.recordDir };
  const intents = await listed();
  if (!("ok" in intents)) return intents;
  const next = electSelected(intents.value.all, pin);
  if (next !== pin) {
    pin = next;
    try {
      config.onSelect?.(pin);
    } catch {
      // persist 失敗はメモリピンを残す
    }
  }
  if (next === null) {
    return {
      error: true,
      reason: intents.value.all.length === 0 ? "no-active-intent" : "no-selected-intent",
    };
  }
  return { ok: true, value: path.join(intentsDirOf(workspaceRoot, intents.value.space), next) };
}
```

`createReader(workspaceRoot, { recordDir: recordDirFromPin })` — reader-core が関数を毎呼出で await するようにする。string の既存テストピンは維持。

`GET /api/intents`:

```ts
const list = await ctx.reader.getIntents();
if (!("ok" in list)) return mapResultRoute(list);
return mapResultRoute({
  ok: true,
  value: { ...list.value, selected: ctx.selected() },
  ...(list.warnings === undefined ? {} : { warnings: list.warnings }),
});
```

`selectIntent` はこの Task ではスタブでもよいが、Task 4 で本実装するならここは `recordDir` / overlay まで。

- [ ] **Step 4: テスト PASS**

Run: `bunx vitest run packages/api-core/tests/view-pin.test.ts packages/reader-core/tests/reader.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api-core/src/service.ts packages/api-core/src/handlers/read.ts packages/api-core/tests/view-pin.test.ts packages/reader-core/src/index.ts
git commit -m "$(cat <<'EOF'
feat: resolve Dashboard recordDir from a view pin, not the cursor

EOF
)"
```

---

### Task 4: `POST /api/select-intent`

**Files:**
- Create: `packages/api-core/src/handlers/select-intent.ts`
- Modify: `packages/api-core/src/service.ts`（`selectIntent` 本実装、直列化）
- Modify: `packages/api-core/src/index.ts`（`routeSelectIntent` / `handleSelectIntent` を export）
- Modify: `packages/dashboard-server/src/server.ts`
- Modify: `packages/vscode-extension/src/guide-session.ts`
- Test: `packages/api-core/tests/select-intent.test.ts`

**Interfaces:**
- Consumes: `isIntentDirName`, `electSelected`, `GuideService` ピン
- Produces:

```ts
export async function routeSelectIntent(
  service: GuideService,
  body: unknown,
): Promise<RouteResult>
```

受理: `{ intent: string }` かつ `isIntentDirName(intent, all)`。

| 条件 | status |
|------|--------|
| 受理 | 200、body は overlay 済み `ReadResult<IntentList>` |
| 未知・不正 | 400 `{ error: true, reason: "bad-request" }` |
| hostMode | 403 `{ error: "read-only-mode" }`（answer と同じ識別子でよい） |

副作用（受理時）: ピン更新 → `onSelect` → watch 張り直し（Task 5 で本実装。この Task では `rebindWatch` を呼ぶ口だけ用意し、未実装なら no-op）→ matrix キャッシュ破棄 → `startMatrixBackground` → `hub.broadcast({ type: "intent-selected" })`。

同一ピン再選択: 200、watch 張り直し省略。

否定テスト: 成功後に `intents/active-intent` が存在しない（作っていないワークスペース）。

- [ ] **Step 1: 失敗するテスト**（成功・未知名・`..`・hostMode・active-intent 非書き込み）
- [ ] **Step 2: FAIL 確認** — `bunx vitest run packages/api-core/tests/select-intent.test.ts`
- [ ] **Step 3: ハンドラ実装と POST 振り分け**

`dashboard-server/src/server.ts` の POST 分岐:

```ts
if (url.pathname === "/api/select-intent") {
  return await handleSelectIntent(service, request);
}
```

`GuideSession.handlePost`:

```ts
if (path === "/api/select-intent") {
  const result = await routeSelectIntent(this.service, body);
  return { ok: result.status >= 200 && result.status < 300, status: result.status, body: result.body };
}
```

`handleSelectIntent` は request JSON を読んで `routeSelectIntent`。

- [ ] **Step 4: PASS**
- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add POST /api/select-intent for the Dashboard view pin

EOF
)"
```

---

### Task 5: watch 張り直し

**Files:**
- Modify: `packages/api-core/src/service.ts`
- Test: `packages/api-core/tests/select-intent-watch.test.ts`（または view-pin に追加）

**Interfaces:**
- Consumes: Task 4 の `selectIntent`
- Produces: ピン変更時に旧 `unwatch` → 世代++ → 新 `startWatch()`。未選択なら監視しない。旧世代のイベントは捨てる。

- [ ] **Step 1: 失敗するテスト** — 2 レコードを watch 可能な一時 dir で切替後、旧 dir の state 変更では workflow push が来ず、新 dir の変更では来る。
- [ ] **Step 2: FAIL 確認**
- [ ] **Step 3: `startWatch` が返す disposer をサービスが保持し、`selectIntent` から `rebindWatch()`**
- [ ] **Step 4: PASS**
- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: rebind file watch when the Dashboard view pin changes

EOF
)"
```

---

### Task 6: Dashboard UI

**Files:**
- Create: `packages/dashboard/src/services/select-intent.ts`
- Modify: `packages/dashboard/src/components/IntentPicker.tsx`
- Modify: `packages/dashboard/src/components/atoms.tsx`（`INTENT_SWITCH_HINT` 削除、EmptyState 見出し）
- Modify: `packages/dashboard/src/components/NowStrip.tsx`（ウィザードは `no-active-intent` のみ）
- Modify: `packages/dashboard/src/store/reducer.ts`（`intent-selected` → 何もしない。refetch は live.ts）
- Modify: `packages/dashboard/src/services/live.ts`（`intent-selected` で `refetchAll`）
- Modify: `packages/dashboard/tests/dependency-direction.test.ts`（POST 許可を answer + select-intent の 2 モジュールに）
- Modify: `packages/dashboard/tests/intents.test.tsx`

**Interfaces:**
- Consumes: `POST /api/select-intent`、`IntentList.selected`
- Produces: 選択可能な IntentPicker。hostMode ではボタンなし。

`select-intent.ts`:

```ts
export async function selectIntent(name: string): Promise<PostJsonResult> {
  return await getTransport().postJson("/api/select-intent", { intent: name });
}
```

IntentPicker:

- トリガー: `intents?.selected ?? "未選択"`
- 自動オープン: `all.length > 0 && selected === null`
- 行は `hostMode` でなければ `<button>`。表示中は ✔ + 「（表示中）」+ `data-selected="true"`
- 成功でダイアログを閉じる。失敗は開いたままエラーテキスト
- `INTENT_SWITCH_HINT` 削除

NowStrip empty:

- `reason === "no-active-intent"` かつ webview → PreflightWizard（現行）
- `reason === "no-selected-intent"` → EmptyState 見出し「インテントを選んでください」、`showCreateHint={false}`、ウィザードなし

- [ ] **Step 1: intents.test.tsx を新契約に書き換え（クリックで POST、hostMode でボタンなし、自動オープン、旧コピー無し）**
- [ ] **Step 2: FAIL 確認**
- [ ] **Step 3: UI 実装**
- [ ] **Step 4: `bunx vitest run packages/dashboard/tests/intents.test.tsx packages/dashboard/tests/dependency-direction.test.ts packages/dashboard/tests/preflight-wizard.test.tsx packages/dashboard/tests/derive-view-state.test.tsx`**
- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: let the Dashboard IntentPicker switch the view pin

EOF
)"
```

---

### Task 7: VS Code 永続化と doctor

**Files:**
- Modify: `packages/vscode-extension/src/guide-session.ts`
- Modify: `packages/vscode-extension/src/dashboard-panel.ts`（session 作成時に `workspaceState` を渡す）
- Modify: `packages/vscode-extension/src/doctor.ts`
- Modify: `packages/vscode-extension/src/setup-panel.ts`（コピーがカーソル必須なら直す）
- Test: `packages/vscode-extension/tests/selected-intent.test.ts`
- Test: `packages/vscode-extension/tests/doctor.test.ts`

**Interfaces:**
- Consumes: `GuideServiceConfig.initialSelected` / `onSelect`
- Produces: キー `aidlcGuide.selectedIntent`（`workspaceState`、文字列）。doctor は `all.length >= 1` で ok。

`getOrCreateSession(workspaceRoot, officialDocsRoot, persist?: { get(): string | undefined; set(slug: string | null): void })`

dashboard-panel の `wireWebview` で:

```ts
const session = getOrCreateSession(workspaceRoot, officialDocsRoot, {
  get: () => context.workspaceState.get<string>("aidlcGuide.selectedIntent"),
  set: (slug) => {
    void context.workspaceState.update("aidlcGuide.selectedIntent", slug);
  },
});
```

doctor `intentDetail`: `all.length >= 1` なら ok。detail は件数。`active === null && all.length > 1` を失敗にしない。0 件だけ失敗。

- [ ] **Step 1: doctor と persist のテスト**
- [ ] **Step 2: FAIL 確認**
- [ ] **Step 3: 実装**
- [ ] **Step 4: `bunx vitest run packages/vscode-extension/tests/doctor.test.ts packages/vscode-extension/tests/selected-intent.test.ts`**
- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: persist Dashboard intent selection per VS Code workspace

EOF
)"
```

---

### Task 8: 品質ゲート

- [ ] **Step 1:** `bun run check`
- [ ] **Step 2:** 失敗があれば直して再実行
- [ ] **Step 3:** 残差が無ければ完了

---

## Spec coverage

| Spec § | Task |
|--------|------|
| 3 境界・MCP 対象外 | 全体（MCP ファイルは render 文言のみ） |
| 4 electSelected / 起動 / reason | 2, 3, 7 |
| 5 API / POST / hostMode / push | 1, 4, 5, 6 |
| 6 UI | 6 |
| 7 watch | 5 |
| 8 doctor | 7 |
| 9 テスト | 各 Task + 8 |
| 10 対象外 | 実装しない |
