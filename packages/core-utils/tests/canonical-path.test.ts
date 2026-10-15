import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonicalPath, canonicalPathSync } from "../src/canonical-path.ts";

let base: string;
let real: string;
let alias: string;

beforeEach(async () => {
  // The raw temp directory is itself an alias on macOS (/var → /private/var) and on
  // Windows runners (8.3 short names such as RUNNER~1); the link adds one on Linux.
  base = await mkdtemp(path.join(tmpdir(), "canonical-path-"));
  real = path.join(base, "real");
  alias = path.join(base, "alias");
  await mkdir(real);
  await symlink(real, alias, "junction");
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("canonicalPath", () => {
  it("resolves an alias to the path the OS reports", async () => {
    const expected = await realpath(real);
    expect(await canonicalPath(alias)).toBe(expected);
    expect(canonicalPathSync(alias)).toBe(expected);
  });

  it("gives the sync and async forms the same answer for the raw temp directory", async () => {
    expect(canonicalPathSync(base)).toBe(await canonicalPath(base));
    expect(canonicalPathSync(path.join(alias, "."))).toBe(await canonicalPath(real));
  });

  it("reports a missing path instead of inventing one", async () => {
    const missing = path.join(base, "missing");
    await expect(canonicalPath(missing)).rejects.toMatchObject({ code: "ENOENT" });
    expect(() => canonicalPathSync(missing)).toThrow(expect.objectContaining({ code: "ENOENT" }));
  });
});
