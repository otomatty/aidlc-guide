# AI-DLC Preflight Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard の空状態（インテント未作成）をプリフライト・ウィザードに置き換え、記述から推定スコープ・プラン見通しをライブ表示し、`claude "/aidlc compose <記述>"` をターミナルへハンドオフする。

**Architecture:** api-core に読み取り専用ルート `/api/preflight` を 1 本追加（静的ファイル read + bun 子プロセス 2 種、fail-soft 部分応答）。dashboard は `NowStrip` の empty 分岐で webview 時のみ `PreflightWizard` を描画。拡張ホストは webview の `start-workflow` メッセージを受けてコマンドを組み立て（サニタイズは単一関数）、ターミナル送出する。書き込みは一切なし。

**Tech Stack:** TypeScript, React (dashboard/webview), VS Code Extension API, bun 子プロセス（execFile 配列形）, Vitest, Biome。

**Spec:** `docs/superpowers/specs/2026-08-20-aidlc-preflight-wizard-design.md`

## Global Constraints

- 拡張は `aidlc/` および aidlc-workflows の状態に対して**読み取り専用**。新規 write ルート禁止（C-T2）。
- `.claude/tools/` へのファイル追加・改変は**禁止**（core 無改変）。既存 export / CLI を子プロセスで呼ぶのみ。
- パスは `node:path` / `vscode.Uri`、子プロセスは `execFile` **配列形**（シェル非経由）、ハードコード区切り文字禁止（C-T4）。
- 新テストはすべて既存の `bun run check` 配下（`packages/<pkg>/tests/*.test.ts(x)`、Vitest）。
- `dashboard` パッケージは `reader-core` を import しない。
- api-core の Biome `noRestrictedImports`（write 系 `node:fs`）はそのまま — 触らない。
- UI 文言は日本語。ステージ状態は色のみに依存させず記号＋テキストラベル併記。
- 記述テキストの上限 8,000 文字（`PREFLIGHT_TEXT_MAX`、handler / textarea / sanitize の三層で適用）。
- コミットメッセージ末尾: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## 検証済みの外部インターフェース（実機確認済み — 変えないこと）

`bun .claude/tools/aidlc-utility.ts detect --json`（cwd=workspaceRoot）は 1 行 JSON を stdout に出す:

```json
{"projectType":"Brownfield","languages":"TypeScript","frameworks":"Unknown","buildSystem":"bun (package.json)","submodules":[],"scopesDir":"...","scopeGridPath":"...","scopes":["bugfix","..."]}
```

`bun -e "import {inferScopeFromText} from './.claude/tools/aidlc-utility.ts'; console.log(JSON.stringify(inferScopeFromText(Bun.argv.at(-1))))" -- "<text>"`（cwd=workspaceRoot、import 副作用なし）は:

```json
{"scope":"bugfix","source":"keyword","matches":[{"scope":"bugfix","keyword":"fix"}]}
```

`.claude/tools/data/stage-graph.json` はキー `"0".."32"` のオブジェクト。各ノード: `{slug, number, name, phase, lead_agent, produces: string[], ...}`。`phase: "initialization"` が 3 ノード。

`.claude/tools/data/scope-grid.json` は `{ "<scope>": { "stages": { "<slug>": "EXECUTE"|"SKIP" } } }`。

`.claude/scopes/aidlc-<name>.md` frontmatter: `name`, `depth`, `keywords: []`, `description`, `skeleton`（`---` 区切り、`key: value` の平 YAML）。grid にエントリの無い scope `.md` が存在しうる（例: `prd-implementation`）— その場合カタログでは executeCount 0 として扱う。

---

### Task 1: shared-types に Preflight 型を追加

**Files:**
- Modify: `packages/shared-types/src/index.ts`（末尾に追記）

**Interfaces:**
- Consumes: なし
- Produces: 下記の型と定数（Task 2, 3, 7 が import する。名前・形を一字も変えないこと）

- [ ] **Step 1: 型を追記**

`packages/shared-types/src/index.ts` の末尾に追加:

```ts
/* ── Preflight (/api/preflight) ──────────────────────────────────────── */

/** 記述テキストの上限。handler / textarea / sanitize の三層で同じ値を使う。 */
export const PREFLIGHT_TEXT_MAX = 8000;

/** `aidlc-utility.ts detect --json` の透過サブセット。 */
export interface PreflightScan {
  projectType: string;
  languages: string;
  frameworks: string;
  buildSystem: string;
}

export interface PreflightScopeSummary {
  name: string;
  description: string;
  depth: string;
  skeleton: string;
  executeCount: number;
  totalCount: number;
  gateCount: number;
}

/** `inferScopeFromText` の透過。 */
export interface PreflightInference {
  scope: string;
  source: "keyword" | "freeform";
  matches: Array<{ scope: string; keyword: string }>;
}

export interface PreflightStage {
  slug: string;
  number: string;
  name: string;
  phase: string;
  decision: "EXECUTE" | "SKIP";
  leadAgent: string;
  gate: boolean;
  produces: string[];
}

export interface PreflightPlan {
  scope: string;
  depth: string;
  skeleton: string;
  executeCount: number;
  totalCount: number;
  gateCount: number;
  phases: Array<{ phase: string; stages: PreflightStage[] }>;
}

/**
 * fail-soft: 取れなかった部分は null + errors に理由コード。
 * ルート全体は常に 200（BR-DS-4 と同じ思想）。
 */
export interface PreflightPayload {
  scan: PreflightScan | null;
  scopes: PreflightScopeSummary[];
  inference: PreflightInference | null;
  plan: PreflightPlan | null;
  cli: { bun: boolean; claude: boolean };
  errors: string[];
}
```

- [ ] **Step 2: 型チェックが通ることを確認**

Run: `bun run check`（型エラーが無いこと。時間がかかるなら `bunx tsc --noEmit -p packages/shared-types` 相当のこのリポジトリの型チェック手段でも可 — `bun run check` が唯一のゲートなので最終的には必ずこちらを通す）

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add /api/preflight payload types"
```

---

### Task 2: api-core preflight ハンドラ — 静的部分（カタログ + プラン導出）

**Files:**
- Create: `packages/api-core/src/handlers/preflight.ts`
- Test: `packages/api-core/tests/preflight.test.ts`

**Interfaces:**
- Consumes: Task 1 の型（`@aidlc-guide/shared-types`）
- Produces:
  - `parseScopeFrontmatter(text: string): { name: string; depth: string; skeleton: string; description: string } | null`
  - `buildCatalog(root: string): Promise<{ scopes: PreflightScopeSummary[]; errors: string[] }>`
  - `buildPlan(root: string, scopeName: string): Promise<PreflightPlan | null>`
  - （Task 3 が同ファイルに `buildPreflight` を足す）

- [ ] **Step 1: 失敗するテストを書く**

`packages/api-core/tests/preflight.test.ts`（既存 `guides.test.ts` の tmp-dir 流儀に合わせる）:

```ts
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCatalog, buildPlan, parseScopeFrontmatter } from "../src/handlers/preflight.ts";

/** 最小 4 ノードのグラフ: init 1 + ideation 1 + construction 2。 */
const GRAPH = {
  "0": { slug: "state-init", number: "0.3", name: "State Init", phase: "initialization",
    lead_agent: "orchestrator", produces: [] },
  "1": { slug: "intent-capture", number: "1.1", name: "Intent Capture", phase: "ideation",
    lead_agent: "aidlc-product-agent", produces: ["intent-statement.md"] },
  "2": { slug: "code-generation", number: "3.5", name: "Code Generation", phase: "construction",
    lead_agent: "aidlc-developer-agent", produces: ["src/"] },
  "3": { slug: "build-and-test", number: "3.6", name: "Build and Test", phase: "construction",
    lead_agent: "aidlc-quality-agent", produces: ["test-report.md"] },
};

const GRID = {
  tiny: { stages: { "state-init": "EXECUTE", "intent-capture": "SKIP",
    "code-generation": "EXECUTE", "build-and-test": "EXECUTE" } },
  full: { stages: { "state-init": "EXECUTE", "intent-capture": "EXECUTE",
    "code-generation": "EXECUTE", "build-and-test": "EXECUTE" } },
};

const TINY_MD = `---
name: tiny
depth: Minimal
keywords: []
description: Small fix path
skeleton: off
---
# tiny scope
`;

const FULL_MD = `---
name: full
depth: Standard
keywords: []
description: Everything
skeleton: on
---
# full scope
`;

/** grid にエントリの無い scope .md（実在例: prd-implementation）。 */
const ORPHAN_MD = `---
name: orphan
depth: Standard
keywords: []
description: No grid entry
skeleton: off
---
`;

async function seedFramework(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "preflight-"));
  const dataDir = path.join(root, ".claude", "tools", "data");
  const scopesDir = path.join(root, ".claude", "scopes");
  await mkdir(dataDir, { recursive: true });
  await mkdir(scopesDir, { recursive: true });
  await writeFile(path.join(dataDir, "stage-graph.json"), JSON.stringify(GRAPH));
  await writeFile(path.join(dataDir, "scope-grid.json"), JSON.stringify(GRID));
  await writeFile(path.join(scopesDir, "aidlc-tiny.md"), TINY_MD);
  await writeFile(path.join(scopesDir, "aidlc-full.md"), FULL_MD);
  await writeFile(path.join(scopesDir, "aidlc-orphan.md"), ORPHAN_MD);
  return root;
}

describe("parseScopeFrontmatter", () => {
  it("reads name/depth/skeleton/description", () => {
    expect(parseScopeFrontmatter(TINY_MD)).toEqual({
      name: "tiny", depth: "Minimal", skeleton: "off", description: "Small fix path",
    });
  });

  it("returns null without frontmatter", () => {
    expect(parseScopeFrontmatter("# no frontmatter\n")).toBeNull();
  });
});

describe("buildCatalog", () => {
  it("summarises every scope .md; missing grid entry means 0 EXECUTE", async () => {
    const root = await seedFramework();
    const { scopes, errors } = await buildCatalog(root);
    expect(errors).toEqual([]);
    expect(scopes.map((s) => s.name).sort()).toEqual(["full", "orphan", "tiny"]);
    const tiny = scopes.find((s) => s.name === "tiny");
    // EXECUTE 3 のうち initialization 1 を除く 2 がゲート。
    expect(tiny).toMatchObject({ executeCount: 3, totalCount: 4, gateCount: 2 });
    expect(scopes.find((s) => s.name === "orphan")).toMatchObject({
      executeCount: 0, gateCount: 0,
    });
  });

  it("reports framework-not-found when .claude data is absent", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "preflight-empty-"));
    const { scopes, errors } = await buildCatalog(root);
    expect(scopes).toEqual([]);
    expect(errors).toContain("framework-not-found");
  });
});

describe("buildPlan", () => {
  it("derives phase-grouped stages with gate flags", async () => {
    const root = await seedFramework();
    const plan = await buildPlan(root, "tiny");
    expect(plan).toMatchObject({
      scope: "tiny", depth: "Minimal", skeleton: "off",
      executeCount: 3, totalCount: 4, gateCount: 2,
    });
    expect(plan?.phases.map((p) => p.phase)).toEqual([
      "initialization", "ideation", "construction",
    ]);
    const init = plan?.phases[0]?.stages[0];
    // initialization の EXECUTE はゲート無し。
    expect(init).toMatchObject({ slug: "state-init", decision: "EXECUTE", gate: false });
    const capture = plan?.phases[1]?.stages[0];
    expect(capture).toMatchObject({
      slug: "intent-capture", decision: "SKIP", gate: false,
      leadAgent: "aidlc-product-agent", produces: ["intent-statement.md"],
    });
    const codegen = plan?.phases[2]?.stages[0];
    expect(codegen).toMatchObject({ slug: "code-generation", decision: "EXECUTE", gate: true });
  });

  it("returns null for an unknown or grid-less scope", async () => {
    const root = await seedFramework();
    await expect(buildPlan(root, "nope")).resolves.toBeNull();
    await expect(buildPlan(root, "orphan")).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `bunx vitest run packages/api-core/tests/preflight.test.ts`
Expected: FAIL（`preflight.ts` が存在しない）

- [ ] **Step 3: 実装**

`packages/api-core/src/handlers/preflight.ts`:

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  PreflightPlan,
  PreflightScopeSummary,
  PreflightStage,
} from "@aidlc-guide/shared-types";

/**
 * /api/preflight の静的部分 — `.claude/` の固定 3 種（stage-graph.json /
 * scope-grid.json / scopes/*.md frontmatter）だけを読む。ユーザー入力を
 * パスに使う経路は無い（S: guardPath 新経路なし）。
 */

interface GraphNode {
  slug: string;
  number: string;
  name: string;
  phase: string;
  lead_agent: string;
  produces: string[];
}

type Grid = Record<string, { stages: Record<string, string> }>;

function dataPath(root: string, file: string): string {
  return path.join(root, ".claude", "tools", "data", file);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function loadGraph(root: string): Promise<GraphNode[] | null> {
  const raw = await readJson<Record<string, GraphNode>>(dataPath(root, "stage-graph.json"));
  if (raw === null) return null;
  return Object.keys(raw)
    .map((k) => Number(k))
    .filter((k) => Number.isInteger(k))
    .sort((a, b) => a - b)
    .map((k) => raw[String(k)])
    .filter((n): n is GraphNode => n !== undefined);
}

export function parseScopeFrontmatter(
  text: string,
): { name: string; depth: string; skeleton: string; description: string } | null {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const fields: Record<string, string> = {};
  for (const line of text.slice(3, end).split(/\r?\n/)) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    fields[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  if (fields.name === undefined) return null;
  return {
    name: fields.name,
    depth: fields.depth ?? "",
    skeleton: fields.skeleton ?? "",
    description: fields.description ?? "",
  };
}

function countsFor(
  graph: GraphNode[],
  stages: Record<string, string>,
): { executeCount: number; totalCount: number; gateCount: number } {
  let executeCount = 0;
  let gateCount = 0;
  for (const node of graph) {
    if (stages[node.slug] !== "EXECUTE") continue;
    executeCount += 1;
    if (node.phase !== "initialization") gateCount += 1;
  }
  return { executeCount, totalCount: graph.length, gateCount };
}

export async function buildCatalog(
  root: string,
): Promise<{ scopes: PreflightScopeSummary[]; errors: string[] }> {
  const graph = await loadGraph(root);
  const grid = await readJson<Grid>(dataPath(root, "scope-grid.json"));
  if (graph === null || grid === null) {
    return { scopes: [], errors: ["framework-not-found"] };
  }

  const scopesDir = path.join(root, ".claude", "scopes");
  let files: string[];
  try {
    files = (await readdir(scopesDir)).filter(
      (f) => f.startsWith("aidlc-") && f.endsWith(".md"),
    );
  } catch {
    return { scopes: [], errors: ["framework-not-found"] };
  }

  const scopes: PreflightScopeSummary[] = [];
  for (const file of files.sort()) {
    let front: ReturnType<typeof parseScopeFrontmatter>;
    try {
      front = parseScopeFrontmatter(await readFile(path.join(scopesDir, file), "utf8"));
    } catch {
      continue;
    }
    if (front === null) continue;
    // grid にエントリの無い scope（composed 等）は all-SKIP として数える。
    const stages = grid[front.name]?.stages ?? {};
    scopes.push({ ...front, ...countsFor(graph, stages) });
  }
  return { scopes, errors: [] };
}

export async function buildPlan(root: string, scopeName: string): Promise<PreflightPlan | null> {
  const graph = await loadGraph(root);
  const grid = await readJson<Grid>(dataPath(root, "scope-grid.json"));
  const entry = grid?.[scopeName];
  if (graph === null || entry === undefined) return null;

  let front: ReturnType<typeof parseScopeFrontmatter> = null;
  try {
    front = parseScopeFrontmatter(
      await readFile(path.join(root, ".claude", "scopes", `aidlc-${scopeName}.md`), "utf8"),
    );
  } catch {
    // frontmatter 無しでもプランは出せる（depth/skeleton が空になるだけ）。
  }

  const phases: Array<{ phase: string; stages: PreflightStage[] }> = [];
  for (const node of graph) {
    const decision = entry.stages[node.slug] === "EXECUTE" ? "EXECUTE" : "SKIP";
    const stage: PreflightStage = {
      slug: node.slug,
      number: node.number,
      name: node.name,
      phase: node.phase,
      decision,
      leadAgent: node.lead_agent,
      gate: decision === "EXECUTE" && node.phase !== "initialization",
      produces: node.produces ?? [],
    };
    const bucket = phases.at(-1);
    if (bucket !== undefined && bucket.phase === node.phase) {
      bucket.stages.push(stage);
    } else {
      phases.push({ phase: node.phase, stages: [stage] });
    }
  }

  return {
    scope: scopeName,
    depth: front?.depth ?? "",
    skeleton: front?.skeleton ?? "",
    ...countsFor(graph, entry.stages),
    phases,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `bunx vitest run packages/api-core/tests/preflight.test.ts`
Expected: PASS（全ケース）

- [ ] **Step 5: Commit**

```bash
git add packages/api-core/src/handlers/preflight.ts packages/api-core/tests/preflight.test.ts
git commit -m "feat(api-core): preflight catalog and plan derivation from compiled scope grid"
```

---

### Task 3: api-core preflight — 子プロセス部分 + `/api/preflight` ルート

**Files:**
- Modify: `packages/api-core/src/handlers/preflight.ts`（Task 2 のファイルに追記）
- Modify: `packages/api-core/src/handlers/read.ts`
- Test: `packages/api-core/tests/preflight.test.ts`（追記）

**Interfaces:**
- Consumes: Task 2 の `buildCatalog` / `buildPlan`、Task 1 の `PreflightPayload` / `PREFLIGHT_TEXT_MAX`
- Produces:
  - `interface PreflightDeps { runBun?: (args: string[], cwd: string) => Promise<string>; probe?: (command: string) => Promise<boolean>; }`
  - `buildPreflight(root: string, rawText: string | null, deps?: PreflightDeps): Promise<PreflightPayload>`
  - ルート: `GET /api/preflight` / `GET /api/preflight?text=...`（常に 200）

- [ ] **Step 1: 失敗するテストを追記**

`packages/api-core/tests/preflight.test.ts` に追記（`seedFramework` を再利用）:

```ts
import { buildPreflight } from "../src/handlers/preflight.ts";

const DETECT_JSON = JSON.stringify({
  projectType: "Brownfield", languages: "TypeScript",
  frameworks: "Unknown", buildSystem: "bun (package.json)",
});

function fakeRun(responses: { detect?: string; infer?: string }) {
  return async (args: string[]): Promise<string> => {
    if (args.includes("detect")) {
      if (responses.detect === undefined) throw new Error("detect boom");
      return responses.detect;
    }
    if (responses.infer === undefined) throw new Error("infer boom");
    return responses.infer;
  };
}

describe("buildPreflight", () => {
  it("static-only when text is null: scan+scopes+cli, no inference/plan", async () => {
    const root = await seedFramework();
    const payload = await buildPreflight(root, null, {
      runBun: fakeRun({ detect: DETECT_JSON }),
      probe: async () => true,
    });
    expect(payload.scan).toMatchObject({ projectType: "Brownfield" });
    expect(payload.scopes.length).toBe(3);
    expect(payload.inference).toBeNull();
    expect(payload.plan).toBeNull();
    expect(payload.cli).toEqual({ bun: true, claude: true });
    expect(payload.errors).toEqual([]);
  });

  it("with text: inference feeds plan", async () => {
    const root = await seedFramework();
    const payload = await buildPreflight(root, "fix the login bug", {
      runBun: fakeRun({
        detect: DETECT_JSON,
        infer: JSON.stringify({
          scope: "tiny", source: "keyword",
          matches: [{ scope: "tiny", keyword: "fix" }],
        }),
      }),
      probe: async () => true,
    });
    expect(payload.inference).toMatchObject({ scope: "tiny", source: "keyword" });
    expect(payload.plan).toMatchObject({ scope: "tiny", executeCount: 3, gateCount: 2 });
  });

  it("fail-soft: subprocess failures null the fields and add error codes", async () => {
    const root = await seedFramework();
    const payload = await buildPreflight(root, "anything", {
      runBun: fakeRun({}), // 両方 throw
      probe: async (cmd) => cmd === "bun",
    });
    expect(payload.scan).toBeNull();
    expect(payload.inference).toBeNull();
    expect(payload.plan).toBeNull();
    expect(payload.scopes.length).toBe(3); // 静的部分は生きる
    expect(payload.errors).toEqual(
      expect.arrayContaining(["detect-failed", "infer-failed"]),
    );
    expect(payload.cli).toEqual({ bun: true, claude: false });
  });

  it("caps text at PREFLIGHT_TEXT_MAX before passing to bun", async () => {
    const root = await seedFramework();
    let seen = "";
    await buildPreflight(root, "あ".repeat(9000), {
      runBun: async (args) => {
        if (args.includes("detect")) return DETECT_JSON;
        seen = args.at(-1) ?? "";
        return JSON.stringify({ scope: "full", source: "freeform", matches: [] });
      },
      probe: async () => true,
    });
    expect(seen.length).toBe(8000);
  });
});
```

さらにルート配線のテスト（同ファイル）:

```ts
import { routeRead } from "../src/handlers/read.ts";

it("routes GET /api/preflight (unknown query keys tolerated)", async () => {
  const root = await seedFramework();
  // ReadContext は preflight では workspaceRoot しか使わない。
  const ctx = {
    workspaceRoot: root,
    officialDocsRoot: root,
    hostMode: false,
    reader: {} as never,
    bridge: {} as never,
    recordDir: async () => ({ error: true as const, reason: "no-active-intent" }),
    matrix: () => null,
  };
  const result = await routeRead(ctx, new URL("http://x/api/preflight"));
  expect(result?.status).toBe(200);
  expect((result?.body as { scopes: unknown[] }).scopes.length).toBe(3);
});
```

（`ctx` の型が合わない場合は `satisfies`/キャストではなく、実在の `ReadContext` フィールドを最小で埋める。既存 `io-paths` 系テストに ReadContext の作り方があればそちらの流儀に合わせる。）

**注記**: この route テストは実 bun を子プロセス起動する（deps 注入がルート経由では出来ないため）。CI に bun は必ずある（このリポジトリ自体が bun 前提）。ただし seedFramework の tmp dir には `aidlc-utility.ts` が無いので detect は `detect-failed` に落ちる — アサーションは「200 で scopes が返る」だけに留める（fail-soft の実地確認を兼ねる）。

- [ ] **Step 2: テストが落ちることを確認**

Run: `bunx vitest run packages/api-core/tests/preflight.test.ts`
Expected: FAIL（`buildPreflight` 未定義 / ルート未配線）

- [ ] **Step 3: 実装**

`preflight.ts` に追記:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PREFLIGHT_TEXT_MAX, type PreflightInference, type PreflightPayload, type PreflightScan } from "@aidlc-guide/shared-types";

const execFileAsync = promisify(execFile);

/**
 * エンジンの純関数を bun ごしに呼ぶ。`.claude/tools/` は一切改変しない
 * （core 無改変）— import 副作用が無いことは実機確認済み。
 */
const INFER_SCRIPT =
  "import {inferScopeFromText} from './.claude/tools/aidlc-utility.ts';" +
  " console.log(JSON.stringify(inferScopeFromText(Bun.argv.at(-1))))";

const SUBPROCESS_TIMEOUT_MS = 5000;

export interface PreflightDeps {
  runBun?: (args: string[], cwd: string) => Promise<string>;
  probe?: (command: string) => Promise<boolean>;
}

async function defaultRunBun(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("bun", args, {
    cwd,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
  return stdout;
}

async function defaultProbe(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ["--version"], { timeout: SUBPROCESS_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

function parseJsonLine<T>(raw: string): T | null {
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    return null;
  }
}

export async function buildPreflight(
  root: string,
  rawText: string | null,
  deps: PreflightDeps = {},
): Promise<PreflightPayload> {
  const runBun = deps.runBun ?? defaultRunBun;
  const probe = deps.probe ?? defaultProbe;
  const errors: string[] = [];

  const [{ scopes, errors: catalogErrors }, bunOk, claudeOk] = await Promise.all([
    buildCatalog(root),
    probe("bun"),
    probe("claude"),
  ]);
  errors.push(...catalogErrors);

  let scan: PreflightScan | null = null;
  try {
    const raw = await runBun([".claude/tools/aidlc-utility.ts", "detect", "--json"], root);
    const parsed = parseJsonLine<PreflightScan & Record<string, unknown>>(raw);
    if (parsed === null) throw new Error("unparseable");
    scan = {
      projectType: String(parsed.projectType ?? ""),
      languages: String(parsed.languages ?? ""),
      frameworks: String(parsed.frameworks ?? ""),
      buildSystem: String(parsed.buildSystem ?? ""),
    };
  } catch {
    errors.push("detect-failed");
  }

  let inference: PreflightInference | null = null;
  let plan: PreflightPayload["plan"] = null;
  const text = rawText?.trim().slice(0, PREFLIGHT_TEXT_MAX) ?? "";
  if (text !== "") {
    try {
      const raw = await runBun(["-e", INFER_SCRIPT, "--", text], root);
      inference = parseJsonLine<PreflightInference>(raw);
      if (inference === null) throw new Error("unparseable");
    } catch {
      inference = null;
      errors.push("infer-failed");
    }
    if (inference !== null) {
      plan = await buildPlan(root, inference.scope);
    }
  }

  return { scan, scopes, inference, plan, cli: { bun: bunOk, claude: claudeOk }, errors };
}
```

`read.ts` の配線 — `routeRead` の `if (route === "/api/guides")` の直後に追加し、import に `buildPreflight` を足す:

```ts
if (route === "/api/preflight") {
  const text = url.searchParams.get("text");
  // fail-soft ペイロード（PreflightPayload 自身が部分応答を表現する）。
  return { status: 200, body: await buildPreflight(ctx.workspaceRoot, text) };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `bunx vitest run packages/api-core/tests/preflight.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api-core/src/handlers/preflight.ts packages/api-core/src/handlers/read.ts packages/api-core/tests/preflight.test.ts
git commit -m "feat(api-core): GET /api/preflight with bun-subprocess scan and scope inference"
```

---

### Task 4: buildComposeCommand（サニタイズ + コマンド組み立て）+ 仕様書の量化改訂

**Files:**
- Create: `packages/vscode-extension/src/compose-command.ts`（`vscode` を import しない — Vitest で素で回すため）
- Test: `packages/vscode-extension/tests/compose-command.test.ts`
- Modify: `docs/superpowers/specs/2026-08-20-aidlc-preflight-wizard-design.md`（§6 の改訂 — 下記）

**Interfaces:**
- Consumes: `PREFLIGHT_TEXT_MAX`（Task 1）
- Produces:
  - `sanitizeComposeText(text: string): string`
  - `buildComposeCommand(text: string): string | null`（空になったら null）

**仕様改訂（同一コミットで spec §6 を書き換える）**: 実装調査の結果、ネストした引用符
（`claude "/aidlc compose \"...\""`）は PowerShell（バックスラッシュがエスケープでない）と
bash で解釈が割れるため、**内側の引用符を使わない**形に変更する:
`claude "/aidlc compose <sanitized text>"`。compose の引数はどのみち LLM が読む自然文で
あり、sanitize が引用符類を除去するため引用の必要がない。除去集合には cmd の `%`（引用内
でも環境変数展開）と bash 対話シェルの `!`（履歴展開）を追加する。spec §6 の該当段落を
この内容に差し替え、§10 のテスト項目の文言も合わせる。

- [ ] **Step 1: 失敗するテストを書く**

`packages/vscode-extension/tests/compose-command.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildComposeCommand, sanitizeComposeText } from "../src/compose-command.ts";

describe("sanitizeComposeText", () => {
  it("strips every shell-significant character", () => {
    expect(sanitizeComposeText('a "b" \'c\' `d` $e \\f %g% h!')).toBe("a b c d e f g h");
  });

  it("collapses whitespace and newlines", () => {
    expect(sanitizeComposeText("line1\nline2\t\tend  ")).toBe("line1 line2 end");
  });

  it("caps at 8000 chars", () => {
    expect(sanitizeComposeText("あ".repeat(9000)).length).toBe(8000);
  });

  it("keeps Japanese text intact", () => {
    expect(sanitizeComposeText("ログインのタイムアウトを直したい")).toBe(
      "ログインのタイムアウトを直したい",
    );
  });
});

describe("buildComposeCommand", () => {
  it("wraps the sanitized text in a single quoting level", () => {
    expect(buildComposeCommand("fix the login bug")).toBe(
      'claude "/aidlc compose fix the login bug"',
    );
  });

  it("returns null when nothing survives sanitisation", () => {
    expect(buildComposeCommand('"`$\\%!')).toBeNull();
    expect(buildComposeCommand("   ")).toBeNull();
  });

  // 否定テスト: 注入形が素通りしないこと。
  it("neutralises command-substitution and expansion attempts", () => {
    const cmd = buildComposeCommand('pwn" ; rm -rf ~ ; echo "$(whoami)`id`%PATH%!!');
    expect(cmd).not.toBeNull();
    for (const banned of ['\\"', "$(", "`", "%PATH%", "\\", "!"]) {
      expect(cmd?.includes(banned)).toBe(false);
    }
    // 外側の 2 個以外に引用符が存在しない。
    expect(cmd?.split('"').length).toBe(3);
    expect(cmd?.startsWith('claude "/aidlc compose ')).toBe(true);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `bunx vitest run packages/vscode-extension/tests/compose-command.test.ts`
Expected: FAIL（モジュール不在）

- [ ] **Step 3: 実装**

`packages/vscode-extension/src/compose-command.ts`:

```ts
import { PREFLIGHT_TEXT_MAX } from "@aidlc-guide/shared-types";

/**
 * ターミナルへ送る 1 行コマンドの唯一の組み立て点。webview からはコマンドを
 * 受け取らない（生テキストのみ）— 信頼境界はここ。
 *
 * VS Code の既定シェルは PowerShell / bash / cmd のどれでもありうるので、
 * ネスト引用やシェル別エスケープはせず「シェルが特別扱いする文字を除去した
 * 自然文を一重の二重引用符で包む」に倒す。除去対象:
 *   " ' ` $ \  … bash/PowerShell の引用内展開・エスケープ
 *   %          … cmd の引用内でも効く環境変数展開
 *   !          … bash 対話シェルの履歴展開（引用内でも効く）
 * compose の引数は LLM が読む自然文なので、除去による意味の欠けは軽微。
 */
export function sanitizeComposeText(text: string): string {
  return text
    .replace(/["'`$\\%!]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PREFLIGHT_TEXT_MAX);
}

export function buildComposeCommand(text: string): string | null {
  const clean = sanitizeComposeText(text);
  if (clean === "") return null;
  return `claude "/aidlc compose ${clean}"`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `bunx vitest run packages/vscode-extension/tests/compose-command.test.ts`
Expected: PASS

- [ ] **Step 5: spec §6（と §10 の該当行）を上記「仕様改訂」どおり書き換える**

- [ ] **Step 6: Commit**

```bash
git add packages/vscode-extension/src/compose-command.ts packages/vscode-extension/tests/compose-command.test.ts docs/superpowers/specs/2026-08-20-aidlc-preflight-wizard-design.md
git commit -m "feat(vscode-extension): single-point compose command builder with cross-shell sanitisation"
```

---

### Task 5: 拡張ホスト — `start-workflow` 受信・ターミナル送出・activation 修正

**Files:**
- Modify: `packages/vscode-extension/src/commands.ts`（`runInTerminal` を export に変更 — 中身は不変）
- Modify: `packages/vscode-extension/src/doctor.ts`（`onPath` を export に変更 — 中身は不変）
- Modify: `packages/vscode-extension/src/dashboard-panel.ts`（`wireWebview` にメッセージ 1 種追加）
- Modify: `packages/vscode-extension/package.json`（activationEvents）

**Interfaces:**
- Consumes: `buildComposeCommand`（Task 4）、`runInTerminal(name, cwd, command)`、`onPath(command)`
- Produces: webview inbound メッセージ `{ type: "start-workflow", text: string }`（Task 7 が送る）

- [ ] **Step 1: export 化**

`commands.ts` 13 行目: `function runInTerminal` → `export function runInTerminal`。
`doctor.ts` 21 行目: `async function onPath` → `export async function onPath`。

- [ ] **Step 2: dashboard-panel.ts にハンドラ追加**

`wireWebview` 内、`if (msg.type === "check-update")` ブロックの直後に追加（import は
`buildComposeCommand`、`runInTerminal`、`onPath`、および `vscode` の `env` を追加）:

```ts
if (msg.type === "start-workflow" && typeof msg.text === "string") {
  const command = buildComposeCommand(msg.text);
  if (command === null) return;
  if (await onPath("claude")) {
    runInTerminal("AI-DLC", workspaceRoot, command);
  } else {
    // claude CLI 不在フォールバック（spec §6/§9）: 同じ組み立て結果をコピー。
    await env.clipboard.writeText(command);
    void window.showInformationMessage(
      "claude CLI が見つかりません。コマンドをコピーしました — Claude Code のターミナルに貼り付けてください。",
    );
  }
  return;
}
```

- [ ] **Step 3: activationEvents 追加**

`packages/vscode-extension/package.json`:

```json
"activationEvents": [
  "workspaceContains:aidlc/",
  "workspaceContains:.claude/skills/aidlc"
],
```

- [ ] **Step 4: 拡張がビルドできることを確認**

Run: `bun run --cwd packages/vscode-extension build`（ルートに拡張ビルドを含む script があるならそちらでも可）
Expected: esbuild 成功

- [ ] **Step 5: Commit**

```bash
git add packages/vscode-extension/src/commands.ts packages/vscode-extension/src/doctor.ts packages/vscode-extension/src/dashboard-panel.ts packages/vscode-extension/package.json
git commit -m "feat(vscode-extension): start-workflow handoff to terminal and pre-aidlc activation"
```

---

### Task 6: derive-view-state — `state-missing` を案内表示に

**Files:**
- Modify: `packages/dashboard/src/store/derive-view-state.ts`
- Modify: `packages/dashboard/src/components/atoms.tsx`（EmptyState のタイトル文言のみ）
- Test: `packages/dashboard/tests/derive-view-state.test.tsx`（追記）

**Interfaces:**
- Consumes: なし
- Produces: `deriveViewState` が `reason: "state-missing"` でも `{ kind: "empty", hint }` を返す

- [ ] **Step 1: 失敗するテストを追記**

`packages/dashboard/tests/derive-view-state.test.tsx` に（既存の no-active-intent → empty のテストの隣に）:

```tsx
it("maps state-missing to empty with guidance, not error", () => {
  const state = deriveViewState({ error: true, reason: "state-missing" });
  expect(state.kind).toBe("empty");
  if (state.kind !== "empty") return;
  expect(state.hint).toContain("aidlc-state.md");
  expect(state.hint).toContain("/aidlc");
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `bunx vitest run packages/dashboard/tests/derive-view-state.test.tsx`
Expected: FAIL（現状は kind: "error"）

- [ ] **Step 3: 実装**

`derive-view-state.ts`:

1. `REASON_TEXT["state-missing"]` を変更:
   `"インテントはありますが状態ファイル (aidlc-state.md) がまだありません。Claude Code の /aidlc が最初のステージで作成します"`
2. `const EMPTY_REASON = "no-active-intent";` を
   `const EMPTY_REASONS: ReadonlySet<string> = new Set(["no-active-intent", "state-missing"]);`
   に変更し、分岐を `EMPTY_REASONS.has(result.reason) ? { kind: "empty", hint: reasonText(result.reason) } : ...` へ。

`atoms.tsx` の `EmptyState`: `<EmptyTitle>インテントがありません</EmptyTitle>` →
`<EmptyTitle>ワークフローはまだありません</EmptyTitle>`（両 reason で真になる文言。
本文の `/aidlc` 案内はそのまま）。

- [ ] **Step 4: dashboard の既存テストごと通ることを確認**

Run: `bunx vitest run packages/dashboard/tests`
Expected: PASS。旧タイトル文言 `インテントがありません` をアサートしているテストが
あれば新文言に更新する（文言変更はこの Task の意図した変更）。

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/store/derive-view-state.ts packages/dashboard/src/components/atoms.tsx packages/dashboard/tests
git commit -m "fix(dashboard): guide instead of red error when aidlc-state.md is not yet created"
```

---

### Task 7: PreflightWizard コンポーネント + NowStrip 統合

**Files:**
- Create: `packages/dashboard/src/components/PreflightWizard.tsx`
- Modify: `packages/dashboard/src/components/NowStrip.tsx`（empty 分岐のみ）
- Test: `packages/dashboard/tests/preflight-wizard.test.tsx`

**Interfaces:**
- Consumes: `/api/preflight`（Task 3 のペイロード）、`getTransport()`（`services/transport/types.ts`）、`vsCodeApi()` / `inVsCodeWebview()`（`services/vscode-api.ts`）、`PREFLIGHT_TEXT_MAX`（Task 1）、`{ type: "start-workflow", text }`（Task 5）
- Produces: `PreflightWizard({ hint, children }): ReactNode`

- [ ] **Step 1: 失敗するテストを書く**

`packages/dashboard/tests/preflight-wizard.test.tsx`（既存 dashboard テストの
render/stub 流儀 — `vi.stubGlobal` で `acquireVsCodeApi`、`setTransport` で偽
transport — に合わせる。fake timers でデバウンスを進める）:

```tsx
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreflightWizard } from "../src/components/PreflightWizard.tsx";
import { setTransport } from "../src/services/transport/types.ts";

const PAYLOAD = {
  scan: { projectType: "Brownfield", languages: "TypeScript", frameworks: "Unknown", buildSystem: "bun (package.json)" },
  scopes: [{ name: "bugfix", description: "Fix a specific bug", depth: "Minimal", skeleton: "off", executeCount: 7, totalCount: 33, gateCount: 4 }],
  inference: null as unknown,
  plan: null as unknown,
  cli: { bun: true, claude: true },
  errors: [] as string[],
};

const WITH_PLAN = {
  ...PAYLOAD,
  inference: { scope: "bugfix", source: "keyword", matches: [{ scope: "bugfix", keyword: "fix" }] },
  plan: {
    scope: "bugfix", depth: "Minimal", skeleton: "off",
    executeCount: 7, totalCount: 33, gateCount: 4,
    phases: [{ phase: "construction", stages: [{ slug: "code-generation", number: "3.5", name: "Code Generation", phase: "construction", decision: "EXECUTE", leadAgent: "aidlc-developer-agent", gate: true, produces: ["src/"] }] }],
  },
};

const postMessage = vi.fn();
let getJson: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
  getJson = vi.fn(async (path: string) =>
    path.includes("text=")
      ? { reached: true, body: WITH_PLAN }
      : { reached: true, body: PAYLOAD },
  );
  setTransport({
    getJson,
    postJson: async () => ({ ok: true, status: 200, body: null }),
    subscribe: () => () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  postMessage.mockClear();
});

describe("PreflightWizard", () => {
  it("loads static preflight on mount and disables start on empty text", async () => {
    render(<PreflightWizard hint="hint" />);
    await waitFor(() => expect(getJson).toHaveBeenCalledWith("/api/preflight"));
    expect(screen.getByTestId("preflight-start")).toBeDisabled();
    expect(screen.getByText(/Brownfield/)).toBeInTheDocument();
  });

  it("debounces typing, shows inferred scope, gates count and disclaimer", async () => {
    const user = userEvent.setup();
    render(<PreflightWizard hint="hint" />);
    await user.type(screen.getByTestId("preflight-text"), "fix the login bug");
    await waitFor(() =>
      expect(getJson).toHaveBeenCalledWith(
        `/api/preflight?text=${encodeURIComponent("fix the login bug")}`,
      ),
    );
    await screen.findByTestId("preflight-readout");
    expect(screen.getByTestId("preflight-scope").textContent).toContain("bugfix");
    expect(screen.getByTestId("preflight-scope").textContent).toContain("fix");
    expect(screen.getByTestId("preflight-gates").textContent).toContain("4");
    // プレビュー ≠ 約束 の注記（spec §4）。
    expect(screen.getByText(/これは見通しです/)).toBeInTheDocument();
    // EXECUTE/SKIP はテキストラベル（色のみ禁止）。
    expect(screen.getByText("EXECUTE")).toBeInTheDocument();
  });

  it("start posts start-workflow with the raw text", async () => {
    const user = userEvent.setup();
    render(<PreflightWizard hint="hint" />);
    await user.type(screen.getByTestId("preflight-text"), "fix the login bug");
    await waitFor(() => expect(screen.getByTestId("preflight-start")).toBeEnabled());
    await user.click(screen.getByTestId("preflight-start"));
    expect(postMessage).toHaveBeenCalledWith({
      type: "start-workflow",
      text: "fix the login bug",
    });
  });

  it("degrades to static info with a setup hint when subprocess data is missing", async () => {
    getJson.mockImplementation(async () => ({
      reached: true,
      body: { ...PAYLOAD, scan: null, errors: ["detect-failed"] },
    }));
    render(<PreflightWizard hint="hint" />);
    await screen.findByTestId("preflight-degraded");
    // 静的カタログは出る。
    expect(screen.getByText(/bugfix/)).toBeInTheDocument();
  });
});
```

NowStrip 統合テスト（同ファイルに追記）:

```tsx
import { NowStrip } from "../src/components/NowStrip.tsx";

describe("NowStrip empty branch", () => {
  it("renders the wizard in a VS Code webview", () => {
    render(<NowStrip state={{ kind: "empty", hint: "h" }} onRetry={() => {}} />);
    expect(screen.getByTestId("preflight-text")).toBeInTheDocument();
  });

  it("keeps the plain EmptyState outside the webview (browser/hostMode)", () => {
    vi.unstubAllGlobals(); // acquireVsCodeApi 無し = ブラウザ
    render(<NowStrip state={{ kind: "empty", hint: "h" }} onRetry={() => {}} />);
    expect(screen.queryByTestId("preflight-text")).toBeNull();
    expect(screen.getByText("ワークフローはまだありません")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `bunx vitest run packages/dashboard/tests/preflight-wizard.test.tsx`
Expected: FAIL（コンポーネント不在）

- [ ] **Step 3: PreflightWizard 実装**

`packages/dashboard/src/components/PreflightWizard.tsx` — 実装の骨格（既存 shadcn/ui
プリミティブ `Button` / `Empty` 系、`Badge` を再利用。スタイルは Tailwind クラスで
NowStrip と同調させる）:

```tsx
import { PREFLIGHT_TEXT_MAX, type PreflightPayload } from "@aidlc-guide/shared-types";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTransport } from "../services/transport/types.ts";
import { vsCodeApi } from "../services/vscode-api.ts";

const DEBOUNCE_MS = 400;

/**
 * インテント未作成時の開始ウィザード（spec 2026-08-20 §4）。読み取り専用 —
 * 書き込みはゼロで、開始は拡張ホストへの `start-workflow` ハンドオフのみ。
 * 表示ゲート（webview のみ）は NowStrip 側が持つ。
 */
export function PreflightWizard({
  hint,
  children,
}: {
  hint: string;
  children?: ReactNode;
}): ReactNode {
  const [text, setText] = useState("");
  const [data, setData] = useState<PreflightPayload | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 静的部分（scan/scopes/cli）は初回応答を保持し、以降は
  // inference/plan だけ差し替える（spec §4「1 回取得して保持」）。
  const staticPart = useRef<Pick<PreflightPayload, "scan" | "scopes" | "cli"> | null>(null);

  const fetchPreflight = async (query: string) => {
    const result = await getTransport().getJson(
      query === "" ? "/api/preflight" : `/api/preflight?text=${encodeURIComponent(query)}`,
    );
    if (!result.reached) return;
    const body = result.body as PreflightPayload;
    if (staticPart.current === null && body.scan !== null) {
      staticPart.current = { scan: body.scan, scopes: body.scopes, cli: body.cli };
    }
    setData(staticPart.current === null ? body : { ...body, ...staticPart.current });
  };

  useEffect(() => {
    void fetchPreflight("");
    // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  }, []);

  const onChange = (value: string) => {
    setText(value);
    if (timer.current !== null) clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed === "") return;
    timer.current = setTimeout(() => void fetchPreflight(trimmed), DEBOUNCE_MS);
  };

  const start = () => {
    vsCodeApi()?.postMessage({ type: "start-workflow", text });
  };

  /* 描画: ①textarea ②readout ③開始ボタン。詳細はテストの data-testid が契約。 */
  // …（実装者はテストを満たす JSX を書く。必須要素:
  //  - <textarea data-testid="preflight-text" maxLength={PREFLIGHT_TEXT_MAX} …>
  //  - スキャン 1 行（scan があるとき）: `${scan.projectType} / ${scan.languages} / ${scan.buildSystem}`
  //  - data-testid="preflight-readout"（inference && plan があるとき）内に:
  //      data-testid="preflight-scope" … 推定スコープ + 根拠（keyword: matches[0].keyword / freeform は「既定」）
  //      data-testid="preflight-gates" … `承認ゲート ${plan.gateCount} 回` + `${plan.executeCount} / ${plan.totalCount} ステージ` + depth + skeleton
  //      <details> でフェーズ別ステージ一覧: 各行 = number + name + <Badge>EXECUTE|SKIP</Badge> + leadAgent + produces
  //  - 常時表示の注記: 「これは見通しです。実際のプランは composer が提案し、approve / edit / reject ゲートであなたが確定します。」
  //  - data-testid="preflight-degraded"（errors に detect-failed/framework-not-found/bun-not-found を含むとき）:
  //      「環境情報を取得できませんでした。AIDLC Guide: Setup で状態を確認してください。」+ scopes カタログの簡易リスト
  //  - claude CLI 不在（cli.claude === false）のときはボタンラベルを「コマンドをコピー」に
  //  - <Button data-testid="preflight-start" disabled={text.trim() === ""} onClick={start}>
  //  - hint と children（IntentPicker）を末尾に）
}
```

（コメント枠の JSX はプラン上の省略ではなく「テストが契約」という指示 — 実装者は
Step 1 のテストと上記必須要素リストを満たす JSX を書き切ること。文言はリスト内の
文字列をそのまま使う。）

- [ ] **Step 4: NowStrip の empty 分岐を差し替え**

`NowStrip.tsx` — import に `inVsCodeWebview`（`../services/vscode-api.ts`）と
`PreflightWizard` を追加し、102 行目付近:

```tsx
) : state.kind === "empty" ? (
  inVsCodeWebview() ? (
    <PreflightWizard hint={state.hint}>{intentPicker}</PreflightWizard>
  ) : (
    <EmptyState hint={state.hint}>{intentPicker}</EmptyState>
  )
) : state.kind === "error" ? (
```

- [ ] **Step 5: テストが通ることを確認（dashboard 全体）**

Run: `bunx vitest run packages/dashboard/tests`
Expected: PASS（`app.test.tsx` 等の既存テストは webview stub 無しなら従来 EmptyState
経路のまま通るはず。webview stub 下で empty を踏むテストがあれば wizard 表示に
合わせて更新）

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/components/PreflightWizard.tsx packages/dashboard/src/components/NowStrip.tsx packages/dashboard/tests/preflight-wizard.test.tsx
git commit -m "feat(dashboard): preflight wizard replaces the empty state inside the VS Code webview"
```

---

### Task 8: 実グリッド・カナリアテストと全体検証

**Files:**
- Test: `packages/api-core/tests/preflight.test.ts`（追記）
- （必要なら）Modify: 各所の lint 指摘修正

- [ ] **Step 1: 実リポジトリの compiled grid に対するカナリアを追記**

spec §10: 「grid が変わればテストが知らせる」。リポジトリルート（`packages/api-core`
から 2 つ上）の実 `.claude/` に対して:

```ts
describe("real compiled grid canary", () => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");

  it("bugfix: 7 execute / 4 gates; feature: 33 execute / 30 gates", async () => {
    const bugfix = await buildPlan(repoRoot, "bugfix");
    expect(bugfix).toMatchObject({ executeCount: 7, totalCount: 33, gateCount: 4 });
    const feature = await buildPlan(repoRoot, "feature");
    expect(feature).toMatchObject({ executeCount: 33, gateCount: 30 });
  });
});
```

（落ちた場合はフレームワーク更新で grid が変わったということ — 数字をその時の
実値に更新するのがこのテストの運用。）

- [ ] **Step 2: webview バンドルの再ビルド**

Run: ルート `package.json` の `build:extension`（`vite build packages/dashboard --mode webview` + copy + esbuild）
Expected: 成功。`media/dashboard` に新 UI が入る。

- [ ] **Step 3: 単一品質ゲート**

Run: `bun run check`
Expected: PASS（Biome / 型 / 全パッケージの Vitest / bun audit を含む既存定義のまま。
失敗したら該当箇所を直す — ゲート定義自体には触らない）

- [ ] **Step 4: 手動スモーク（Extension Development Host）**

1. `aidlc/` はあるがインテントの無いワークスペースで Dashboard を開く → ウィザード表示。
2. 「ログインのバグを直したい」と入力 → `bugfix` 推定・ゲート 4 回・ステージ一覧が出る。
3. 開始 → ターミナル「AI-DLC」が開き `claude "/aidlc compose ログインのバグを直したい"` が流れる。
4. ブラウザ（dashboard-server）で同状態 → ウィザードは出ず従来 EmptyState。

- [ ] **Step 5: Commit**

```bash
git add packages/api-core/tests/preflight.test.ts
git commit -m "test(api-core): canary preflight counts against the real compiled scope grid"
```
