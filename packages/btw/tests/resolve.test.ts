import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BtwFailure } from "../src/errors.ts";
import { resolveLatestSession, sessionsDir } from "../src/resolve.ts";
import { projectSlug } from "../src/slug.ts";

// A stand-in cwd. Its literal text is what gets slugged, so this works
// unchanged on either host OS.
const FAKE_CWD = path.join(path.sep, "fake", "project");

let home: string;

async function seedSession(dir: string, name: string, mtimeSeconds: number): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, "");
  await utimes(file, mtimeSeconds, mtimeSeconds);
  return file;
}

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), "btw-test-"));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

describe("sessionsDir", () => {
  it("points at ~/.claude/projects/<slug>", () => {
    expect(sessionsDir(FAKE_CWD, home)).toBe(
      path.join(home, ".claude", "projects", projectSlug(FAKE_CWD)),
    );
  });
});

describe("resolveLatestSession", () => {
  it("picks the newest .jsonl by mtime", async () => {
    const dir = sessionsDir(FAKE_CWD, home);
    await mkdir(dir, { recursive: true });
    await seedSession(dir, "old-session.jsonl", 1_000_000);
    const newest = await seedSession(dir, "new-session.jsonl", 2_000_000);
    await seedSession(dir, "middle-session.jsonl", 1_500_000);

    const ref = await resolveLatestSession(FAKE_CWD, home);

    expect(ref.sessionId).toBe("new-session");
    expect(ref.jsonlPath).toBe(newest);
    expect(ref.mtime.getTime()).toBe(2_000_000 * 1000);
  });

  it("ignores files that are not .jsonl even when they are newer", async () => {
    const dir = sessionsDir(FAKE_CWD, home);
    await mkdir(dir, { recursive: true });
    await seedSession(dir, "real-session.jsonl", 1_000_000);
    await seedSession(dir, "notes.md", 9_000_000);
    await seedSession(dir, "decoy.jsonl.bak", 9_000_000);

    const ref = await resolveLatestSession(FAKE_CWD, home);

    expect(ref.sessionId).toBe("real-session");
  });

  it("fails with the computed path and a /branch hint when the directory is missing", async () => {
    const expected = sessionsDir(FAKE_CWD, home);

    await expect(resolveLatestSession(FAKE_CWD, home)).rejects.toThrow(BtwFailure);
    const error = (await resolveLatestSession(FAKE_CWD, home).catch((e) => e)) as BtwFailure;

    expect(error.code).toBeGreaterThan(0);
    expect(error.message).toContain(expected);
    expect(error.hint).toMatch(/\/branch/);
  });

  it("fails the same way when the directory exists but holds no .jsonl", async () => {
    const dir = sessionsDir(FAKE_CWD, home);
    await mkdir(dir, { recursive: true });
    await seedSession(dir, "README.md", 1_000_000);

    const error = (await resolveLatestSession(FAKE_CWD, home).catch((e) => e)) as BtwFailure;

    expect(error).toBeInstanceOf(BtwFailure);
    expect(error.message).toContain(dir);
    expect(error.hint).toMatch(/\/branch/);
  });

  it("does not include session content in the error message", async () => {
    const dir = sessionsDir(FAKE_CWD, home);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "secret.md"), "sk-super-secret-token");

    const error = (await resolveLatestSession(FAKE_CWD, home).catch((e) => e)) as BtwFailure;

    expect(error.message).not.toContain("sk-super-secret-token");
  });
});
