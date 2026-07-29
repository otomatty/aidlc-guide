# ステージ詳細 I/O クリックで成果物を開く Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ステージ詳細の入力/出力のうち実在する成果物だけをリンク化し、VS Code で横隣（Beside）のエディタに、Unit タブ表示中の Unit を基準に開く。

**Architecture:** 論理名→record 相対 path の解決は `GET /api/io-paths` に寄せる。picker の純粋規則は reader-core、bridge-map の inputs/outputs 列挙と HTTP は api-core。dashboard は Unit タブ state を DetailPanel に持ち上げ、path がある項目だけボタン化し、`open-file`（`base: "record"`, `beside: true`）でホストに渡す。

**Tech Stack:** TypeScript / bun / Vitest / React 19 / VS Code Extension API / Biome

設計文書: [docs/superpowers/specs/2026-07-29-stage-io-open-design.md](../specs/2026-07-29-stage-io-open-design.md)

## Global Constraints

- `aidlc/spaces/**` および監査ログへの**書き込み禁止**（NFR-1 / C-T2）。
- aidlc-workflows コア（`.claude/`）を変更しない。
- パッケージ依存方向を守る: `shared-types` ← `core-utils` ← `reader-core` ← `api-core`；`docs-bridge` は api-core から。dashboard は reader-core を import しない。
- 公開パース/解決 API は `ReadResult` を返し、境界で throw しない。
- 新規ランタイム依存を追加しない。
- パスは `node:path` / POSIX wire（record 相対は `/`）。Windows と macOS の双方。
- Webview 由来のパスは `normalizeWebviewPath` / `guardPath` を通す。インラインの封じ込めを新設しない。
- dashboard の fetch は `services/api.ts` の `getResult` + パネル局所は `useFetchView`。
- 品質ゲート: 各タスク完了前に該当パッケージのテスト、最終タスク前に可能なら `bun run check`。
- コミットはユーザーが明示したときだけ行う（このプランの Commit ステップはステージング内容の提案。実行時にユーザー確認が無ければスキップ）。

---

## File Structure

**新規作成**

| ファイル | 責務 |
|---|---|
| `packages/reader-core/src/tree/io-paths.ts` | `listMarkdownRel` + 純粋関数 `pickIoPath` |
| `packages/reader-core/tests/io-paths.test.ts` | pick / list の単体 |
| `packages/api-core/src/handlers/io-paths.ts` | bridge-map 列挙 + record 走査 → `StageIoPaths` |
| `packages/api-core/tests/io-paths.test.ts` | `/api/io-paths` ルート |
| `packages/dashboard/tests/stage-io-open.test.tsx` | Unit 連動リンク + open メッセージ |

**変更**

| ファイル | 変更内容 |
|---|---|
| `packages/shared-types/src/index.ts` | `StageIoPaths` |
| `packages/reader-core/src/index.ts` | `pickIoPath` / `listMarkdownRel` を export（api-core とテストが使う） |
| `packages/api-core/src/handlers/read.ts` | `/api/io-paths` を `routeRead` に接続 |
| `packages/vscode-extension/src/open-file.ts` | `base` / `beside` |
| `packages/vscode-extension/src/dashboard-panel.ts` | メッセージ転送 + recordDir |
| `packages/vscode-extension/tests/` | record + beside の単体（vscode モックが厳しければ `file-ref-target` 隣接の純関数に分離） |
| `packages/dashboard/src/services/api.ts` | `fetchIoPaths` |
| `packages/dashboard/src/services/docs.ts` | `openFileInIde` に `beside` / `base` |
| `packages/dashboard/src/components/DetailPanel.tsx` | `activeUnit` + io-paths 取得 |
| `packages/dashboard/src/components/StageArtifacts.tsx` | controlled unit |
| `packages/dashboard/src/components/StageCard.tsx` | リンク化 List |
| `packages/dashboard/tests/detail-panel.test.tsx` | controlled unit の回帰（必要なら追記） |
| `packages/dashboard/tests/vscode-api.test.ts` | 新メッセージ形 |

---

### Task 1: `StageIoPaths` 型

**Files:**
- Modify: `packages/shared-types/src/index.ts`（`StageDoc` 付近）
- Test: 型のみなら `tsc --noEmit` で確認（専用テストファイル不要）

**Interfaces:**
- Consumes: なし
- Produces:

```ts
export interface StageIoPaths {
  stage: string;
  unit: string | null;
  inputs: Record<string, string | null>;
  outputs: Record<string, string | null>;
}
```

- [ ] **Step 1: 型を追加する**

`StageDoc` の直後に上記 `StageIoPaths` を追加する。JSDoc は設計書どおり（論理名 → record 相対 POSIX、無い/曖昧は `null`）。

- [ ] **Step 2: 型チェック**

Run: `bunx tsc --noEmit -p packages/shared-types`（またはルート `tsc --noEmit`）  
Expected: PASS

- [ ] **Step 3: Commit（ユーザー承認時のみ）**

```bash
git add packages/shared-types/src/index.ts
git commit -m "$(cat <<'EOF'
feat(shared-types): add StageIoPaths wire type

EOF
)"
```

---

### Task 2: `pickIoPath`（純粋解決）

設計書の優先順をファイルシステム無しで固定する。

**Files:**
- Create: `packages/reader-core/src/tree/io-paths.ts`
- Modify: `packages/reader-core/src/index.ts`
- Test: `packages/reader-core/tests/io-paths.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:

```ts
/** hits = record 相対 POSIX（`/`）。fileName は `foo.md`。 */
export function pickIoPath(
  hits: readonly string[],
  fileName: string,
  opts: { unit: string | null; stage: string },
): string | null;
```

規則（設計書より）:

1. `unit` あり → `construction/{unit}/` 配下かつ basename === fileName のみ。0件→次へ。1件→採用。複数→ステージセグメント === `opts.stage` を優先、なお複数/0なら辞書順先頭。採用したら終了（SHARED に落とさない）。
2. STAGE-DIR: `construction/{stageSlug}/{fileName}`（セグメント数 3、2番目が unit ではなくステージ名）。一意なら採用。
3. SHARED: `construction/` で始まらない hit で basename 一致が一意なら採用。
4. それ以外 → `null`。

ステージセグメントの取り方: `construction/{unit}/{stage}/file.md` → index 2。STAGE-DIR: `construction/{stage}/file.md` → index 1、かつ全体 segments.length === 3。

- [ ] **Step 1: 失敗するテストを書く**

`packages/reader-core/tests/io-paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickIoPath } from "../src/tree/io-paths.ts";

describe("pickIoPath", () => {
  const file = "business-rules.md";
  const unitHits = [
    "construction/ops-guides/functional-design/business-rules.md",
    "construction/reader-core/functional-design/business-rules.md",
  ];

  it("prefers the active unit and ignores other units", () => {
    expect(
      pickIoPath(unitHits, file, { unit: "ops-guides", stage: "nfr-requirements" }),
    ).toBe("construction/ops-guides/functional-design/business-rules.md");
  });

  it("returns null when the unit has no hit even if others do", () => {
    expect(
      pickIoPath(unitHits, file, { unit: "missing-unit", stage: "functional-design" }),
    ).toBeNull();
  });

  it("prefers current stage when the same unit has multiple producers", () => {
    const hits = [
      "construction/u/functional-design/code-summary.md",
      "construction/u/code-generation/code-summary.md",
    ];
    expect(
      pickIoPath(hits, "code-summary.md", { unit: "u", stage: "code-generation" }),
    ).toBe("construction/u/code-generation/code-summary.md");
  });

  it("picks a unique shared inception path when unit has no hit", () => {
    const hits = [
      "inception/requirements-analysis/requirements.md",
      "construction/ops-guides/functional-design/business-rules.md",
    ];
    expect(
      pickIoPath(hits, "requirements.md", { unit: "ops-guides", stage: "functional-design" }),
    ).toBe("inception/requirements-analysis/requirements.md");
  });

  it("picks a unique stage-dir path", () => {
    expect(
      pickIoPath(
        ["construction/build-and-test/build-instructions.md"],
        "build-instructions.md",
        { unit: null, stage: "build-and-test" },
      ),
    ).toBe("construction/build-and-test/build-instructions.md");
  });

  it("returns null when shared hits are ambiguous", () => {
    expect(
      pickIoPath(
        ["ideation/a/x.md", "inception/b/x.md"],
        "x.md",
        { unit: null, stage: "anything" },
      ),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: テスト実行（失敗を確認）**

Run: `bunx vitest run packages/reader-core/tests/io-paths.test.ts`  
Expected: FAIL（module missing）

- [ ] **Step 3: 実装**

`packages/reader-core/src/tree/io-paths.ts` に `pickIoPath` を実装。basename 比較は最後の `/` 以降。`listMarkdownRel` は Task 3 で足してよい（このタスクでは pick のみ export）。

`index.ts` から `pickIoPath` を re-export。

- [ ] **Step 4: テスト PASS**

Run: `bunx vitest run packages/reader-core/tests/io-paths.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit（ユーザー承認時のみ）**

```bash
git add packages/reader-core/src/tree/io-paths.ts packages/reader-core/src/index.ts packages/reader-core/tests/io-paths.test.ts
git commit -m "$(cat <<'EOF'
feat(reader-core): add pickIoPath for stage I/O resolution

EOF
)"
```

---

### Task 3: record 内 Markdown 列挙 + api-core 組み立て

**Files:**
- Modify: `packages/reader-core/src/tree/io-paths.ts`
- Modify: `packages/reader-core/src/index.ts`
- Create: `packages/api-core/src/handlers/io-paths.ts`
- Modify: `packages/api-core/src/handlers/read.ts`
- Test: `packages/reader-core/tests/io-paths.test.ts`（list 追記）
- Test: `packages/api-core/tests/io-paths.test.ts`

**Interfaces:**
- Consumes: `pickIoPath`, `bridgeMap`（`@aidlc-guide/docs-bridge` の `bridgeMap` / または `resolve` が export しているもの）, `StageIoPaths`
- Produces:

```ts
// reader-core
export async function listMarkdownRel(recordDir: string): Promise<ReadResult<string[]>>;
// POSIX relative paths, recursive under recordDir, *.md only, sorted

// api-core
export async function buildStageIoPaths(
  recordDir: string,
  stage: string,
  unit: string | null,
): Promise<ReadResult<StageIoPaths>>;
```

`buildStageIoPaths`:

1. `bridgeMap.stages[stage.trim()]` が無ければ `{ error: true, reason: "not-found" }`
2. `listMarkdownRel(recordDir)`
3. 各 input/output 論理名について `fileName = name.endsWith(".md") ? name : `${name}.md``、`pickIoPath(hits, fileName, { unit, stage })`
4. `{ ok: true, value: { stage, unit, inputs, outputs } }`

`routeRead` に:

```ts
if (route === "/api/io-paths") {
  const stage = url.searchParams.get("stage");
  if (stage === null || stage.trim() === "") {
    return { status: 400, body: { error: true, reason: "missing-stage" } };
  }
  const unitParam = url.searchParams.get("unit");
  const unit = unitParam !== null && unitParam.trim() !== "" ? unitParam.trim() : null;
  const record = await ctx.recordDir();
  if (!("ok" in record)) return mapResultRoute(record);
  return mapResultRoute(await buildStageIoPaths(record.value, stage, unit));
}
```

- [ ] **Step 1: listMarkdownRel のテスト（一時ディレクトリ）**

既存 reader-core テストの temp パターンに合わせ、`construction/u/s/a.md` と `inception/x/b.md` を書き、相対 POSIX で両方返ることを断言。

- [ ] **Step 2: 実装 listMarkdownRel**

`fs.readdir` 再帰、`.md` のみ、`path.relative` を `/` 区切りに正規化、ソート。read 失敗は既存 tree コードと同様に `ReadResult` error（または空＋warning — 既存 `withResult` 慣習に合わせる）。

- [ ] **Step 3: api-core handler + ルートテスト**

`packages/api-core/tests/io-paths.test.ts`: 既存 `agents.test.ts` / timings テストの `createGuideService` + temp record パターンを踏襲。

最低ケース:

- unknown stage → `not-found`
- seeded `inception/requirements-analysis/requirements.md` + stage `functional-design` + unit → inputs.requirements が path、unit-scoped 出力は seed した unit のみ

bridge-map の `functional-design` の inputs/outputs キーがレスポンスに全て含まれること。

- [ ] **Step 4: テスト PASS**

Run:

```bash
bunx vitest run packages/reader-core/tests/io-paths.test.ts packages/api-core/tests/io-paths.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit（ユーザー承認時のみ）**

```bash
git add packages/reader-core packages/api-core
git commit -m "$(cat <<'EOF'
feat(api-core): add GET /api/io-paths

EOF
)"
```

---

### Task 4: 拡張ホスト — record 基準 + Beside

**Files:**
- Modify: `packages/vscode-extension/src/open-file.ts`
- Modify: `packages/vscode-extension/src/dashboard-panel.ts`
- Modify or Create: `packages/vscode-extension/tests/open-file-options.test.ts`（純関数に切り出した部分をテスト）

**Interfaces:**
- Consumes: `guardPath` from `@aidlc-guide/core-utils` or reader-core re-export, `normalizeWebviewPath`
- Produces:

```ts
export type OpenFileBase = "workspace" | "record";

export async function openFileRef(
  workspaceRoot: string,
  rel: string,
  line: number | null,
  options?: { beside?: boolean; base?: OpenFileBase; recordDir?: string },
): Promise<void>;
```

挙動:

- `base` 省略または `"workspace"` → 現行ロジック（回帰なし）。
- `base === "record"`:
  - `recordDir` 必須。無ければ警告して return。
  - `normalizeWebviewPath(rel)` → null なら警告。
  - `guardPath(recordDir, rel)` → ok でなければ警告。
  - 絶対 path の Uri を `reveal(uri, line, { beside })`。
  - glob / QuickPick は使わない（path は既に一意）。
- `beside === true`: `showTextDocument(doc, { viewColumn: ViewColumn.Beside, preview: true })`。`line === null` の `vscode.open` も `ViewColumn.Beside` を渡せる形にする（`vscode.open` の第2引数が options のバージョン差に注意。使えなければ `openTextDocument` + `showTextDocument` に統一）。

`dashboard-panel.ts` の `open-file` 分岐:

```ts
if (msg.type === "open-file" && typeof msg.path === "string") {
  const beside = msg.beside === true;
  const base = msg.base === "record" ? "record" : "workspace";
  let recordDir: string | undefined;
  if (base === "record") {
    const record = await session.service.readContext.recordDir();
    if (!("ok" in record)) {
      void window.showWarningMessage(`レコードを解決できません: ${msg.path}`);
      return;
    }
    recordDir = record.value;
  }
  await openFileRef(workspaceRoot, msg.path, typeof msg.line === "number" ? msg.line : null, {
    beside,
    base,
    recordDir,
  });
}
```

（`session.service.readContext` の実際のプロパティ名は `GuideService` の公開面に合わせる。無ければ `recordDir` 相当の既存アクセサを使う。）

- [ ] **Step 1: reveal の beside をテスト可能な純関数または分岐テストで固定**

vscode モックが重い場合は `resolveOpenTarget(base, roots, rel): string | null` を `open-file.ts` 隣に切り出し、record + guard 相当を単体テスト。

- [ ] **Step 2: 実装**

- [ ] **Step 3: 既存 `file-ref-target` / open 関連テストが緑のまま**

Run: `bunx vitest run packages/vscode-extension/tests`  
Expected: PASS

- [ ] **Step 4: Commit（ユーザー承認時のみ）**

```bash
git add packages/vscode-extension
git commit -m "$(cat <<'EOF'
feat(vscode-extension): open record paths beside the dashboard

EOF
)"
```

---

### Task 5: dashboard — fetch + open ヘルパー

**Files:**
- Modify: `packages/dashboard/src/services/api.ts`
- Modify: `packages/dashboard/src/services/docs.ts`
- Modify: `packages/dashboard/tests/vscode-api.test.ts`

**Interfaces:**
- Consumes: `StageIoPaths`, transport
- Produces:

```ts
// api.ts
export function fetchIoPaths(stage: string, unit: string | null): Promise<ReadResult<StageIoPaths>> {
  const q = new URLSearchParams({ stage });
  if (unit !== null) q.set("unit", unit);
  return getResult(`/api/io-paths?${q}`);
}

// docs.ts — extend
export function openFileInIde(
  ref: { path: string; line: number | null },
  options?: { beside?: boolean; base?: "workspace" | "record" },
): boolean;
```

`openFileInIde` の postMessage:

```ts
api.postMessage({
  type: "open-file",
  path: ref.path,
  line: ref.line,
  ...(options?.beside === true ? { beside: true } : {}),
  ...(options?.base === "record" ? { base: "record" } : {}),
});
```

既存呼び出し（MarkdownSurface）は第2引数なしのまま → 挙動不変。

- [ ] **Step 1: vscode-api テストに beside/record メッセージを追加**

- [ ] **Step 2: 実装**

- [ ] **Step 3: PASS**

Run: `bunx vitest run packages/dashboard/tests/vscode-api.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit（ユーザー承認時のみ）**

---

### Task 6: Unit 持ち上げ + StageCard リンク + DetailPanel 配線

**Files:**
- Modify: `packages/dashboard/src/components/StageArtifacts.tsx`
- Modify: `packages/dashboard/src/components/StageCard.tsx`
- Modify: `packages/dashboard/src/components/DetailPanel.tsx`
- Create: `packages/dashboard/tests/stage-io-open.test.tsx`
- Modify: `packages/dashboard/tests/detail-panel.test.tsx`（タブが controlled でも既存 assertion が通るよう調整）

**Interfaces:**
- Consumes: `fetchIoPaths`, `openFileInIde`, `useFetchView`, `inVsCodeWebview` / `canOpenDocsInIde` 相当
- Produces: UI のみ

#### StageArtifacts

Props を controlled に変更:

```ts
export interface StageArtifactsProps {
  stage: string;
  cells: readonly MatrixCell[];
  unit: string;
  onUnitChange: (unit: string) => void;
  hostMode: boolean;
}
```

内部 `useState` / `initialUnit` を削除。`Tabs` の `value={unit}` / `onValueChange` → `onUnitChange`。

#### DetailPanel

```ts
const [activeUnit, setActiveUnit] = useState<string | null>(null);
// artifacts が変わったら initialUnit に同期（既存 resolveArtifactCells の initialUnit）
useEffect(() => {
  if (artifacts === null) {
    setActiveUnit(null);
    return;
  }
  setActiveUnit(artifacts.initialUnit);
}, [slug, artifacts?.initialUnit]); // artifacts オブジェクト全体に依存させすぎない

const ioLoad =
  inVsCodeWebview() && slug !== null
    ? () => fetchIoPaths(slug, activeUnit)
    : null;
const ioView = useFetchView(ioLoad, [slug, activeUnit]);
const ioPaths =
  ioView?.kind === "success" || ioView?.kind === "partial" ? ioView.value : null;
```

`StageArtifacts` に `unit={activeUnit ?? artifacts.initialUnit}` 等。`activeUnit` が null で cells があるときは `initialUnit` を表示に使い、タブ変更で `setActiveUnit`。

`StageCard` に `ioPaths={ioPaths}` を渡す。

#### StageCard

```ts
function List({
  label,
  items,
  paths,
}: {
  label: string;
  items: string[];
  paths: Record<string, string | null> | null;
}): ReactNode {
  // ...
  // path = paths?.[item] ?? null
  // if path && canOpenDocsInIde() (or inVsCodeWebview):
  //   <button type="button" data-testid={`io-open-${item}`} onClick={() => openFileInIde({ path, line: null }, { beside: true, base: "record" })}>{item}</button>
  // else: text
}
```

- [ ] **Step 1: 失敗する UI テスト**

`stage-io-open.test.tsx`:

- VS Code api を stub（既存 vscode-api テストの手法）。
- matrix に `ops-guides` / `reader-core` の functional-design セル。
- `/api/io-paths` を fetch mock（unit に応じて outputs の path を変える）。
- Unit タブを切り替えると `data-testid=io-open-business-rules` の有無または click 時 path が変わる。
- path null の項目にボタンが無い。
- クリックで `postMessage` が `{ type: "open-file", base: "record", beside: true, path: "..." }`。

- [ ] **Step 2: コンポーネント実装**

- [ ] **Step 3: 関連テスト PASS**

Run:

```bash
bunx vitest run packages/dashboard/tests/stage-io-open.test.tsx packages/dashboard/tests/detail-panel.test.tsx packages/dashboard/tests/components.test.tsx
```

Expected: PASS

- [ ] **Step 4: リポジトリチェック（可能な範囲）**

Run: `bun run check`  
Expected: PASS（時間かかる場合は変更パッケージの vitest + `biome check` + dashboard/extension tsc）

- [ ] **Step 5: Commit（ユーザー承認時のみ）**

```bash
git add packages/dashboard docs/superpowers
git commit -m "$(cat <<'EOF'
feat(dashboard): link stage I/O artifacts to the IDE beside

EOF
)"
```

---

## Spec coverage（自己レビュー）

| 仕様 | タスク |
|------|--------|
| Beside で開く | Task 4, 5, 6 |
| Unit = タブ表示中 | Task 6 |
| 無いものは非リンク | Task 2–3, 6 |
| `/api/io-paths` | Task 3 |
| record 相対 + 封じ込め | Task 4 |
| ブラウザ非リンク | Task 6（`inVsCodeWebview`） |
| 既存 workspace open-file 非回帰 | Task 4, 5 |
| SHARED / STAGE-DIR / UNIT-SCOPED | Task 2, 3 |
| 戻るボタンなし / ArtifactViewer 切替なし | スコープ外（タスク無し） |

## Placeholder scan

TBD/TODO なし。`GuideService` の recordDir アクセサ名は Task 4 でコードを読んで合わせる（実装時の1点確認）。
