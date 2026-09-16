import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  type DoctorCommandResult,
  parseDoctorFormat,
} from "../packages/vscode-extension/src/doctor-output.ts";

export const DOCTOR_REGISTRY = "packages/vscode-extension/data/doctor-compatibility.json";
export const DOCTOR_FIXTURES = "packages/vscode-extension/tests/fixtures/doctor";
export const GENERATOR_VERSION = 1;
export const REQUIRED_DOCTOR_CASES = [
  ["copy", "claude", "healthy"],
  ["copy", "claude", "warning"],
  ["copy", "claude", "failed"],
  ["native", "claude", "healthy"],
  ["native", "claude", "warning"],
  ["native", "claude", "failed"],
  ["copy", "claude", "bun-path"],
  ["copy", "claude", "analysis-warning"],
  ["copy", "kiro", "kiro-provider"],
] as const;
export const hash = (bytes: string | Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
export type EvidenceFile = { path: string; sha256: string };
export type ExpectedDoctor = {
  code: number;
  counts: { passed: number; warnings: number; failed: number };
  checks: { section: string; status: string; originalLabel: string; originalFix?: string }[];
};
export type DoctorCapture = {
  kind: "process";
  platform: string;
  channel: "copy" | "native";
  harness: string;
  scenario: string;
  version: string;
  upstreamSha: string;
  generatorVersion: number;
  command: string[];
  runtime: { version: string; sha256: string };
  code: number;
  stdout: EvidenceFile;
  stderr: EvidenceFile;
  expected: EvidenceFile;
};
export type DoctorRelease = {
  formatId: string;
  kind: "legacy" | "captured";
  fixtures?: string[];
  upstreamSha?: string;
  sourceDigests?: Record<string, string>;
  captures?: DoctorCapture[];
};
export type DoctorRegistry = { schemaVersion: number; releases: Record<string, DoctorRelease> };

export function compareDoctorContract(
  result: DoctorCommandResult,
  expected: ExpectedDoctor,
): string[] {
  const report = parseDoctorFormat(result, "candidate", "human-v1", "capture");
  const errors: string[] = [];
  const actual = report.checks.map(({ section, status, originalLabel, originalFix }) => ({
    section,
    status,
    originalLabel,
    ...(originalFix === undefined ? {} : { originalFix }),
  }));
  if (JSON.stringify(actual) !== JSON.stringify(expected.checks))
    errors.push("diagnostic rows/sections/remedies differ from upstream data");
  if (JSON.stringify(report.counts) !== JSON.stringify(expected.counts))
    errors.push("counts differ from upstream data");
  if (result.code !== expected.code || (result.code === 0) !== (expected.counts.failed === 0))
    errors.push("exit code does not match diagnostic status");
  if (report.unparsedOutput.length)
    errors.push(`unparsed output: ${report.unparsedOutput.join("\n")}`);
  if (report.outcome === "unavailable") errors.push(report.summary);
  for (const check of report.checks) {
    if (!check.translated) errors.push(`untranslated label: ${check.originalLabel}`);
    if (check.fixTranslated === false) errors.push(`untranslated remedy: ${check.originalFix}`);
  }
  return errors;
}

/** All evidence paths are confined to the committed fixture directory. */
export function evidenceText(root: string, file: EvidenceFile): string {
  if (!file || typeof file.path !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256))
    throw new Error("invalid evidence file descriptor");
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(file.path) ||
    file.path.split("/").includes("..") ||
    path.isAbsolute(file.path)
  )
    throw new Error("unsafe evidence path");
  const bytes = readFileSync(path.join(root, DOCTOR_FIXTURES, file.path));
  if (hash(bytes) !== file.sha256) throw new Error(`${file.path}: SHA-256 mismatch`);
  return bytes.toString("utf8");
}

export function checkDoctorEvidence(
  root: string,
  target: { version: string; upstreamSha: string },
): string[] {
  const registry = JSON.parse(
    readFileSync(path.join(root, DOCTOR_REGISTRY), "utf8"),
  ) as DoctorRegistry;
  const errors: string[] = [];
  if (registry.schemaVersion !== 1) errors.push("Doctor registry schema is unsupported");
  const targetRelease = registry.releases[target.version];
  if (targetRelease?.kind !== "captured")
    errors.push(
      `Doctor ${target.version}: target requires real process captures, not legacy examples`,
    );
  if (targetRelease?.upstreamSha !== target.upstreamSha)
    errors.push("Doctor target upstream SHA differs from docs manifest");
  for (const [version, release] of Object.entries(registry.releases)) {
    try {
      if (release.formatId !== "human-v1") throw new Error("unsupported formatId");
      if (release.kind === "legacy") {
        // Frozen migration exception, not a mechanism for registering future releases.
        if (!["2.8.0", "2.8.1", "2.8.2"].includes(version))
          throw new Error("new releases cannot use legacy evidence");
        if (!release.fixtures?.length) throw new Error("legacy regression fixtures missing");
        for (const file of release.fixtures) readFileSync(path.join(root, DOCTOR_FIXTURES, file));
        continue;
      }
      if (release.kind !== "captured" || !/^[a-f0-9]{40}$/.test(release.upstreamSha ?? ""))
        throw new Error("invalid release provenance");
      if (!release.sourceDigests?.["core/tools/aidlc-doctor.ts"])
        throw new Error("Doctor dependency fingerprints missing");
      const captures = release.captures ?? [];
      for (const [channel, harness, scenario] of REQUIRED_DOCTOR_CASES) {
        if (
          !captures.some(
            (c) =>
              c.platform === "win32" &&
              c.channel === channel &&
              c.harness === harness &&
              c.scenario === scenario,
          )
        )
          errors.push(`Doctor ${version}: missing win32/${channel}/${harness}/${scenario}`);
      }
      const ids = new Set<string>();
      for (const capture of captures) {
        const id = `${capture.platform}/${capture.channel}/${capture.harness}/${capture.scenario}`;
        try {
          if (ids.has(id)) throw new Error("duplicate capture");
          ids.add(id);
          if (
            capture.kind !== "process" ||
            capture.version !== version ||
            capture.upstreamSha !== release.upstreamSha
          )
            throw new Error("capture provenance differs from release");
          if (
            capture.generatorVersion !== GENERATOR_VERSION ||
            !capture.runtime?.version ||
            !/^[a-f0-9]{64}$/.test(capture.runtime.sha256)
          )
            throw new Error("runtime provenance missing");
          if (
            !capture.command.includes("doctor") ||
            !capture.command.includes("--verbose") ||
            !capture.command.includes("--no-color")
          )
            throw new Error("capture command is not verbose Doctor");
          const stdout = evidenceText(root, capture.stdout);
          const stderr = evidenceText(root, capture.stderr);
          const expected = JSON.parse(evidenceText(root, capture.expected)) as ExpectedDoctor;
          const outcome = expected.counts.failed
            ? "failed"
            : expected.counts.warnings
              ? "warning"
              : "healthy";
          if (
            ["healthy", "warning", "failed"].includes(capture.scenario) &&
            outcome !== capture.scenario
          )
            throw new Error(`scenario is actually ${outcome}`);
          errors.push(
            ...compareDoctorContract({ code: capture.code, stdout, stderr }, expected).map(
              (e) => `Doctor ${version}/${id}: ${e}`,
            ),
          );
        } catch (error) {
          errors.push(`Doctor ${version}/${id}: ${String(error)}`);
        }
      }
    } catch (error) {
      errors.push(`Doctor ${version}: ${String(error)}`);
    }
  }
  return errors;
}
