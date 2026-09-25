import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SPACE,
  electActive,
  resolveIntents,
  resolveRecordDir,
} from "../src/intents/resolve.ts";
import { indexIntentRecords, sortIntentNames } from "../src/intents/order.ts";
import { expectOk, liveActiveIntent, REPO_ROOT } from "./paths.ts";

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

describe("electActive — aidlc-lib activeIntent precedence", () => {
  it("prefers a cursor that names a listed record", () => {
    expect(electActive(["a", "b"], "b")).toBe("b");
  });

  it("falls back to lone-intent when the cursor is absent", () => {
    expect(electActive(["only"], null)).toBe("only");
  });

  it("falls back to lone-intent when the cursor is dangling or corrupt", () => {
    expect(electActive(["only"], "gone")).toBe("only");
  });

  it("returns null when multiple records and no honourable cursor", () => {
    expect(electActive(["a", "b"], null)).toBeNull();
    expect(electActive(["a", "b"], "gone")).toBeNull();
  });
});

describe("intent creation order", () => {
  it("uses UUIDv7 milliseconds for intents created on the same day", () => {
    const names = ["260101-a", "260101-z"];
    const records = [
      { dirName: "260101-a", uuid: "01900000-0000-7000-8000-000000000001" },
      { dirName: "260101-z", uuid: "01900000-0001-7000-8000-000000000002" },
    ];
    expect(sortIntentNames(names, indexIntentRecords(records, names))).toEqual([
      "260101-z",
      "260101-a",
    ]);
  });

  it("falls back to valid directory dates and places unknown dates last", () => {
    const names = ["legacy-b", "260101-a", "251231-old", "legacy-a", "261332-bad"];
    expect(sortIntentNames(names, indexIntentRecords([], names))).toEqual([
      "260101-a",
      "251231-old",
      "261332-bad",
      "legacy-a",
      "legacy-b",
    ]);
  });

  it("resolves legacy registry names by UUID suffix", () => {
    const names = ["old-work-00000001", "old-work-00000002"];
    const records = [
      { slug: "old-work", uuid: "01900000-0000-7000-8000-000000000001" },
      { slug: "old-work", uuid: "01900000-0001-7000-8000-000000000002" },
    ];
    expect(sortIntentNames(names, indexIntentRecords(records, names))).toEqual([
      "old-work-00000002",
      "old-work-00000001",
    ]);
  });
});

describe("resolveIntents — the four cursor states", () => {
  it("healthy: the cursor points at an existing intent", async () => {
    const dir = await seedSpace(DEFAULT_SPACE, ["b-intent", "a-intent"]);
    await writeFile(path.join(dir, "active-intent"), "b-intent\n");

    expect(expectOk(await resolveIntents(root)).value).toEqual({
      space: DEFAULT_SPACE,
      active: "b-intent",
      all: ["a-intent", "b-intent"], // deterministic for unknown dates (R-RC-5)
      selected: null,
    });
  });

  it("absent with multiple records — enumerates, elects nothing", async () => {
    await seedSpace(DEFAULT_SPACE, ["a-intent", "b-intent"]);

    expect(expectOk(await resolveIntents(root)).value).toEqual({
      space: DEFAULT_SPACE,
      active: null,
      all: ["a-intent", "b-intent"],
      selected: null,
    });
  });

  it("honours AIDLC_ACTIVE_INTENT when the cursor file is absent", async () => {
    await seedSpace(DEFAULT_SPACE, ["a-intent", "b-intent"]);
    const previous = process.env.AIDLC_ACTIVE_INTENT;
    process.env.AIDLC_ACTIVE_INTENT = "b-intent";
    try {
      expect(expectOk(await resolveIntents(root)).value.active).toBe("b-intent");
    } finally {
      if (previous === undefined) delete process.env.AIDLC_ACTIVE_INTENT;
      else process.env.AIDLC_ACTIVE_INTENT = previous;
    }
  });

  it("absent with one record — lone-intent elects it (engine parity)", async () => {
    await seedSpace(DEFAULT_SPACE, ["only-intent"]);

    expect(expectOk(await resolveIntents(root)).value).toEqual({
      space: DEFAULT_SPACE,
      active: "only-intent",
      all: ["only-intent"],
      selected: null,
    });
  });

  it("corrupt: empty cursor falls through to lone-intent when one record", async () => {
    const dir = await seedSpace(DEFAULT_SPACE, ["a-intent"]);
    await writeFile(path.join(dir, "active-intent"), "   \n\n");

    expect(expectOk(await resolveIntents(root)).value.active).toBe("a-intent");
  });

  it("dangling: falls through to lone-intent when one record remains", async () => {
    const dir = await seedSpace(DEFAULT_SPACE, ["a-intent"]);
    await writeFile(path.join(dir, "active-intent"), "deleted-intent\n");

    expect(expectOk(await resolveIntents(root)).value).toEqual({
      space: DEFAULT_SPACE,
      active: "a-intent",
      all: ["a-intent"],
      selected: null,
    });
  });
});

describe("resolveIntents — creation order", () => {
  it("lists the newest intent first without changing the active cursor", async () => {
    const dir = await seedSpace(DEFAULT_SPACE, ["260101-a", "260101-z", "251231-old"]);
    const timestamp = Date.UTC(2026, 0, 1, 1).toString(16).padStart(12, "0");
    const newerTimestamp = (Date.UTC(2026, 0, 1, 1) + 1).toString(16).padStart(12, "0");
    await writeFile(path.join(dir, "active-intent"), "251231-old\n");
    await writeFile(
      path.join(dir, "intents.json"),
      JSON.stringify([
        { dirName: "260101-a", uuid: `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7000-8000-000000000001` },
        { dirName: "260101-z", uuid: `${newerTimestamp.slice(0, 8)}-${newerTimestamp.slice(8)}-7000-8000-000000000002` },
      ]),
    );
    const result = expectOk(await resolveIntents(root)).value;
    expect(result.all).toEqual(["260101-z", "260101-a", "251231-old"]);
    expect(result.active).toBe("251231-old");
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
      selected: null,
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
      selected: null,
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

  it("uses lone-intent when the cursor is absent but one record exists", async () => {
    const dir = await seedSpace(DEFAULT_SPACE, ["a-intent"]);
    expect(expectOk(await resolveRecordDir(root)).value).toBe(path.join(dir, "a-intent"));
  });

  it("reports no-active-intent when multiple records and no honourable cursor", async () => {
    await seedSpace(DEFAULT_SPACE, ["a-intent", "b-intent"]);
    expect(await resolveRecordDir(root)).toEqual({ error: true, reason: "no-active-intent" });
  });
});

describe("resolveIntents — live workspace", () => {
  it("resolves this repository's active intent", async () => {
    const previous = process.env.AIDLC_ACTIVE_INTENT;
    if (previous === undefined || previous.trim() === "") {
      process.env.AIDLC_ACTIVE_INTENT = liveActiveIntent();
    }
    try {
      const { value } = expectOk(await resolveIntents(REPO_ROOT));
      expect(value.space).toBe(DEFAULT_SPACE);
      expect(value.all.length).toBeGreaterThan(0);
      expect(value.active).not.toBeNull();
      expect(value.all).toContain(value.active);
    } finally {
      if (previous === undefined) delete process.env.AIDLC_ACTIVE_INTENT;
      else process.env.AIDLC_ACTIVE_INTENT = previous;
    }
  });
});

async function mkdirp(base: string, child: string): Promise<string> {
  const dir = path.join(base, child);
  await mkdir(dir, { recursive: true });
  return dir;
}
