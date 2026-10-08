import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DIAGRAM_REQUIRED, SCOPE } from "../tools/focus-diagram.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const list = (relative: string) =>
  readdirSync(path.join(root, relative))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `${relative}/${name}`);

function frontmatter(text: string): string {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match?.[1]) throw new Error("frontmatter missing");
  return match[1];
}
function scalar(text: string, key: string): string | undefined {
  return new RegExp(`^${key}:\\s*(.+)$`, "m").exec(frontmatter(text))?.[1]?.trim();
}
function listField(text: string, key: string): string[] {
  const block = new RegExp(`^${key}:\\n((?:\\s+- .+\\n?)+)`, "m").exec(frontmatter(text))?.[1];
  return (block ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s+- /, "").trim())
    .filter(Boolean);
}

const contributions = list("contributions/inception");
const stages = list("stages/construction");
const agents = list("agents");

describe("contributions to core stages", () => {
  it("cover the core stages the focus-flow scope runs", () => {
    expect(contributions.map((file) => path.basename(file, ".md")).sort()).toEqual([
      "delivery-planning",
      "domain-design",
      "requirements-analysis",
      "reverse-engineering",
      "units-generation",
    ]);
  });

  it.each(contributions)("%s joins focus-flow and the diagram check", (file) => {
    const text = read(file);
    expect(scalar(text, "target")).toBe(path.basename(file, ".md"));
    expect(text).toMatch(/adds:\n {2}scopes:\n {4}- focus-flow\n/);
    expect(text).toMatch(/ {2}sensors:\n {4}- focus-diagrams\n/);
  });

  it.each(contributions)(
    "%s applies only under focus-flow, before the core stage reports completion",
    (file) => {
      const text = read(file);
      const slug = path.basename(file, ".md");
      // The pinned core stage this repository ships; plugin-test fails on a missing anchor.
      const core = readFileSync(
        path.join(root, "../../.claude/aidlc-common/stages/inception", `${slug}.md`),
        "utf8",
      );
      const handoff = /^### Step (\d+): Completion Handoff$/m.exec(core)?.[1];
      expect(handoff).toBeDefined();
      const fragments = text.split(/^## fragment: /m).slice(1);
      expect(fragments.map((fragment) => fragment.split("\n")[0])).toEqual([
        "before-step:1",
        `before-step:${handoff}`,
      ]);
      for (const fragment of fragments)
        expect(fragment).toContain(
          "`aidlc-state.md` の `**Scope**` が `focus-flow` のときだけ、この節に従う。",
        );
    },
  );

  it.each(["reverse-engineering", "requirements-analysis"])(
    "%s secures a work branch before the first commit can happen",
    (slug) => {
      const first = read(`contributions/inception/${slug}.md`).split(/^## fragment: /m)[1] ?? "";
      expect(first).toContain("作業ブランチ");
    },
  );
});

describe("construction stages", () => {
  it.each(stages)("%s is a per-Unit focus-flow stage that binds its source", (file) => {
    const text = read(file);
    const slug = path.basename(file, ".md");
    expect(scalar(text, "slug")).toBe(slug);
    expect(scalar(text, "plugin")).toBe("focus");
    expect(scalar(text, "for_each")).toBe("unit-of-work");
    expect(scalar(text, "workspace_requires")).toBe("true");
    expect(scalar(text, "mode")).toBe("subagent");
    expect(listField(text, "scopes")).toEqual([SCOPE]);
    expect(text).toContain("## Steps");
    expect(text).toContain("### Step 1:");
    expect(text).toContain("source-manifest.json");
    expect(text).toContain(`--stage ${slug} --result`);
  });

  it("puts tests before the implementation, which consumes the approved tests", () => {
    const implement = read("stages/construction/focus-implement.md");
    expect(listField(implement, "requires_stage")).toEqual(["focus-test"]);
    expect(implement).toMatch(/- artifact: focus-test-report\n\s+required: true/);
  });

  it("reviews the tests for missing requirements before a person checks them", () => {
    const test = read("stages/construction/focus-test.md");
    expect(scalar(test, "reviewer")).toBe("focus-reviewer-agent");
    expect(scalar(test, "review_artifact")).toBe("focus-test-report");
    expect(scalar(test, "review_class")).toBe("adversarial");
  });
});

describe("agents", () => {
  it.each(agents)("%s is pinned to Opus with an explicit effort", (file) => {
    const text = read(file);
    expect(scalar(text, "name")).toBe(path.basename(file, ".md"));
    expect(scalar(text, "plugin")).toBe("focus");
    expect(scalar(text, "model")).toBe("opus");
    expect(scalar(text, "effort")).toMatch(/^(low|medium|high|xhigh|max)$/);
    expect(scalar(text, "disallowedTools")).toBe("Task");
  });

  it("are the agents the stages name", () => {
    const named = stages.flatMap((file) => {
      const text = read(file);
      return [scalar(text, "lead_agent"), scalar(text, "reviewer")].filter(Boolean);
    });
    expect(new Set(named)).toEqual(new Set(agents.map((file) => path.basename(file, ".md"))));
  });
});

describe("the diagram sensor and guide", () => {
  it("names an entry file the engine can run", () => {
    const manifest = read("sensors/aidlc-focus-diagrams.md");
    expect(scalar(manifest, "id")).toBe("focus-diagrams");
    expect(scalar(manifest, "fire_on")).toBe("gate");
    expect(scalar(manifest, "default_severity")).toBe("blocking");
    const command = scalar(manifest, "command") ?? "";
    expect(command).toBe("bun .claude/tools/aidlc-sensor-focus-diagrams.ts");
    expect(existsSync(path.join(root, "tools", "aidlc-sensor-focus-diagrams.ts"))).toBe(true);
  });

  it("requires a diagram in exactly the artifacts the guide tells each stage to illustrate", () => {
    const guide = read("knowledge/aidlc-shared/focus-flow-guide.md");
    const section = guide.split("### ステージごとに必ず入れる図")[1]?.split("\n## ")[0] ?? "";
    const artifacts = [...section.matchAll(/^\| [a-z-]+\s+\| `([a-z-]+)\.md`/gm)].map(
      (match) => match[1],
    );
    expect(new Set(artifacts)).toEqual(DIAGRAM_REQUIRED);
  });

  it("is the guide every stage refers to", () => {
    const reference = ".claude/knowledge/aidlc-shared/focus-flow-guide.md";
    for (const file of [...contributions, ...stages]) expect(read(file)).toContain(reference);
    expect(existsSync(path.join(root, "knowledge/aidlc-shared/focus-flow-guide.md"))).toBe(true);
  });
});
