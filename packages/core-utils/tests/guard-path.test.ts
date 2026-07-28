import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { guardPath } from "../src/guard-path.ts";
import { expectOk } from "./paths.ts";

let root: string;
let record: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "guard-path-"));
  record = path.join(root, "rec", "foo");
  await mkdir(path.join(record, "construction"), { recursive: true });
  await writeFile(path.join(record, "construction", "a.md"), "inside\n");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("guardPath — accepts", () => {
  it("a nested relative path", async () => {
    const { value } = expectOk(await guardPath(record, "construction/a.md"));
    expect(value).toBe(path.join(record, "construction", "a.md"));
  });

  it("a path that does not exist yet (the read reports not-found, not the guard)", async () => {
    const { value } = expectOk(await guardPath(record, "construction/missing.md"));
    expect(value).toBe(path.join(record, "construction", "missing.md"));
  });

  it("the record root itself", async () => {
    expect(expectOk(await guardPath(record, ".")).value).toBe(path.resolve(record));
  });

  it("a redundant traversal that lands back inside", async () => {
    const { value } = expectOk(await guardPath(record, "construction/../construction/a.md"));
    expect(value).toBe(path.join(record, "construction", "a.md"));
  });
});

describe("guardPath — rejects the three vectors", () => {
  it("vector 1: ../ traversal", async () => {
    expect(await guardPath(record, "../../secrets.md")).toEqual({
      error: true,
      reason: "outside-record",
    });
  });

  it("vector 1b: a bare ..", async () => {
    expect(await guardPath(record, "..")).toEqual({ error: true, reason: "outside-record" });
  });

  it("vector 2: an absolute path outside the record", async () => {
    const outside = path.join(root, "elsewhere.md");
    await writeFile(outside, "secret\n");
    expect(await guardPath(record, outside)).toEqual({
      error: true,
      reason: "outside-record",
    });
  });

  it("vector 3: a symlink escaping the record", async () => {
    const outside = path.join(root, "outside.md");
    await writeFile(outside, "secret\n");
    const link = path.join(record, "escape.md");
    try {
      await symlink(outside, link, "file");
    } catch {
      // Windows without Developer Mode cannot create symlinks; the lexical
      // vectors above still cover containment on such a host.
      return;
    }
    expect(await guardPath(record, "escape.md")).toEqual({
      error: true,
      reason: "outside-record",
    });
  });
});

describe("guardPath — prefix confusion", () => {
  it("rejects a sibling whose name extends the record name", async () => {
    // `/rec/foobar`.startsWith(`/rec/foo`) is true — a startsWith-based guard
    // would let this through. path.relative yields `../foobar`, which does not.
    const sibling = path.join(root, "rec", "foobar");
    await mkdir(sibling, { recursive: true });
    await writeFile(path.join(sibling, "leak.md"), "secret\n");

    expect(await guardPath(record, path.join(sibling, "leak.md"))).toEqual({
      error: true,
      reason: "outside-record",
    });
    expect(await guardPath(record, "../foobar/leak.md")).toEqual({
      error: true,
      reason: "outside-record",
    });
  });

  it("rejects a symlinked record whose real sibling extends its name", async () => {
    const sibling = path.join(root, "rec", "foobar");
    await mkdir(sibling, { recursive: true });
    await writeFile(path.join(sibling, "leak.md"), "secret\n");

    const linkedRecord = path.join(root, "linked-record");
    try {
      await symlink(record, linkedRecord, "dir");
    } catch {
      return; // see the symlink note above
    }
    expect(await guardPath(linkedRecord, "../foobar/leak.md")).toEqual({
      error: true,
      reason: "outside-record",
    });
  });
});
