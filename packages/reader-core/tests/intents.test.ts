import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SPACE, resolveIntents, resolveRecordDir } from "../src/intents/resolve.ts";
import { expectOk, REPO_ROOT } from "./paths.ts";

let root: string;

/** Build `<root>/aidlc/spaces/<space>/intents/<name>` for each intent. */
async function seedSpace(space: string, intents: string[]): Promise<string> {
  const dir = path.join(root, "aidlc", "spaces", space, "intents");
  for (const intent of intents) await mkdir(path.join(dir, intent), { recursive: true });
  await mkdir(dir, { recursive: true });
  return dir;
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "intents-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("resolveIntents — the four cursor states", () => {
  it("healthy: the cursor points at an existing intent", async () => {
    const dir = await seedSpace(DEFAULT_SPACE, ["b-intent", "a-intent"]);
    await writeFile(path.join(dir, "active-intent"), "b-intent\n");

    expect(expectOk(await resolveIntents(root)).value).toEqual({
      space: DEFAULT_SPACE,
      active: "b-intent",
      all: ["a-intent", "b-intent"], // sorted (R-RC-5)
    });
  });

  it("absent: no cursor file at all — still enumerates (modes 1+2)", async () => {
    await seedSpace(DEFAULT_SPACE, ["a-intent", "b-intent"]);

    expect(expectOk(await resolveIntents(root)).value).toEqual({
      space: DEFAULT_SPACE,
      active: null,
      all: ["a-intent", "b-intent"],
    });
  });

  it("corrupt: an empty cursor file", async () => {
    const dir = await seedSpace(DEFAULT_SPACE, ["a-intent"]);
    await writeFile(path.join(dir, "active-intent"), "   \n\n");

    expect(expectOk(await resolveIntents(root)).value.active).toBeNull();
  });

  it("dangling: the cursor names an intent that is not there", async () => {
    const dir = await seedSpace(DEFAULT_SPACE, ["a-intent"]);
    await writeFile(path.join(dir, "active-intent"), "deleted-intent\n");

    expect(expectOk(await resolveIntents(root)).value).toEqual({
      space: DEFAULT_SPACE,
      active: null,
      all: ["a-intent"],
    });
  });
});

describe("resolveIntents — space cursor", () => {
  it("follows the active-space cursor", async () => {
    const dir = await seedSpace("team-b", ["x-intent"]);
    await writeFile(path.join(dir, "active-intent"), "x-intent\n");
    await writeFile(path.join(root, "aidlc", "active-space"), "team-b\n");

    expect(expectOk(await resolveIntents(root)).value).toEqual({
      space: "team-b",
      active: "x-intent",
      all: ["x-intent"],
    });
  });

  it("defaults to the default space when there is no cursor", async () => {
    await seedSpace(DEFAULT_SPACE, ["a-intent"]);
    expect(expectOk(await resolveIntents(root)).value.space).toBe(DEFAULT_SPACE);
  });

  it("returns an empty enumeration when the space has no intents directory", async () => {
    await writeFile(path.join(await mkdirp(root, "aidlc"), "active-space"), "ghost-space\n");

    expect(expectOk(await resolveIntents(root)).value).toEqual({
      space: "ghost-space",
      active: null,
      all: [],
    });
  });

  it("ignores dotfiles and non-directories when enumerating", async () => {
    const dir = await seedSpace(DEFAULT_SPACE, ["a-intent"]);
    await mkdir(path.join(dir, ".aidlc-hooks-health"), { recursive: true });
    await writeFile(path.join(dir, "intents.json"), "{}\n");

    expect(expectOk(await resolveIntents(root)).value.all).toEqual(["a-intent"]);
  });
});

describe("resolveRecordDir", () => {
  it("builds the record path from space + active intent", async () => {
    const dir = await seedSpace(DEFAULT_SPACE, ["a-intent"]);
    await writeFile(path.join(dir, "active-intent"), "a-intent\n");

    expect(expectOk(await resolveRecordDir(root)).value).toBe(path.join(dir, "a-intent"));
  });

  it("reports no-active-intent when the cursor cannot be honoured (mode 1)", async () => {
    await seedSpace(DEFAULT_SPACE, ["a-intent"]);
    expect(await resolveRecordDir(root)).toEqual({ error: true, reason: "no-active-intent" });
  });
});

describe("resolveIntents — live workspace", () => {
  it("resolves this repository's active intent", async () => {
    const { value } = expectOk(await resolveIntents(REPO_ROOT));
    expect(value.space).toBe(DEFAULT_SPACE);
    expect(value.all.length).toBeGreaterThan(0);
    expect(value.active).not.toBeNull();
    expect(value.all).toContain(value.active);
  });
});

async function mkdirp(base: string, child: string): Promise<string> {
  const dir = path.join(base, child);
  await mkdir(dir, { recursive: true });
  return dir;
}
