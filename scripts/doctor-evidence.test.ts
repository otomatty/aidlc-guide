import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseDoctorOutput } from "../packages/vscode-extension/src/doctor-output.ts";
import { readFrom, workflowsTarget } from "./check-workflows-compatibility.ts";
import {
  checkDoctorEvidence,
  compareDoctorContract,
  DOCTOR_FIXTURES,
  DOCTOR_PLATFORMS,
  DOCTOR_REGISTRY,
  type DoctorRegistry,
  evidenceText,
  REQUIRED_DOCTOR_CASES,
} from "./doctor-evidence.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = workflowsTarget(readFrom(root));
const registry = JSON.parse(
  readFileSync(path.join(root, DOCTOR_REGISTRY), "utf8"),
) as DoctorRegistry;
const release = registry.releases[target.version];
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("required test evidence is missing");
  return value;
}
function targetRelease(value: DoctorRegistry) {
  const found = required(value.releases[target.version]);
  return { release: found, captures: required(found.captures) };
}
const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) {
    // Remove the link itself first, so the recursive delete can never reach
    // the real fixtures behind a Windows junction.
    const link = path.join(dir, DOCTOR_FIXTURES);
    try {
      if (lstatSync(link).isSymbolicLink()) rmdirOrUnlink(link);
    } catch {
      // No link was made for this case.
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
function rmdirOrUnlink(link: string): void {
  try {
    unlinkSync(link);
  } catch {
    rmdirSync(link);
  }
}

function broken(change: (value: DoctorRegistry) => void): string[] {
  const temp = mkdtempSync(path.join(tmpdir(), "doctor-evidence-test-"));
  directories.push(temp);
  // The fixtures are only read, so link them instead of copying hundreds of
  // files per case, which timed out on Windows. A junction needs no privilege.
  mkdirSync(path.dirname(path.join(temp, DOCTOR_FIXTURES)), { recursive: true });
  symlinkSync(path.join(root, DOCTOR_FIXTURES), path.join(temp, DOCTOR_FIXTURES), "junction");
  cpSync(
    path.join(root, "packages/vscode-extension/data"),
    path.join(temp, "packages/vscode-extension/data"),
    { recursive: true },
  );
  const clone = structuredClone(registry);
  change(clone);
  writeFileSync(path.join(temp, DOCTOR_REGISTRY), JSON.stringify(clone));
  return checkDoctorEvidence(temp, target);
}

describe("Doctor release evidence", () => {
  it("requires actual target captures and validates every committed file and translation", () => {
    expect(release?.kind).toBe("captured");
    expect(release?.captures?.length).toBeGreaterThanOrEqual(
      DOCTOR_PLATFORMS.length * REQUIRED_DOCTOR_CASES.length,
    );
    expect(checkDoctorEvidence(root, target)).toEqual([]);
  });
  it.each(release?.captures ?? [])(
    "parses the real $platform/$channel/$harness/$scenario report via the supported version entry",
    (capture) => {
      const stdout = evidenceText(root, capture.stdout);
      const stderr = evidenceText(root, capture.stderr);
      const expected = JSON.parse(evidenceText(root, capture.expected));
      for (const version of [target.version, `v${target.version}`]) {
        const parsed = parseDoctorOutput({ code: capture.code, stdout, stderr }, version);
        expect(parsed.counts).toEqual(expected.counts);
        expect(parsed.checks).toHaveLength(expected.checks.length);
        expect(parsed.unparsedOutput).toEqual([]);
      }
    },
  );
  it("rejects a new target without captures, a wrong SHA, and fabricated legacy evidence", () => {
    expect(
      broken((r) => {
        delete r.releases[target.version];
      }).join("\n"),
    ).toContain("real process captures");
    expect(
      broken((r) => {
        targetRelease(r).release.upstreamSha = "0".repeat(40);
      }).join("\n"),
    ).toContain("upstream SHA");
    expect(
      broken((r) => {
        targetRelease(r).release.kind = "legacy";
      }).join("\n"),
    ).toContain("new releases cannot use legacy evidence");
  });
  it("rejects an omitted scenario, edited output, and an old capture disguised as the target", () => {
    expect(
      broken((r) => {
        targetRelease(r).captures.pop();
      }).join("\n"),
    ).toContain("missing");
    expect(
      broken((r) => {
        required(targetRelease(r).captures[0]).stdout.sha256 = "0".repeat(64);
      }).join("\n"),
    ).toContain("SHA-256 mismatch");
    expect(
      broken((r) => {
        required(targetRelease(r).captures[0]).version = "2.8.0";
      }).join("\n"),
    ).toContain("provenance");
  });
  it("rejects lost rows, unknown sections, unknown diagnostics and count mismatches", () => {
    const capture = required(
      targetRelease(registry).captures.find((c) => c.scenario === "healthy"),
    );
    const stdout = evidenceText(root, capture.stdout);
    const expected = JSON.parse(evidenceText(root, capture.expected));
    const run = (text: string) =>
      compareDoctorContract({ code: 0, stdout: text, stderr: "" }, expected);
    expect(run(stdout.replace("Machine", "Future section")).join("\n")).toContain("unparsed");
    expect(run(stdout.replace(/ {2}ok +[^\n]+\n/, "")).join("\n")).toContain("rows");
    expect(
      run(stdout.replace("0 problems, 0 warnings.", "0 problems, 1 warning.")).join("\n"),
    ).toContain("counts");
    expect(
      run(stdout.replace(/ {2}ok +[^\n]+/, "  ok    Future diagnostic: original text")).join("\n"),
    ).toContain("untranslated label");
  });
  it("counts analysis warnings in addition to upstream JSON diagnostics", () => {
    const capture = required(
      targetRelease(registry).captures.find((c) => c.scenario === "analysis-warning"),
    );
    const expected = JSON.parse(evidenceText(root, capture.expected));
    expect(expected.checks).toContainEqual(
      expect.objectContaining({
        status: "warn",
        originalLabel: expect.stringContaining("[plan-marker-malformed]"),
      }),
    );
    expect(expected.counts.warnings).toBeGreaterThan(0);
  });
});
