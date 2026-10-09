import { WORKFLOWS_TARGET_VERSION } from "../packages/shared-types/src/index.ts";
import { describe, expect, it } from "vitest";
import { parseReleaseMetadata } from "../packages/vscode-extension/src/update-release.ts";
import { releaseMetadata } from "./release-metadata.ts";

describe("releaseMetadata", () => {
  it("records the supported aidlc-workflows release in the shape the extension reads", () => {
    const written = JSON.parse(JSON.stringify(releaseMetadata("0.40.0")));
    expect(written).toEqual({
      schemaVersion: 1,
      version: "0.40.0",
      workflowsTarget: WORKFLOWS_TARGET_VERSION,
    });
    expect(parseReleaseMetadata(written)).toEqual({
      version: "0.40.0",
      workflowsTarget: WORKFLOWS_TARGET_VERSION,
    });
  });

  it("accepts a pre-release version and refuses anything else", () => {
    expect(releaseMetadata("0.40.0-rc.1").version).toBe("0.40.0-rc.1");
    expect(() => releaseMetadata("v0.40.0")).toThrow("not an extension version");
    expect(() => releaseMetadata("")).toThrow("not an extension version");
  });
});
