import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readExcerpt } from "../src/excerpt.ts";
import { agentMap, bridgeMap } from "../src/resolve.ts";
import { REPO_ROOT } from "./paths.ts";

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
    expect(bridgeMap.sourceVersion).toMatch(/aidlc \d+\.\d+\.\d+/);
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
