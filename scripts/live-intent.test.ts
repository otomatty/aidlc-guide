import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LIVE_INTENT_ENV,
  pinLiveIntent,
  resolveActiveSpace,
  resolveLiveIntent,
} from "./live-intent.ts";

let root: string;
let previous: string | undefined;

/** `<root>/aidlc/spaces/<space>/intents/<name>/` for each entry, state file optional. */
async function seed(
  records: { name: string; state?: boolean }[],
  space = "default",
): Promise<string> {
  const dir = path.join(root, "aidlc", "spaces", space, "intents");
  for (const record of records) {
    await mkdir(path.join(dir, record.name), { recursive: true });
    if (record.state !== false) {
      await writeFile(path.join(dir, record.name, "aidlc-state.md"), "# state\n");
    }
  }
  return dir;
}

/** Point `aidlc/active-space` at a space, the way a user who switched would. */
async function selectSpace(space: string): Promise<void> {
  await mkdir(path.join(root, "aidlc"), { recursive: true });
  await writeFile(path.join(root, "aidlc", "active-space"), `${space}\n`);
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "live-intent-"));
  previous = process.env[LIVE_INTENT_ENV];
  delete process.env[LIVE_INTENT_ENV];
});

afterEach(async () => {
  if (previous === undefined) delete process.env[LIVE_INTENT_ENV];
  else process.env[LIVE_INTENT_ENV] = previous;
  await rm(root, { recursive: true, force: true });
});

describe("resolveLiveIntent", () => {
  it("elects the first record that carries a state file", async () => {
    await seed([{ name: "b-second" }, { name: "a-first" }]);
    expect(await resolveLiveIntent(root)).toBe("a-first");
  });

  it("skips a record with no state file — it cannot serve the suites this exists for", async () => {
    await seed([{ name: "a-empty", state: false }, { name: "b-usable" }]);
    expect(await resolveLiveIntent(root)).toBe("b-usable");
  });

  it("returns null when no record carries a state file", async () => {
    await seed([{ name: "a-empty", state: false }]);
    expect(await resolveLiveIntent(root)).toBeNull();
  });

  it("returns null when the workspace has no intents directory", async () => {
    expect(await resolveLiveIntent(root)).toBeNull();
  });
});

describe("pinLiveIntent", () => {
  it("sets the variable when nothing else elects a record", async () => {
    await seed([{ name: "a-first" }, { name: "b-second" }]);

    expect(await pinLiveIntent(root)).toBe("a-first");
    expect(process.env[LIVE_INTENT_ENV]).toBe("a-first");
  });

  it("keeps an explicit pin — someone is testing a specific record", async () => {
    await seed([{ name: "a-first" }, { name: "b-second" }]);
    process.env[LIVE_INTENT_ENV] = "b-second";

    expect(await pinLiveIntent(root)).toBe("b-second");
    expect(process.env[LIVE_INTENT_ENV]).toBe("b-second");
  });

  /**
   * The cursor decides, but the variable is the only channel every consumer
   * shares — api-core's timings suite pins a dashboard view from it and never
   * reads the cursor. Leaving it unset is what let that suite exercise a
   * different record than reader-core in the same run.
   */
  it("mirrors a cursor into the variable, so consumers that read only it agree", async () => {
    const dir = await seed([{ name: "a-first" }, { name: "b-second" }]);
    await writeFile(path.join(dir, "active-intent"), "b-second\n");

    expect(await pinLiveIntent(root)).toBe("b-second");
    expect(process.env[LIVE_INTENT_ENV]).toBe("b-second");
  });

  /**
   * `resolveIntents` calls an empty cursor no cursor at all and falls back to
   * the variable. Suppressing the pin on mere existence would leave the live
   * suites degraded because of a gitignored, per-user file — the exact failure
   * this module was written to remove.
   */
  it.each([
    ["empty", ""],
    ["whitespace-only", "   \n"],
    ["a bare newline", "\n"],
  ])(
    "still pins when the cursor file is %s — downstream reads that as no cursor",
    async (_label, contents) => {
      const dir = await seed([{ name: "a-first" }, { name: "b-second" }]);
      await writeFile(path.join(dir, "active-intent"), contents);

      expect(await pinLiveIntent(root)).toBe("a-first");
      expect(process.env[LIVE_INTENT_ENV]).toBe("a-first");
    },
  );

  it("stands down for a dangling cursor — it short-circuits the variable downstream", async () => {
    const dir = await seed([{ name: "a-first" }, { name: "b-second" }]);
    await writeFile(path.join(dir, "active-intent"), "no-such-record\n");

    expect(await pinLiveIntent(root)).toBeNull();
    expect(process.env[LIVE_INTENT_ENV]).toBeUndefined();
  });

  it("overwrites a variable that disagrees with the cursor, rather than leaving both", async () => {
    const dir = await seed([{ name: "a-first" }, { name: "b-second" }]);
    await writeFile(path.join(dir, "active-intent"), "b-second\n");
    process.env[LIVE_INTENT_ENV] = "a-first";

    // resolveIntents reads `fileCursor ?? envCursor`, so the run uses
    // b-second whatever the variable says. Leaving a-first standing would
    // point the view-pin consumer at a record nothing else is reading.
    expect(await pinLiveIntent(root)).toBe("b-second");
    expect(process.env[LIVE_INTENT_ENV]).toBe("b-second");
  });

  it("leaves the variable unset when no record can be elected", async () => {
    expect(await pinLiveIntent(root)).toBeNull();
    expect(process.env[LIVE_INTENT_ENV]).toBeUndefined();
  });
});

/**
 * The space the workspace points at is the space the application resolves, so
 * it has to be the space the pin is elected from. Picking out of `default`
 * while the workspace is on another space pins a slug that is not listed
 * there, and the live suites degrade exactly as if nothing had been pinned.
 */
describe("active space", () => {
  it("defaults to `default` when no cursor names a space", async () => {
    expect(await resolveActiveSpace(root)).toBe("default");
  });

  it("reads the space cursor, ignoring trailing newline and whitespace", async () => {
    await selectSpace("  team-x  ");
    expect(await resolveActiveSpace(root)).toBe("team-x");
  });

  it("falls back to `default` when the space cursor is present but empty", async () => {
    await selectSpace("   ");
    expect(await resolveActiveSpace(root)).toBe("default");
  });

  it("elects out of the selected space, not out of default", async () => {
    await seed([{ name: "default-a" }, { name: "default-b" }]);
    await seed([{ name: "team-a" }, { name: "team-b" }], "team-x");
    await selectSpace("team-x");

    expect(await resolveLiveIntent(root)).toBe("team-a");
    expect(await pinLiveIntent(root)).toBe("team-a");
    expect(process.env[LIVE_INTENT_ENV]).toBe("team-a");
  });

  it("honours the cursor of the selected space, not default's", async () => {
    const defaults = await seed([{ name: "default-a" }, { name: "default-b" }]);
    await seed([{ name: "team-a" }, { name: "team-b" }], "team-x");
    await selectSpace("team-x");
    // A stale cursor in the space nobody is on must not suppress the pin.
    await writeFile(path.join(defaults, "active-intent"), "default-b\n");

    expect(await pinLiveIntent(root)).toBe("team-a");
  });

  it("mirrors the selected space's cursor, so a view pin lands on a listed record", async () => {
    await seed([{ name: "default-a" }, { name: "default-b" }]);
    const team = await seed([{ name: "team-a" }, { name: "team-b" }], "team-x");
    await selectSpace("team-x");
    await writeFile(path.join(team, "active-intent"), "team-b\n");

    // A default-space slug is not listed in team-x, so a consumer falling back
    // to one of its own would elect nothing at all.
    expect(await pinLiveIntent(root)).toBe("team-b");
    expect(process.env[LIVE_INTENT_ENV]).toBe("team-b");
  });
});
