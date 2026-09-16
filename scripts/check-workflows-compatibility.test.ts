import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkMetadata,
  type ReadText,
  readFrom,
  workflowsTarget,
} from "./check-workflows-compatibility.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = readFrom(root);
const target = workflowsTarget(read);
const next = target.version.replace(/\.(\d+)$/, (_, patch: string) => `.${Number(patch) + 1}`);
const changed =
  (file: string, update: (text: string) => string): ReadText =>
  (relative) =>
    relative === file ? update(read(relative)) : read(relative);

describe("offline workflows release gate", () => {
  it("accepts the checked-in metadata", () => expect(checkMetadata(read)).toEqual([]));
  it("rejects a manifest-only version bump without updating the maps and installer", () => {
    const errors = checkMetadata(
      changed("docs/official-docs.manifest.json", (text) =>
        JSON.stringify({ ...JSON.parse(text), sourceVersion: next }),
      ),
    );
    for (const component of [
      "agent-map",
      "bridge-map",
      "installer target",
      "claude version",
      "cursor version",
      "docs index",
      "README",
    ])
      expect(
        errors.some((e) => e.startsWith(component)),
        component,
      ).toBe(true);
  });
  it.each(["agent-map", "bridge-map", "artifact-map"])("rejects a %s-only bump", (map) => {
    expect(
      checkMetadata(
        changed(`packages/docs-bridge/data/${map}.json`, (text) =>
          JSON.stringify({
            ...JSON.parse(text),
            sourceVersion: `aidlc ${next} (State Version ${target.stateVersion})`,
          }),
        ),
      ),
    ).toEqual([expect.stringContaining(`${map}: expected`)]);
  });
  it("rejects an installer-only bump", () => {
    expect(
      checkMetadata(
        changed("packages/shared-types/src/workflows-management.ts", (text) =>
          text.replace(target.version, next),
        ),
      ),
    ).toEqual([expect.stringContaining("installer target")]);
  });
  it.each([
    "AGENTS.md",
    "README.md",
    ".cursor/tools/aidlc-version.ts",
    ".claude/tools/aidlc-lib.ts",
    "packages/shared-types/src/index.ts",
    "docs/official-docs.index.json",
  ])("fails on missing %s instead of skipping", (file) => {
    const missing: ReadText = (rel) => {
      if (rel === file) throw new Error("missing");
      return read(rel);
    };
    expect(checkMetadata(missing).length).toBeGreaterThan(0);
  });
  it("detects missing prose declarations and a different shell state version", () => {
    expect(checkMetadata(changed("AGENTS.md", () => "No version declared"))).toEqual([
      expect.stringContaining("AGENTS declaration"),
    ]);
    expect(
      checkMetadata(
        changed(".cursor/tools/aidlc-lib.ts", (text) =>
          text.replace(/CURRENT_STATE_VERSION = "\d+"/, 'CURRENT_STATE_VERSION = "999"'),
        ),
      ),
    ).toEqual([expect.stringContaining("cursor state")]);
  });
});
