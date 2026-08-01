import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("diff-report stub (US-08 Should)", () => {
  it("ships the CLI entry script", () => {
    expect(existsSync(join(import.meta.dirname, "../../../scripts/official-docs-diff.ts"))).toBe(
      true,
    );
  });
});
