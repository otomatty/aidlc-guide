import path from "node:path";
import { describe, expect, it } from "vitest";
import { fileRefTarget, isInside } from "../src/file-ref-target.ts";

/**
 * The trust boundary between the webview and the filesystem. The dashboard
 * already refuses these shapes, which is exactly why they are tested here:
 * this side has to hold with the dashboard's check assumed absent.
 */

const ROOT = path.resolve("/work/aidlc-guide");

describe("fileRefTarget — containment", () => {
  it.each([
    ["", "empty"],
    ["/etc/passwd", "absolute"],
    ["../../../etc/passwd", "escapes"],
    ["packages/../../secrets.json", "escapes"],
    ["packages//plan.ts", "empty segment"],
    ["./plan.ts", "a `.` segment"],
    ["packages\\btw\\plan.ts", "backslashes"],
    ["packages/*/plan.ts", "a glob would widen the literal path"],
  ])("refuses %j (%s)", (rel) => {
    expect(fileRefTarget(ROOT, rel)).toBeNull();
  });

  it("never returns a direct path outside the root", () => {
    // Belt and braces: whatever survives the filter above must still be inside.
    for (const rel of ["packages/btw/src/plan.ts", "a/b/c/d.ts", "docs/guides/live-share.md"]) {
      const target = fileRefTarget(ROOT, rel);
      expect(target?.direct).not.toBeNull();
      expect(isInside(ROOT, target?.direct ?? "")).toBe(true);
    }
  });
});

describe("fileRefTarget — what gets tried literally", () => {
  it("resolves a path with a directory against the workspace root", () => {
    expect(fileRefTarget(ROOT, "packages/btw/src/plan.ts")).toEqual({
      direct: path.join(ROOT, "packages", "btw", "src", "plan.ts"),
      glob: "**/packages/btw/src/plan.ts",
    });
  });

  it("sends a bare basename straight to the search, not to the repo root", () => {
    // `<root>/cli.ts` exists in no repo this targets; trying it would only add
    // a stat, and a repo that *did* have one would swallow every `cli.ts`
    // citation into the wrong file.
    expect(fileRefTarget(ROOT, "cli.ts")).toEqual({ direct: null, glob: "**/cli.ts" });
  });

  it("globs a partial path so it can match at any depth", () => {
    expect(fileRefTarget(ROOT, "services/api.ts")?.glob).toBe("**/services/api.ts");
  });
});

describe("isInside", () => {
  it("rejects the root itself and anything above it", () => {
    expect(isInside(ROOT, ROOT)).toBe(false);
    expect(isInside(ROOT, path.resolve(ROOT, ".."))).toBe(false);
    expect(isInside(ROOT, path.join(ROOT, "packages"))).toBe(true);
  });
});
