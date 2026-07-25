import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readArtifact } from "../src/tools/read-artifact.ts";
import { expectNormalReply, ok, ROOT } from "./support.ts";

/**
 * S-MS-2 / BR-MS-2 — the server-side pre-gate.
 *
 * These assert more than "the path is rejected": they assert `reader.readArtifact`
 * is **never reached**. reader-core's internal guard is the last line of
 * defence, so a test that only checked the verdict would still pass if the
 * pre-gate were deleted.
 *
 * `<tmp>/rec/foo` is the record; `<tmp>/rec/foobar` is the prefix-confusing
 * sibling that a `startsWith` guard would wrongly admit.
 */

let root: string;
let record: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "mcp-read-gate-"));
  record = path.join(root, "rec", "foo");
  await mkdir(path.join(record, "inception"), { recursive: true });
  await writeFile(path.join(record, "inception", "a.md"), "inside\n");
  await mkdir(path.join(root, "rec", "foobar"), { recursive: true });
  await writeFile(path.join(root, "rec", "foobar", "leak.md"), "secret\n");
  await writeFile(path.join(root, "outside.md"), "secret\n");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const VECTORS: { name: string; relPath: () => string }[] = [
  { name: "vector 1: ../ traversal", relPath: () => "../../outside.md" },
  {
    name: "vector 2: an absolute path outside the record",
    relPath: () => path.join(root, "outside.md"),
  },
  {
    name: "vector 3: prefix confusion — /rec/foobar next to /rec/foo",
    relPath: () => path.join(root, "rec", "foobar", "leak.md"),
  },
];

describe("read_artifact server pre-gate", () => {
  it.each(VECTORS)("$name is rejected before the reader is called", async ({ relPath }) => {
    const reader = vi.fn();
    const reply = expectNormalReply(
      await readArtifact(
        { readArtifact: reader } as never,
        ROOT,
        async () => ok(record),
        relPath(),
      ),
    );
    expect(reader).not.toHaveBeenCalled();
    expect(reply.degraded).toEqual({ kind: "error", detail: "outside-record" });
    expect(reply.text).toContain("記録ディレクトリの外は読めません");
  });

  it("lets a path inside the record through to the reader", async () => {
    const reader = vi.fn(async () => ok("inside\n"));
    const reply = expectNormalReply(
      await readArtifact(
        { readArtifact: reader } as never,
        ROOT,
        async () => ok(record),
        "inception/a.md",
      ),
    );
    expect(reader).toHaveBeenCalledWith("inception/a.md");
    expect(reply.text).toBe("inside\n");
  });
});
