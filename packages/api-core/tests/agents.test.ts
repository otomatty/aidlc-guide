import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readAgentKnowledge, resolveAgent } from "../src/handlers/agents.ts";

async function seedAgentTree(
  files: Readonly<{
    agent?: Readonly<Record<string, string>>;
    knowledge?: Readonly<Record<string, string>>;
  }>,
  agentId = "aidlc-quality-agent",
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "agents-"));
  if (files.agent !== undefined) {
    const dir = path.join(root, ".claude", "agents");
    await mkdir(dir, { recursive: true });
    for (const [name, body] of Object.entries(files.agent)) {
      await writeFile(path.join(dir, name), body);
    }
  }
  if (files.knowledge !== undefined) {
    const dir = path.join(root, ".claude", "knowledge", agentId);
    await mkdir(dir, { recursive: true });
    for (const [name, body] of Object.entries(files.knowledge)) {
      await writeFile(path.join(dir, name), body);
    }
  }
  return root;
}

describe("resolveAgent / readAgentKnowledge", () => {
  it("reads persona frontmatter when no Japanese map entry exists", async () => {
    const root = await seedAgentTree(
      {
        agent: {
          "aidlc-custom-agent.md": `---
display_name: Custom Agent
description: >
  Custom persona for tests.
---
# Custom Agent

Body text.
`,
        },
        knowledge: {
          "testing-guide.md": "# Testing Guide\n",
          "notes.txt": "ignored",
        },
      },
      "aidlc-custom-agent",
    );

    const resolved = await resolveAgent(root, "aidlc-custom-agent");
    expect(resolved).toMatchObject({ ok: true });
    if (!("ok" in resolved)) return;
    expect(resolved.value.displayName).toBe("Custom Agent");
    expect(resolved.value.description).toBe("Custom persona for tests.");
    expect(resolved.value.markdown).toContain("# Custom Agent");
    expect(resolved.value.stages).toEqual([]);
    expect(resolved.value.knowledge.map((item) => item.name)).toEqual(["testing-guide.md"]);
    expect(resolved.value.knowledge[0]?.title).toBe("Testing Guide");
  });

  it("lists stages and knowledge for a mapped agent", async () => {
    const root = await seedAgentTree({
      knowledge: {
        "testing-guide.md": "# Testing Guide\n",
      },
    });
    const resolved = await resolveAgent(root, "aidlc-quality-agent");
    expect(resolved).toMatchObject({ ok: true });
    if (!("ok" in resolved)) return;
    expect(resolved.value.stages).toContain("build-and-test");
    expect(resolved.value.knowledge.map((item) => item.name)).toEqual(["testing-guide.md"]);
  });

  it("uses the Japanese agent-map when the persona file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agents-fallback-"));
    const resolved = await resolveAgent(root, "orchestrator");
    expect(resolved).toMatchObject({
      ok: true,
      value: {
        id: "orchestrator",
        displayName: "オーケストレータ",
        stages: expect.arrayContaining(["workspace-scaffold"]),
        knowledge: [],
      },
    });
    if (!("ok" in resolved)) return;
    expect(resolved.value.description.length).toBeGreaterThan(10);
    expect(resolved.value.markdown).toContain("オーケストレータ");
  });

  it("prefers Japanese agent-map over English persona frontmatter", async () => {
    const root = await seedAgentTree({
      agent: {
        "aidlc-quality-agent.md": `---
display_name: Quality Agent
description: English-only description.
---
# Quality Agent
`,
      },
    });
    const resolved = await resolveAgent(root, "aidlc-quality-agent");
    expect(resolved).toMatchObject({ ok: true });
    if (!("ok" in resolved)) return;
    expect(resolved.value.displayName).toBe("品質エージェント");
    expect(resolved.value.description).toContain("QA");
    expect(resolved.value.markdown).toContain("品質エージェント");
    expect(resolved.value.description).not.toBe("English-only description.");
  });

  it("reads knowledge bodies and refuses path traversal", async () => {
    const root = await seedAgentTree({
      knowledge: { "testing-guide.md": "# Testing Guide\n\nBody.\n" },
    });

    const ok = await readAgentKnowledge(root, "aidlc-quality-agent", "testing-guide.md");
    expect(ok).toEqual({
      ok: true,
      value: {
        name: "testing-guide.md",
        title: "Testing Guide",
        markdown: "# Testing Guide\n\nBody.\n",
      },
    });

    await expect(readAgentKnowledge(root, "aidlc-quality-agent", "../secrets.md")).resolves.toEqual(
      {
        error: true,
        reason: "not-found",
      },
    );
    await expect(readAgentKnowledge(root, "aidlc-quality-agent", "nope.md")).resolves.toEqual({
      error: true,
      reason: "not-found",
    });
    await expect(readAgentKnowledge(root, "../evil", "testing-guide.md")).resolves.toEqual({
      error: true,
      reason: "not-found",
    });
  });
});
