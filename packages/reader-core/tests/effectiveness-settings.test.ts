import * as fs from "node:fs/promises";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usageTrackingDisabled } from "../src/effectiveness/settings.ts";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, stat: vi.fn(actual.stat) };
});

const FLAG = "AIDLC_DISABLE_USAGE_TRACKING";
let root: string;
let machine: string;
const settings = (bypasses?: string[]) =>
  JSON.stringify({
    schemaVersion: 1,
    flags: { schemaVersion: 1, ...(bypasses ? { bypasses } : {}) },
  });
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "effectiveness-settings-"));
  machine = join(root, "machine");
  await mkdir(machine);
  vi.stubEnv("AIDLC_INSTALL_ROOT", machine);
  vi.stubEnv(FLAG, undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

describe("usage settings precedence", () => {
  it("inherits missing leaves and replaces bypass arrays, including empty local lists", async () => {
    const warnings: string[] = [];
    expect(await usageTrackingDisabled(root, warnings)).toBe(false);
    await writeFile(join(machine, "aidlc.settings.json"), settings([FLAG]));
    await writeFile(join(root, "aidlc.settings.json"), settings());
    expect(await usageTrackingDisabled(root, warnings)).toBe(true);
    await writeFile(join(root, "aidlc.settings.json"), settings(["AIDLC_SKIP_ARTIFACT_GUARD"]));
    expect(await usageTrackingDisabled(root, warnings)).toBe(false);
    await writeFile(join(root, "aidlc.settings.local.json"), settings([FLAG]));
    expect(await usageTrackingDisabled(root, warnings)).toBe(true);
    await writeFile(join(root, "aidlc.settings.local.json"), settings([]));
    expect(await usageTrackingDisabled(root, warnings)).toBe(false);
    expect(warnings).toEqual([]);
  });
  it.each(["1", "0", "", "true"])(
    "gives explicit environment value %j precedence",
    async (value) => {
      await writeFile(join(root, "aidlc.settings.json"), "invalid JSON");
      vi.stubEnv(FLAG, value);
      const warnings: string[] = [];
      expect(await usageTrackingDisabled(root, warnings)).toBe(value === "1");
      expect(warnings).toEqual([]);
    },
  );
  it.each([
    "invalid JSON",
    "null",
    '{"schemaVersion":2}',
    '{"schemaVersion":1,"flags":[]}',
    '{"schemaVersion":1,"flags":{"schemaVersion":1,"bypasses":true}}',
  ])("withholds usage when settings cannot be resolved: %s", async (value) => {
    await writeFile(join(root, "aidlc.settings.json"), value);
    const warnings: string[] = [];
    expect(await usageTrackingDisabled(root, warnings)).toBe(true);
    expect(warnings).toEqual(["project usage settings unavailable; token and cost data withheld"]);
  });
  it("withholds usage for oversized settings", async () => {
    await writeFile(join(root, "aidlc.settings.local.json"), " ".repeat(65 * 1024));
    const warnings: string[] = [];
    expect(await usageTrackingDisabled(root, warnings)).toBe(true);
    expect(warnings[0]).toContain("local usage settings unavailable");
  });
  it("does not treat denied settings access as an absent layer", async () => {
    vi.mocked(fs.stat).mockRejectedValueOnce(
      Object.assign(new Error("denied"), { code: "EACCES" }),
    );
    const warnings: string[] = [];
    expect(await usageTrackingDisabled(root, warnings)).toBe(true);
    expect(warnings).toEqual(["machine usage settings unavailable; token and cost data withheld"]);
  });
});
