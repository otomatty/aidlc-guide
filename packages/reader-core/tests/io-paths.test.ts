import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listMarkdownRel, pickIoPath } from "../src/tree/io-paths.ts";

describe("listMarkdownRel", () => {
  it("recursively lists only markdown as sorted POSIX-relative paths", async () => {
    const recordDir = await mkdtemp(path.join(tmpdir(), "io-paths-"));
    const construction = path.join(recordDir, "construction", "u", "s");
    const inception = path.join(recordDir, "inception", "x");
    await mkdir(construction, { recursive: true });
    await mkdir(inception, { recursive: true });
    await writeFile(path.join(construction, "a.md"), "# A\n");
    await writeFile(path.join(inception, "b.md"), "# B\n");
    await writeFile(path.join(inception, "ignored.txt"), "ignored\n");

    await expect(listMarkdownRel(recordDir)).resolves.toEqual({
      ok: true,
      value: ["construction/u/s/a.md", "inception/x/b.md"],
    });
  });
});

describe("pickIoPath", () => {
  const file = "business-rules.md";
  const unitHits = [
    "construction/ops-guides/functional-design/business-rules.md",
    "construction/reader-core/functional-design/business-rules.md",
  ];

  it("prefers the active unit and ignores other units", () => {
    expect(pickIoPath(unitHits, file, { unit: "ops-guides", stage: "nfr-requirements" })).toBe(
      "construction/ops-guides/functional-design/business-rules.md",
    );
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
    expect(pickIoPath(hits, "code-summary.md", { unit: "u", stage: "code-generation" })).toBe(
      "construction/u/code-generation/code-summary.md",
    );
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
      pickIoPath(["construction/build-and-test/build-instructions.md"], "build-instructions.md", {
        unit: null,
        stage: "build-and-test",
      }),
    ).toBe("construction/build-and-test/build-instructions.md");
  });

  it("returns null when shared hits are ambiguous", () => {
    expect(
      pickIoPath(["ideation/a/x.md", "inception/b/x.md"], "x.md", {
        unit: null,
        stage: "anything",
      }),
    ).toBeNull();
  });
});
