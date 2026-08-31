import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { BridgeConfig } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { readExcerpt } from "../src/excerpt.ts";
import { agentMap, bridgeMap, resolveTerm } from "../src/resolve.ts";
import { expectOk, REPO_ROOT } from "./paths.ts";

const noDocs: BridgeConfig = {
  docsRepoPath: null,
  docsBaseUrl: null,
  stageDocs: {},
  projectLinks: [],
};

/**
 * US-03 AC ⑤ / R-DB-4 — every `docPath` + `docAnchor` in bridge-map.json must
 * resolve against the real docs tree. This is what stops the map rotting into
 * a wall of dead deep links when aidlc-workflows moves a heading.
 *
 * Skipped when the docs tree is not available (docs-bridge consumed standalone);
 * mandatory at build-and-test, where a docs checkout is a precondition.
 */
const docsAvailable = existsSync(path.join(REPO_ROOT, ".claude", "aidlc-common", "stages"));

if (!docsAvailable) {
  console.warn(
    `[data-lint] docs tree not found under ${REPO_ROOT} — bridge-map link check SKIPPED`,
  );
}

const stageEntries = Object.entries(bridgeMap.stages);
const termEntries = Object.entries(bridgeMap.terms);

describe.skipIf(!docsAvailable)("bridge-map data-lint", () => {
  it("covers all 33 stages of the compiled stage graph", () => {
    expect(stageEntries).toHaveLength(33);
  });

  it.each(stageEntries)("stage %s resolves to a real section", async (slug, entry) => {
    const result = await readExcerpt(REPO_ROOT, entry.docPath, entry.docAnchor);
    expect(result.warning, `${slug} -> ${entry.docPath}${entry.docAnchor}`).toBeUndefined();
    expect(result.excerpt).not.toBeNull();
  });

  it.each(termEntries)("term %s resolves to a real section", async (term, entry) => {
    const result = await readExcerpt(REPO_ROOT, entry.docPath, entry.docAnchor);
    expect(result.warning, `${term} -> ${entry.docPath}${entry.docAnchor}`).toBeUndefined();
    expect(result.excerpt).not.toBeNull();
  });

  it("keys every stage entry by the slug the stage file declares", async () => {
    const { readFile } = await import("node:fs/promises");
    for (const [slug, entry] of stageEntries) {
      const text = await readFile(path.join(REPO_ROOT, entry.docPath), "utf8");
      expect(text, `${slug} docPath points at the wrong stage file`).toContain(`slug: ${slug}`);
    }
  });
});

describe("bridge-map shape (no docs tree required)", () => {
  it("has a sourceVersion naming the framework release it was synced against", () => {
    expect(bridgeMap.sourceVersion).toBe("aidlc 2.6.124 (State Version 8)");
  });

  it("defines classic and express scopes with non-empty Japanese definitions", () => {
    expect(bridgeMap.terms.classic?.definition.trim()).not.toBe("");
    expect(bridgeMap.terms.express?.definition.trim()).not.toBe("");
    expect(bridgeMap.terms.classic?.definition).toMatch(/[ぁ-んァ-ヶ一-龯]/);
    expect(bridgeMap.terms.express?.definition).toMatch(/[ぁ-んァ-ヶ一-龯]/);
  });

  it("resolves classic scope term without docs", async () => {
    const { value } = expectOk(await resolveTerm(noDocs, "classic"));
    expect(value.term).toBe("classic");
    expect(value.definition).toMatch(/v1|アイデア化/);
    expect(value.deepLink?.docPath).toBe(".claude/scopes/aidlc-classic.md");
    expect(value.deepLink?.docAnchor).toBe("#classic-scope");
    expect(value.sourceVersion).toBe("aidlc 2.6.124 (State Version 8)");
  });

  it("resolves express scope term without docs", async () => {
    const { value } = expectOk(await resolveTerm(noDocs, "express"));
    expect(value.term).toBe("express");
    expect(value.definition).toMatch(/最軽量|要件/);
    expect(value.deepLink?.docPath).toBe(".claude/scopes/aidlc-express.md");
    expect(value.deepLink?.docAnchor).toBe("#express-scope");
    expect(value.sourceVersion).toBe("aidlc 2.6.124 (State Version 8)");
  });

  it.each(stageEntries)("stage %s has all four US-03 fields populated", (_slug, entry) => {
    expect(entry.purpose.trim()).not.toBe("");
    expect(entry.agent.trim()).not.toBe("");
    expect(entry.gateRequirement.trim()).not.toBe("");
    expect(Array.isArray(entry.inputs)).toBe(true);
    expect(Array.isArray(entry.outputs)).toBe(true);
  });

  it.each(termEntries)("term %s is lowercase-normalised and defined", (term, entry) => {
    expect(term).toBe(term.trim().toLowerCase());
    expect(entry.definition.trim()).not.toBe("");
  });
});

/**
 * R-DB-4 (mechanical half) — `sourceVersion` is a *claim* about which
 * aidlc-workflows release the map was synced against. The excerpt checks above
 * only prove the deep links still land; they say nothing about whether the
 * artifact lists still match what the stage actually declares. This block reads
 * the compiled stage graph shipped with the installed framework and asserts the
 * claim mechanically, so an upgrade that moves a `produces:`/`consumes:` entry
 * fails the gate instead of rotting the map silently.
 */
const stageGraphPath = path.join(REPO_ROOT, ".claude", "tools", "data", "stage-graph.json");
const graphAvailable = existsSync(stageGraphPath);

if (!graphAvailable) {
  console.warn(`[data-lint] ${stageGraphPath} not found — stage-graph parity check SKIPPED`);
}

describe.skipIf(!graphAvailable)("bridge-map matches the installed stage graph", () => {
  type GraphNode = {
    slug: string;
    lead_agent: string;
    produces: string[];
    consumes: { artifact: string }[];
  };

  const graph: Map<string, GraphNode> = new Map(
    (JSON.parse(readFileSync(stageGraphPath, "utf8")) as GraphNode[]).map((node) => [
      node.slug,
      node,
    ]),
  );

  it("covers exactly the stages the graph declares", () => {
    expect([...Object.keys(bridgeMap.stages)].sort()).toEqual([...graph.keys()].sort());
  });

  it.each(stageEntries)("stage %s declares the graph's inputs/outputs/agent", (slug, entry) => {
    const node = graph.get(slug);
    expect(node, `${slug} is not in the compiled stage graph`).toBeDefined();
    if (!node) return;
    expect(entry.inputs, `${slug} inputs drifted from consumes`).toEqual(
      node.consumes.map((c) => c.artifact),
    );
    expect(entry.outputs, `${slug} outputs drifted from produces`).toEqual(node.produces);
    expect(entry.agent, `${slug} agent drifted from lead_agent`).toBe(node.lead_agent);
  });
});

describe("agent-map shape", () => {
  const agentEntries = Object.entries(agentMap.agents);

  it("has a sourceVersion naming the framework release it was synced against", () => {
    expect(agentMap.sourceVersion).toMatch(/aidlc \d+\.\d+\.\d+/);
  });

  it.each(agentEntries)("agent %s has Japanese learner-facing fields", (_id, entry) => {
    expect(entry.displayName.trim()).not.toBe("");
    expect(entry.description.trim()).not.toBe("");
    expect(entry.markdown.trim()).not.toBe("");
    expect(entry.displayName).toMatch(/[ぁ-んァ-ヶ一-龯]/);
  });

  it("covers every lead agent referenced by bridge-map stages", () => {
    const leads = new Set(Object.values(bridgeMap.stages).map((entry) => entry.agent));
    for (const lead of leads) {
      expect(agentMap.agents[lead], `missing agent-map entry for ${lead}`).toBeDefined();
    }
  });
});
