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

  it("returns null for prototype-shadowing scope names", async () => {
    const root = await seedFramework();
    // Ensure prototype-chain properties don't bypass the grid-entry check
    await expect(buildPlan(root, "constructor")).resolves.toBeNull();
    await expect(buildPlan(root, "__proto__")).resolves.toBeNull();
    await expect(buildPlan(root, "toString")).resolves.toBeNull();
  });
});
