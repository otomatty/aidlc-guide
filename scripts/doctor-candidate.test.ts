import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { doctorSourceDigests } from "./capture-doctor-fixtures.ts";
import { checkCandidate, compareRecordedCaptures } from "./check-doctor-candidate.ts";
import { readFrom, workflowsTarget } from "./check-workflows-compatibility.ts";
import {
  DOCTOR_FIXTURES,
  DOCTOR_REGISTRY,
  type DoctorRegistry,
  type DoctorRelease,
} from "./doctor-evidence.ts";
import { updateVersionDeclarations } from "./prepare-workflows-update.ts";
import { recordDoctorCandidates } from "./record-doctor-candidate.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = workflowsTarget(readFrom(root));
const registry = JSON.parse(
  readFileSync(path.join(root, DOCTOR_REGISTRY), "utf8"),
) as DoctorRegistry;
const reviewed = registry.releases[target.version];
if (!reviewed?.captures) throw new Error("target process evidence required");
const known: DoctorRelease = reviewed;
const temps: string[] = [];
afterEach(() => {
  for (const temp of temps.splice(0)) rmSync(temp, { recursive: true, force: true });
});
function temp() {
  const value = mkdtempSync(path.join(tmpdir(), "doctor-candidate-"));
  temps.push(value);
  return value;
}
function candidate() {
  const dir = temp();
  const value = structuredClone(known);
  value.captures = value.captures?.filter((c) => c.platform === process.platform);
  for (const capture of value.captures ?? [])
    for (const field of ["stdout", "stderr", "expected"] as const) {
      const source = path.join(root, DOCTOR_FIXTURES, capture[field].path);
      capture[field].path = path.basename(source);
      cpSync(source, path.join(dir, capture[field].path));
    }
  const save = () => writeFileSync(path.join(dir, "candidate.json"), JSON.stringify(value));
  save();
  return { dir, value, save };
}
function workspace() {
  const dir = temp();
  for (const file of [
    DOCTOR_REGISTRY,
    "docs/official-docs.manifest.json",
    ".claude/tools/aidlc-lib.ts",
    "README.md",
    "AGENTS.md",
    "packages/docs-bridge/data/bridge-map.json",
    "packages/docs-bridge/data/agent-map.json",
    "packages/shared-types/src/workflows-management.ts",
  ]) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    cpSync(path.join(root, file), path.join(dir, file));
  }
  return dir;
}
describe("Doctor update candidate", () => {
  it("requires fresh process evidence to reproduce the committed report and runtime", () => {
    const fixture = candidate();
    expect(compareRecordedCaptures(fixture.value, known)).toEqual([]);
    const first = fixture.value.captures?.[0];
    if (!first) throw new Error("capture required");
    first.stdout.sha256 = "0".repeat(64);
    first.runtime.sha256 = "1".repeat(64);
    const errors = compareRecordedCaptures(fixture.value, known).join("\n");
    expect(errors).toContain("stdout differs");
    expect(errors).toContain("runtime/exit code differs");
  });
  it("accepts real OS captures and rejects new or changed diagnostic dependencies", () => {
    const fixture = candidate();
    expect(checkCandidate(fixture.dir, known)).toEqual([]);
    fixture.value.sourceDigests = {
      ...fixture.value.sourceDigests,
      "core/tools/new-diagnostic.ts": "0".repeat(64),
    };
    fixture.save();
    expect(checkCandidate(fixture.dir, known)).toContain(
      "diagnostic dependency requires review: core/tools/new-diagnostic.ts",
    );
  });
  it("does not accept a fixture renamed to a future version", () => {
    const fixture = candidate();
    for (const capture of fixture.value.captures ?? []) capture.version = "999.0.0";
    fixture.save();
    expect(checkCandidate(fixture.dir, known).join("\n")).toContain("runtime stamp");
  });
  it("registers checked captures, but refuses changed source and duplicate OS inputs before registration", () => {
    const fixture = candidate();
    const dir = workspace();
    recordDoctorCandidates(dir, [fixture.dir], target.version);
    const saved = JSON.parse(readFileSync(path.join(dir, DOCTOR_REGISTRY), "utf8"));
    expect(saved.releases[target.version].captures).toHaveLength(27);
    expect(() => recordDoctorCandidates(dir, [fixture.dir, fixture.dir], target.version)).toThrow(
      "duplicate candidate platform",
    );
    fixture.value.sourceDigests = {};
    fixture.save();
    expect(() => recordDoctorCandidates(dir, [fixture.dir], target.version)).toThrow(
      "requires review",
    );
  });
  it("normalizes only AIDLC_VERSION and notices a new source dependency", () => {
    const dir = temp();
    mkdirSync(path.join(dir, "core/tools"), { recursive: true });
    const file = path.join(dir, "core/tools/aidlc-version.ts");
    writeFileSync(file, 'export const AIDLC_VERSION = "2.9.0";\n');
    const before = doctorSourceDigests(dir);
    writeFileSync(file, 'export const AIDLC_VERSION = "2.10.0";\n');
    expect(doctorSourceDigests(dir)).toEqual(before);
    writeFileSync(path.join(dir, "core/tools/added.ts"), "export const diagnostic = 'new';\n");
    expect(Object.keys(doctorSourceDigests(dir))).toContain("core/tools/added.ts");
  });
  it("updates authored version declarations without touching the extension release version", () => {
    const dir = workspace();
    updateVersionDeclarations(dir, target.version, "999.0.0");
    for (const map of ["bridge-map", "agent-map"])
      expect(
        JSON.parse(readFileSync(path.join(dir, `packages/docs-bridge/data/${map}.json`), "utf8"))
          .sourceVersion,
      ).toBe(`aidlc 999.0.0 (State Version ${target.stateVersion})`);
    expect(
      readFileSync(path.join(dir, "packages/shared-types/src/workflows-management.ts"), "utf8"),
    ).toContain('WORKFLOWS_TARGET_VERSION = "999.0.0"');
    expect(readFileSync(path.join(dir, "AGENTS.md"), "utf8")).toContain("AI-DLC Workflows 999.0.0");
  });
});
