import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usageTrackingDisabled } from "../src/effectiveness/settings.ts";
import { validUsageSettings } from "../src/effectiveness/settings-schema.ts";

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
  it.each([
    { unexpected: true },
    { flags: { schemaVersion: 1, bypasses: [], swarm: "yes" } },
    { flags: { schemaVersion: 1, bypasses: ["unknown"] } },
    { flags: { schemaVersion: 1, bypasses: [], sensorTimeoutMs: 0 } },
    { models: { schemaVersion: 1, preset: "unknown" } },
    { models: { schemaVersion: 1, agents: { developer: { model: { cursor: " " } } } } },
    { models: { schemaVersion: 1, groups: { writing: { effort: "high" } } } },
    { offline: true },
  ])("withholds usage for engine-invalid settings: %j", async (fields) => {
    await writeFile(
      join(root, "aidlc.settings.json"),
      JSON.stringify({ schemaVersion: 1, ...fields }),
    );
    const warnings: string[] = [];
    expect(await usageTrackingDisabled(root, warnings)).toBe(true);
    expect(warnings).toEqual(["project usage settings unavailable; token and cost data withheld"]);
  });
  it("matches the shipped engine normalizer across settings sections and layers", () => {
    const flagCases = [
      null,
      [],
      {},
      { schemaVersion: 1 },
      { schemaVersion: 2 },
      {
        schemaVersion: 1,
        defaultScope: "feature",
        swarm: true,
        hookDebug: false,
        sensorTimeoutMs: 1,
        bypasses: [FLAG, FLAG],
      },
      { schemaVersion: 1, unexpected: true },
      { schemaVersion: 1, defaultScope: "1bad" },
      { schemaVersion: 1, swarm: "yes" },
      { schemaVersion: 1, hookDebug: null },
      { schemaVersion: 1, sensorTimeoutMs: 1.5 },
      { schemaVersion: 1, bypasses: ["unknown"] },
    ];
    const modelCases = [
      null,
      [],
      {},
      { schemaVersion: 1 },
      { schemaVersion: 2 },
      {
        schemaVersion: 1,
        preset: "balanced",
        groups: { deciding: { effort: "max" } },
        agents: { "developer-1": { model: { cursor: " model " }, effort: "high" } },
        profiles: { "team-1": { groups: { reviewing: { effort: "low" } } } },
      },
      { schemaVersion: 1, unknown: true },
      { schemaVersion: 1, preset: "unknown" },
      { schemaVersion: 1, groups: [] },
      { schemaVersion: 1, groups: { deciding: {} } },
      { schemaVersion: 1, groups: { deciding: { effort: "unknown" } } },
      { schemaVersion: 1, groups: { unknown: { effort: "low" } } },
      { schemaVersion: 1, agents: { "bad.name": {} } },
      { schemaVersion: 1, agents: { developer: { unknown: true } } },
      { schemaVersion: 1, agents: { developer: { effort: "unknown" } } },
      { schemaVersion: 1, agents: { developer: { model: { unknown: "model" } } } },
      { schemaVersion: 1, agents: { developer: { model: { cursor: " " } } } },
      { schemaVersion: 1, profiles: { "bad.name": { groups: {} } } },
      { schemaVersion: 1, profiles: { team: {} } },
      { schemaVersion: 1, profiles: { team: { groups: {}, extra: 1 } } },
    ];
    const values = [
      null,
      [],
      {},
      { schemaVersion: 2 },
      { schemaVersion: 1 },
      ...flagCases.map((flags) => ({ schemaVersion: 1, flags })),
      ...modelCases.map((models) => ({ schemaVersion: 1, models })),
      ...[
        {},
        { $schema: " " },
        { $schema: "schema.json" },
        { unexpected: true },
        { offline: true },
        { offline: "yes" },
        { "update-check": true },
        { "release-base-url": "https://example.com/releases" },
        { "release-base-url": "http://localhost/releases" },
        { "release-base-url": "http://example.com" },
        { "release-base-url": "https://user:pass@example.com" },
        { "release-base-url": "https://example.com?query=1" },
        { "release-base-url": "https://example.com#fragment" },
        { "release-base-url": "invalid" },
        { "ca-bundle": join(root, "ca.pem") },
        { "ca-bundle": "relative.pem" },
      ].map((fields) => ({ schemaVersion: 1, ...fields })),
    ];
    const cases = ["machine", "project", "local"].flatMap((layer) =>
      values.map((value) => ({ value, layer })),
    );
    const reference = spawnSync(
      "bun",
      [
        "-e",
        `
      import { normalizeAidlcSettings } from './.claude/tools/aidlc-settings.ts';
      const cases = JSON.parse(await Bun.stdin.text());
      console.log(JSON.stringify(cases.map(({value, layer}) => {
        try { normalizeAidlcSettings(value, layer, 'fixture'); return true; }
        catch { return false; }
      })));
    `,
      ],
      {
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        input: JSON.stringify(cases),
        encoding: "utf8",
        timeout: 20_000,
      },
    );
    expect(reference.status, reference.stderr).toBe(0);
    expect(cases.map(({ value, layer }) => validUsageSettings(value, layer))).toEqual(
      JSON.parse(reference.stdout),
    );
  }, 25_000);
});
