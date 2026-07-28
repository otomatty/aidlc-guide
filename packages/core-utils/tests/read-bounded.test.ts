import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_READ_BYTES, readBounded, readTail, VERDICT_TAIL_BYTES } from "../src/read-bounded.ts";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "read-bounded-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("readBounded", () => {
  it("reads a file within the bound", async () => {
    const file = path.join(dir, "a.md");
    await writeFile(file, "hello\n");
    expect(await readBounded(file)).toEqual({ ok: true, value: "hello\n" });
  });

  it("strips a BOM left by a mid-write (R-RC-3)", async () => {
    const file = path.join(dir, "bom.md");
    await writeFile(file, "﻿## Project Information\n");
    expect(await readBounded(file)).toEqual({ ok: true, value: "## Project Information\n" });
  });

  it("rejects an oversized file before reading it (S-RC-4)", async () => {
    const file = path.join(dir, "big.md");
    await writeFile(file, "0123456789abcdef");
    expect(await readBounded(file, 8)).toEqual({ error: true, reason: "file-too-large" });
  });

  it("reports a missing file", async () => {
    expect(await readBounded(path.join(dir, "nope.md"))).toEqual({
      error: true,
      reason: "not-found",
    });
  });

  it("reports a directory as not-a-file", async () => {
    expect(await readBounded(dir)).toEqual({ error: true, reason: "not-a-file" });
  });

  it("defaults to a 10MB bound", () => {
    expect(MAX_READ_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("readTail", () => {
  it("returns only the last bytes of a file", async () => {
    const file = path.join(dir, "long.md");
    await writeFile(file, `${"x".repeat(VERDICT_TAIL_BYTES * 2)}**Verdict:** READY\n`);
    const tail = await readTail(file);
    expect(tail).not.toBeNull();
    expect(tail?.length).toBe(VERDICT_TAIL_BYTES);
    expect(tail).toContain("**Verdict:** READY");
  });

  it("returns the whole file when it is shorter than the window", async () => {
    const file = path.join(dir, "short.md");
    await writeFile(file, "tiny\n");
    expect(await readTail(file)).toBe("tiny\n");
  });

  it("returns an empty string for an empty file", async () => {
    const file = path.join(dir, "empty.md");
    await writeFile(file, "");
    expect(await readTail(file)).toBe("");
  });

  it("returns null instead of throwing when the file is gone", async () => {
    expect(await readTail(path.join(dir, "nope.md"))).toBeNull();
  });

  it("returns null for a directory", async () => {
    expect(await readTail(dir)).toBeNull();
  });
});
