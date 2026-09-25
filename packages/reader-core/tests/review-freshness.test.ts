import * as fs from "node:fs/promises";
import { chmod, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createReviewFreshnessReader,
  currentReviewArtifactFingerprint,
  type ReviewArtifactStage,
} from "../src/tree/review-freshness.ts";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, open: vi.fn(actual.open) };
});

const STAGE: ReviewArtifactStage = {
  slug: "functional-design",
  phase: "construction",
  for_each: "unit-of-work",
  produces: ["traceability", "design"],
  optional_produces: ["optional"],
  review_artifact: "design",
};
// Fixed v2.8.2 manifest vectors, independently serialized from its wire contract.
const ARTIFACT = "sha256:b2ceba4d1c1a0386b4d142acc75b8c69c41528196e8de4373c1137549cdfc898";
const SOURCE = "b5b6888d58124a1c833e56fd8bb8947100d139cff78fa7fa1070ed68c7db21e6";
const UNIT_SOURCE = "sha256:034ea79cb458cb30b07539a413fd36afef9505f51a8cf303b79297472075ff98";
const MANIFEST =
  '{"stage":"code-generation","unit":"unit-alpha","version":1,"writes":[{"path":"app.ts"}]}';
let root: string;
let record: string;
let stage: ReviewArtifactStage;

async function write(relative: string, body: string | Buffer) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}
const recordPath = (relative: string) => path.relative(root, path.join(record, relative));
const artifactPath = (name: string) => recordPath(`construction/unit-alpha/${stage.slug}/${name}`);
async function graph() {
  await write(".claude/tools/data/harness.json", '{"name":"claude"}');
  await write(".claude/tools/data/stage-graph.json", JSON.stringify([stage]));
}
async function fields() {
  return {
    Stage: stage.slug,
    Unit: "unit-alpha",
    "Artifact Fingerprint": (await currentReviewArtifactFingerprint(
      record,
      stage,
      "unit-alpha",
    )) as string,
  };
}
async function sourceFixture() {
  stage = { ...STAGE, slug: "code-generation", workspace_requires: true };
  await graph();
  await write(artifactPath("design.md"), "# Design\n");
  await write(artifactPath("source-manifest.json"), MANIFEST);
  await write("app.ts", "export const answer = 42;\n");
  return {
    ...(await fields()),
    "Source Fingerprint": SOURCE,
    "Unit Source Fingerprint": UNIT_SOURCE,
  };
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "aidlc-freshness-"));
  record = path.join(root, "aidlc/spaces/default/intents/example");
  stage = { ...STAGE };
  await write(recordPath("aidlc-state.md"), "- **Change Control**: strict (set by you)\n");
  await write(artifactPath("design.md"), "# Design\n");
  await graph();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe("current review artifact identity", () => {
  it("matches the fixed sorted-path vector, including missing optional and traceability JSON", async () => {
    expect(await currentReviewArtifactFingerprint(record, stage, "unit-alpha")).toBe(ARTIFACT);
    const isCurrent = await createReviewFreshnessReader(record);
    expect(
      await isCurrent({ Stage: stage.slug, Unit: "unit-alpha", "Artifact Fingerprint": ARTIFACT }),
    ).toBe(true);
  });

  it.each(["design.md", "traceability.json", "optional.md"])(
    "invalidates a receipt when %s is changed or created",
    async (name) => {
      const receipt = await fields();
      await write(artifactPath(name), "changed\n");
      expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(false);
    },
  );

  it("invalidates deleted artifacts and ignores undeclared diaries or another unit", async () => {
    const receipt = await fields();
    await write(artifactPath("memory.md"), "unrelated diary");
    await write(recordPath(`construction/unit-beta/${stage.slug}/design.md`), "other unit");
    expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(true);
    await rm(path.join(root, artifactPath("design.md")));
    expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(false);
  });

  it("uses the test-results filename exception", async () => {
    stage = {
      ...stage,
      produces: ["build-test-results"],
      optional_produces: [],
      review_artifact: "build-test-results",
    };
    await write(artifactPath("test-results.md"), "passed");
    const first = await currentReviewArtifactFingerprint(record, stage, "unit-alpha");
    expect(first).toMatch(/^sha256:/);
    await write(artifactPath("build-test-results.md"), "not the declared path");
    expect(await currentReviewArtifactFingerprint(record, stage, "unit-alpha")).toBe(first);
    await write(artifactPath("test-results.md"), "failed");
    expect(await currentReviewArtifactFingerprint(record, stage, "unit-alpha")).not.toBe(first);
  });

  it.each([
    ["bare", "unit-alpha", "ui", "[unit-beta]"],
    ["double quoted", '"unit-alpha"', '"ui"', '["unit-beta"]'],
    ["single quoted", "'unit-alpha'", "'ui'", "['unit-beta']"],
    ["block dependencies", '"unit-alpha"', "'ui'", '\n      - "unit-beta"'],
    ["scalar dependency", "'unit-alpha'", '"ui"', "'unit-beta'"],
    ["inline comment", '"unit-alpha"', '"ui"', '["unit-beta"] # dependency'],
  ])(
    "resolves %s authored unit kinds ahead of a stale runtime cache",
    async (_, name, kind, deps) => {
      stage = { ...stage, produces_kinds: { traceability: ["service"], optional: ["service"] } };
      await graph();
      await write(
        recordPath("inception/units-generation/unit-of-work-dependency.md"),
        `\`\`\`yaml\nunits:\n  - name: 'unit-beta'\n    kind: "service"\n    depends_on: []\n  - name: ${name}\n    kind: ${kind}\n    depends_on: ${deps}\n\`\`\`\n`,
      );
      await write(
        recordPath("runtime-graph.json"),
        JSON.stringify({
          bolt_dag: { units: [{ name: "unit-alpha", kind: "service" }], batches: [["unit-alpha"]] },
        }),
      );
      const fingerprint = await currentReviewArtifactFingerprint(record, stage, "unit-alpha", "ui");
      expect(
        await (await createReviewFreshnessReader(record))({
          Stage: stage.slug,
          Unit: "unit-alpha",
          "Artifact Fingerprint": fingerprint as string,
        }),
      ).toBe(true);
      await write(artifactPath("design.md"), "changed\n");
      expect(
        await (await createReviewFreshnessReader(record))({
          Stage: stage.slug,
          Unit: "unit-alpha",
          "Artifact Fingerprint": fingerprint as string,
        }),
      ).toBe(false);
    },
  );

  it.each([
    ["unmatched name quote", '  - name: "unit-alpha\n    kind: ui'],
    ["mismatched kind quotes", "  - name: unit-alpha\n    kind: \"ui'"],
    ["unknown quoted kind", '  - name: unit-alpha\n    kind: "unknown"'],
    ["escaping quoted name", '  - name: "../unit-alpha"\n    kind: ui'],
    ["unmatched dependency quote", '  - name: unit-alpha\n    depends_on: ["unit-beta]'],
    ["unknown quoted dependency", '  - name: unit-alpha\n    depends_on: ["unit-beta"]'],
    ["quoted self dependency", '  - name: unit-alpha\n    depends_on: ["unit-alpha"]'],
    ["duplicate quoted name", '  - name: unit-alpha\n  - name: "unit-alpha"'],
    [
      "quoted dependency cycle",
      '  - name: "unit-alpha"\n    depends_on: ["unit-beta"]\n  - name: "unit-beta"\n    depends_on:\n      - \'unit-alpha\'',
    ],
  ])("rejects a DAG with %s without falling back to its runtime cache", async (_, units) => {
    stage = { ...stage, produces_kinds: { traceability: ["service"], optional: ["service"] } };
    await graph();
    await write(
      recordPath("inception/units-generation/unit-of-work-dependency.md"),
      `\`\`\`yaml\nunits:\n${units}\n\`\`\`\n`,
    );
    await write(
      recordPath("runtime-graph.json"),
      JSON.stringify({
        bolt_dag: { units: [{ name: "unit-alpha", kind: "ui" }], batches: [["unit-alpha"]] },
      }),
    );
    const fingerprint = await currentReviewArtifactFingerprint(record, stage, "unit-alpha", "ui");
    expect(
      await (await createReviewFreshnessReader(record))({
        Stage: stage.slug,
        Unit: "unit-alpha",
        "Artifact Fingerprint": fingerprint as string,
      }),
    ).toBe(false);
  });

  it("compares only fingerprint declarations across harnesses", async () => {
    await write(
      ".cursor/tools/data/stage-graph.json",
      JSON.stringify([{ ...stage, rules_in_context: [{ path: ".cursor/rules/x" }] }]),
    );
    expect(await (await createReviewFreshnessReader(record))(await fields())).toBe(true);
    await write(
      ".cursor/tools/data/stage-graph.json",
      JSON.stringify([{ ...stage, produces: ["design"] }]),
    );
    expect(await (await createReviewFreshnessReader(record))(await fields())).toBe(false);
  });

  it("rejects escaping names, linked artifacts and reads beyond the file budget", async () => {
    expect(await currentReviewArtifactFingerprint(record, stage, "../unit-alpha")).toBeNull();
    expect(
      await currentReviewArtifactFingerprint(
        record,
        { ...stage, produces: ["../design"] },
        "unit-alpha",
      ),
    ).toBeNull();
    const target = path.join(root, artifactPath("design.md"));
    await link(target, path.join(root, "hardlink.md"));
    expect(await currentReviewArtifactFingerprint(record, stage, "unit-alpha")).toBeNull();
    await rm(path.join(root, "hardlink.md"));
    await writeFile(target, Buffer.alloc(10 * 1024 * 1024 + 1));
    expect(await currentReviewArtifactFingerprint(record, stage, "unit-alpha")).toBeNull();
  });

  it("rejects a symlinked artifact directory without following it", async () => {
    await mkdir(path.join(root, "outside"));
    const unit = path.join(record, "construction/unit-alpha");
    await rm(unit, { recursive: true });
    await symlink(path.join(root, "outside"), unit, "junction");
    expect(await currentReviewArtifactFingerprint(record, stage, "unit-alpha")).toBeNull();
  });
});

describe("Guard Policy resolution, including legacy Change Control", () => {
  it.each(["relaxed", "off"])("accepts v2.10 %s but respects strict memory", async (value) => {
    await write(recordPath("aidlc-state.md"), `- **Guard Policy**: ${value}\n`);
    expect(await (await createReviewFreshnessReader(record))({})).toBe(true);
    await write("aidlc/spaces/default/memory/team.md", "## Guard Policy\n- **Mode**:\n  strict\n");
    expect(await (await createReviewFreshnessReader(record))({})).toBe(false);
  });
  it.each(["strict", "invalid"])("treats conflicting legacy %s as strict", async (legacy) => {
    await write(recordPath("aidlc-state.md"), `- **Guard Policy**: off\n- **Change Control**: ${legacy}\n`);
    expect(await (await createReviewFreshnessReader(record))({})).toBe(false);
  });
  it("prefers a modern memory declaration over a retired heading in the same file", async () => {
    await write(recordPath("aidlc-state.md"), "- **Guard Policy**: off\n- **Change Control**: off\n");
    await write("aidlc/spaces/default/memory/team.md", "## Guard Policy\nMode: off\n## Change Control\nMode: strict\n");
    expect(await (await createReviewFreshnessReader(record))({})).toBe(true);
  });
  it("recognizes a code-formatted strict memory value", async () => {
    await write(recordPath("aidlc-state.md"), "- **Guard Policy**: off\n");
    await write("aidlc/spaces/default/memory/team.md", "## Guard Policy\nMode: "+String.fromCharCode(96)+"strict"+String.fromCharCode(96)+"\n");
    expect(await (await createReviewFreshnessReader(record))({})).toBe(false);
  });

  it("retains relaxed receipts when graph and current artifacts are unavailable", async () => {
    await write(recordPath("aidlc-state.md"), "- **Change Control**: relaxed (set by you)\n");
    await rm(path.join(root, ".claude"), { recursive: true });
    expect(await (await createReviewFreshnessReader(record))({})).toBe(true);
  });

  it.each(["org", "team", "project"])(
    "honors strict memory in %s over relaxed state",
    async (layer) => {
      await write(recordPath("aidlc-state.md"), "- **Change Control**: relaxed (set by you)\n");
      await write(`aidlc/spaces/default/memory/${layer}.md`, "## Change Control\nMode: strict\n");
      expect(await (await createReviewFreshnessReader(record))({})).toBe(false);
    },
  );

  it("ignores fenced and commented memory declarations", async () => {
    await write(recordPath("aidlc-state.md"), "- **Change Control**: relaxed (set by you)\n");
    await write(
      "aidlc/spaces/default/memory/org.md",
      "```md\n## Change Control\nMode: strict\n```\n<!--\n## Change Control\nMode: strict\n-->\n",
    );
    expect(await (await createReviewFreshnessReader(record))({})).toBe(true);
  });

  it("does not let a fence inside a comment hide a real strict declaration", async () => {
    await write(recordPath("aidlc-state.md"), "- **Change Control**: relaxed\n");
    await write(
      "aidlc/spaces/default/memory/org.md",
      "<!--\n```\n-->\n## Change Control\nMode: strict\n",
    );
    expect(await (await createReviewFreshnessReader(record))({})).toBe(false);
  });

  it.each(["説明では `<!--` を使います。", "説明では `` `<!--` `` を使います。", "    <!--"])(
    "does not let a literal comment marker hide strict memory: %s",
    async (example) => {
      await write(recordPath("aidlc-state.md"), "- **Change Control**: relaxed\n");
      await write(
        "aidlc/spaces/default/memory/org.md",
        `${example}\n\n## Change Control\nMode: strict\n`,
      );
      expect(await (await createReviewFreshnessReader(record))({})).toBe(false);
    },
  );

  it.each([
    "## Change Control\nMode: unknown\n",
    "## Change Control\nMode: relaxed\nMode: strict\n",
    "## Change Control\nMode: relaxed\n## Change Control\nMode: strict\n",
  ])("treats invalid or ambiguous memory as unknown", async (memory) => {
    await write(recordPath("aidlc-state.md"), "- **Change Control**: relaxed\n");
    await write("aidlc/spaces/default/memory/org.md", memory);
    expect(await (await createReviewFreshnessReader(record))({})).toBe(false);
  });

  it("rejects contradictory state declarations and noncanonical records", async () => {
    await write(
      recordPath("aidlc-state.md"),
      "- **Change Control**: relaxed\n- **Change Control**: strict\n",
    );
    expect(await (await createReviewFreshnessReader(record))({})).toBe(false);
    expect(await (await createReviewFreshnessReader(root))({})).toBe(false);
  });

  it.each([
    "**Change Control**: relaxed\n",
    " - **Change Control**: relaxed\n",
    "```md\n- **Change Control**: strict\n```\n- **Change Control**: relaxed\n",
  ])("uses the engine's raw exact-bullet state grammar: %s", async (state) => {
    await write(recordPath("aidlc-state.md"), state);
    expect(await (await createReviewFreshnessReader(record))({})).toBe(false);
  });
});

describe("current source identity", () => {
  it("excludes nested v2.9 engine state but keeps similarly named application source", async () => {
    const receipt = await sourceFixture();
    await write(
      "packages/example/aidlc/spaces/default/intents/task-12345678/.aidlc-engine/reviews/result.json",
      "internal",
    );
    await write(
      "packages/example/aidlc/spaces/default/intents/.aidlc-engine/hooks-health/last",
      "internal",
    );
    await write(
      "packages/example/aidlc/spaces/default/intents/task-12345678/.aidlc-sensors/result.md",
      "legacy",
    );
    expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(true);
    await write("src/.aidlc-engine/application.ts", "real source");
    expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(false);
  });
  it("matches fixed workspace and manifest-bound unit vectors", async () => {
    const receipt = await sourceFixture();
    expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(true);
  });

  it.each(["edit", "add", "delete", "manifest"])(
    "rejects a receipt after source %s",
    async (change) => {
      const receipt = await sourceFixture();
      if (change === "edit") await write("app.ts", "export const answer = 43;\n");
      if (change === "add") await write("added.ts", "new file\n");
      if (change === "delete") await rm(path.join(root, "app.ts"));
      if (change === "manifest") await write(artifactPath("source-manifest.json"), `${MANIFEST}\n`);
      expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(false);
    },
  );

  it("excludes dependencies, generated directories and stamped harness trees", async () => {
    const receipt = await sourceFixture();
    await write("node_modules/dependency/index.js", "dependency");
    await write("src/node_modules/dependency/index.js", "nested dependency");
    await write("dist/output.bin", Buffer.alloc(100));
    await write(".claude/tools/other.ts", "engine update");
    expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(true);
  });

  it.each([".aidlc-source-paths.json", ".aidlc/worktree-meta.json", "nested/.git/HEAD"])(
    "fails closed on unsupported source context %s",
    async (name) => {
      const receipt = await sourceFixture();
      await write(name, "{}");
      expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(false);
    },
  );

  it.each([
    [
      "an older stored directory with the same slug",
      { dirName: "example-87654321", slug: "example", uuid: "12345678" },
      true,
    ],
    ["a legacy row with another UUID", { slug: "example", uuid: "87654321" }, true],
    ["a legacy row without a UUID", { slug: "example" }, true],
    ["a legacy row with another slug", { slug: "other", uuid: "12345678" }, true],
    [
      "the exact stored directory",
      { dirName: "example-12345678", slug: "other", uuid: "87654321" },
      false,
    ],
    [
      "the matching legacy UUID suffix",
      { slug: "example", uuid: "00000000-0000-0000-0000-000012345678" },
      false,
    ],
    [
      "an empty stored name with a matching legacy UUID",
      { dirName: "", slug: "example", uuid: "12345678" },
      false,
    ],
  ])("resolves repository mappings for %s", async (_, entry, expected) => {
    record = path.join(root, "aidlc/spaces/default/intents/example-12345678");
    await write(recordPath("aidlc-state.md"), "- **Change Control**: strict\n");
    const receipt = await sourceFixture();
    await write(
      recordPath("../intents.json"),
      JSON.stringify([
        { ...entry, repos: ["app"] },
        { dirName: "example-12345678", slug: "example", repos: [] },
      ]),
    );
    expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(expected);
  });

  it("fails closed for a mapped repository and an invalid manifest path", async () => {
    const receipt = await sourceFixture();
    await write(
      recordPath("../intents.json"),
      JSON.stringify([{ dirName: "example", repos: ["app"] }]),
    );
    expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(false);
    await rm(path.join(record, "../intents.json"));
    await write(artifactPath("source-manifest.json"), MANIFEST.replace("app.ts", "../app.ts"));
    expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(false);
  });

  it.runIf(process.platform !== "win32")("binds the executable bit", async () => {
    const receipt = await sourceFixture();
    await chmod(path.join(root, "app.ts"), 0o755);
    expect(await (await createReviewFreshnessReader(record))(receipt)).toBe(false);
  });

  it("detects a top-level addition after the source read and shares one source read within a build", async () => {
    const receipt = await sourceFixture();
    // Windows runners may expose TEMP through an 8.3 alias. The reader opens
    // the canonical path, so count that identity rather than its spelling.
    const appPath = await fs.realpath(path.join(root, "app.ts"));
    const { open: original } =
      await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    let appReads = 0;
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      if (String(args[0]) === appPath) appReads++;
      return original(...args);
    });
    const current = await createReviewFreshnessReader(record);
    expect(await current(receipt)).toBe(true);
    expect(await current(receipt)).toBe(true);
    expect(appReads).toBe(1);
    await write("late.ts", "after snapshot");
    expect(await current(receipt)).toBe(false);
    expect(await readFile(path.join(root, artifactPath("source-manifest.json")), "utf8")).toBe(
      MANIFEST,
    );
  });
});
