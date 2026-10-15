import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canonicalPath, canonicalPathSync } from "../src/canonical-path.ts";

// Some virtual volumes (RAM disks and similar) make the OS resolver fail where the
// JS walk still works. Simulate that failure for the resolver under test only.
const failure = () => Object.assign(new Error("EISDIR: illegal operation"), { code: "EISDIR" });
const native = vi.hoisted(() => ({ calls: 0 }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const realpathSync = Object.assign((target: string) => actual.realpathSync(target), {
    native: () => {
      native.calls += 1;
      throw failure();
    },
  });
  return { ...actual, realpathSync };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    realpath: async (target: string) => {
      if (path.basename(target) !== "alias") return actual.realpath(target);
      native.calls += 1;
      throw failure();
    },
  };
});

let base: string;
let alias: string;
let expected: string;

beforeEach(async () => {
  native.calls = 0;
  base = await mkdtemp(path.join(tmpdir(), "canonical-path-fallback-"));
  await mkdir(path.join(base, "real"));
  alias = path.join(base, "alias");
  await symlink(path.join(base, "real"), alias, "junction");
  const { realpathSync } = await vi.importActual<typeof import("node:fs")>("node:fs");
  expected = realpathSync(alias);
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

it("falls back to the JS walk when the OS resolver fails", async () => {
  expect(canonicalPathSync(alias)).toBe(expected);
  expect(await canonicalPath(alias)).toBe(expected);
  expect(native.calls).toBe(2);
});
