import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCatalog,
  buildPlan,
  buildPreflight,
  parseScopeFrontmatter,
} from "../src/handlers/preflight.ts";
import { routeRead } from "../src/handlers/read.ts";

/** 最小 4 ノードのグラフ: init 1 + ideation 1 + construction 2。 */
const GRAPH = {
  "0": {
    slug: "state-init",
    number: "0.3",
    name: "State Init",
    phase: "initialization",
    lead_agent: "orchestrator",
    produces: [],
  },
  "1": {
    slug: "intent-capture",
    number: "1.1",
    name: "Intent Capture",
    phase: "ideation",
    lead_agent: "aidlc-product-agent",
    produces: ["intent-statement.md"],
  },
  "2": {
    slug: "code-generation",
    number: "3.5",
    name: "Code Generation",
    phase: "construction",
    lead_agent: "aidlc-developer-agent",
    produces: ["src/"],
  },
  "3": {
    slug: "build-and-test",
    number: "3.6",
    name: "Build and Test",
    phase: "construction",
    lead_agent: "aidlc-quality-agent",
    produces: ["test-report.md"],
  },
};

const GRID = {
  tiny: {
    stages: {
      "state-init": "EXECUTE",
      "intent-capture": "SKIP",
      "code-generation": "EXECUTE",
      "build-and-test": "EXECUTE",
    },
  },
  full: {
    stages: {
      "state-init": "EXECUTE",
      "intent-capture": "EXECUTE",
      "code-generation": "EXECUTE",
      "build-and-test": "EXECUTE",
    },
  },
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
      name: "tiny",
      depth: "Minimal",
      skeleton: "off",
      description: "Small fix path",
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
      executeCount: 0,
      gateCount: 0,
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
      scope: "tiny",
      depth: "Minimal",
      skeleton: "off",
      executeCount: 3,
      totalCount: 4,
      gateCount: 2,
    });
    expect(plan?.phases.map((p) => p.phase)).toEqual([
      "initialization",
      "ideation",
      "construction",
    ]);
    const init = plan?.phases[0]?.stages[0];
    // initialization の EXECUTE はゲート無し。
    expect(init).toMatchObject({ slug: "state-init", decision: "EXECUTE", gate: false });
    const capture = plan?.phases[1]?.stages[0];
    expect(capture).toMatchObject({
      slug: "intent-capture",
      decision: "SKIP",
      gate: false,
      leadAgent: "aidlc-product-agent",
      produces: ["intent-statement.md"],
    });
    const codegen = plan?.phases[2]?.stages[0];
    expect(codegen).toMatchObject({ slug: "code-generation", decision: "EXECUTE", gate: true });
  });

  it("returns null for an unknown or grid-less scope", async () => {
    const root = await seedFramework();
    await expect(buildPlan(root, "nope")).resolves.toBeNull();
    await expect(buildPlan(root, "orphan")).resolves.toBeNull();
  });

  it("returns null for prototype-shadowing scope names", async () => {
    const root = await seedFramework();
    // Ensure prototype-chain properties don't bypass the grid-entry check
    await expect(buildPlan(root, "constructor")).resolves.toBeNull();
    await expect(buildPlan(root, "__proto__")).resolves.toBeNull();
    await expect(buildPlan(root, "toString")).resolves.toBeNull();
  });
});

const DETECT_JSON = JSON.stringify({
  projectType: "Brownfield",
  languages: "TypeScript",
  frameworks: "Unknown",
  buildSystem: "bun (package.json)",
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

  it("with text: inference feeds plan, and skips catalog/detect/probes entirely", async () => {
    const root = await seedFramework();
    const calls: string[][] = [];
    const payload = await buildPreflight(root, "fix the login bug", {
      runBun: async (args) => {
        calls.push(args);
        if (args.includes("detect")) throw new Error("detect must not run for a text request");
        return JSON.stringify({
          scope: "tiny",
          source: "keyword",
          matches: [{ scope: "tiny", keyword: "fix" }],
        });
      },
      probe: async () => {
        throw new Error("probes must not run for a text request");
      },
    });
    expect(payload.inference).toMatchObject({ scope: "tiny", source: "keyword" });
    expect(payload.plan).toMatchObject({ scope: "tiny", executeCount: 3, gateCount: 2 });
    // Discarded-response contract (finding 2): text requests are
    // inference-only — the static part comes back empty/null, not stale.
    expect(payload.scan).toBeNull();
    expect(payload.scopes).toEqual([]);
    expect(payload.cli).toBeNull();
    expect(payload.errors).toEqual([]);
    expect(calls.length).toBe(1); // only the inference subprocess ran
  });

  it("fail-soft with text: infer failure adds infer-failed only (detect/probes never attempted)", async () => {
    const root = await seedFramework();
    const payload = await buildPreflight(root, "anything", {
      runBun: fakeRun({}), // infer throws if called; detect throws if called
      probe: async () => {
        throw new Error("probes must not run for a text request");
      },
    });
    expect(payload.scan).toBeNull();
    expect(payload.inference).toBeNull();
    expect(payload.plan).toBeNull();
    expect(payload.scopes).toEqual([]);
    expect(payload.cli).toBeNull();
    expect(payload.errors).toEqual(["infer-failed"]);
  });

  it("fail-soft without text: subprocess failures null the fields and add error codes", async () => {
    const root = await seedFramework();
    const payload = await buildPreflight(root, null, {
      runBun: fakeRun({}), // detect throws
      probe: async (cmd) => cmd === "bun",
    });
    expect(payload.scan).toBeNull();
    expect(payload.inference).toBeNull();
    expect(payload.plan).toBeNull();
    expect(payload.scopes.length).toBe(3); // 静的部分は生きる
    expect(payload.errors).toEqual(["detect-failed"]);
    expect(payload.cli).toEqual({ bun: true, claude: false });
  });

  it("caps text at PREFLIGHT_TEXT_MAX before passing to bun", async () => {
    const root = await seedFramework();
    let seen = "";
    await buildPreflight(root, "あ".repeat(9000), {
      runBun: async (args) => {
        seen = args.at(-1) ?? "";
        return JSON.stringify({ scope: "full", source: "freeform", matches: [] });
      },
    });
    expect(seen.length).toBe(8000);
  });
});

describe("real compiled grid canary", () => {
  // packages/api-core/tests から 3 つ上でリポジトリルート（.claude/ の親）。
  const repoRoot = path.resolve(__dirname, "..", "..", "..");

  it("bugfix: 9 execute / 6 gates; feature: 33 execute / 30 gates", async () => {
    const bugfix = await buildPlan(repoRoot, "bugfix");
    expect(bugfix).toMatchObject({ executeCount: 9, totalCount: 33, gateCount: 6 });
    const feature = await buildPlan(repoRoot, "feature");
    expect(feature).toMatchObject({ executeCount: 33, gateCount: 30 });
  });
});

describe("routeRead /api/preflight", () => {
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
    expect((result?.body as { scopes: unknown[] } | undefined)?.scopes.length).toBe(3);
  });
});
