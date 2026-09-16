#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkCapturedVersion,
  compareDoctorContract,
  DOCTOR_REGISTRY,
  type DoctorRegistry,
  type DoctorRelease,
  hash,
  REQUIRED_DOCTOR_CASES,
} from "./doctor-evidence.ts";

/** A successful recapture does not waive review of diagnostics outside its scenarios. */
export function checkCandidate(
  directory: string,
  reviewed: DoctorRelease,
  platform: string = process.platform,
): string[] {
  const candidate = JSON.parse(
    readFileSync(path.join(directory, "candidate.json"), "utf8"),
  ) as DoctorRelease;
  const errors: string[] = [];
  if (candidate.formatId !== "human-v1" || candidate.kind !== "captured")
    errors.push("unsupported candidate format or evidence kind");
  const prior = reviewed.sourceDigests ?? {};
  const current = candidate.sourceDigests ?? {};
  for (const file of new Set([...Object.keys(prior), ...Object.keys(current)])) {
    if (prior[file] !== current[file])
      errors.push(`diagnostic dependency requires review: ${file}`);
  }
  if (!Object.keys(current).length) errors.push("diagnostic fingerprints are absent");
  const captures = candidate.captures ?? [];
  for (const [channel, harness, scenario] of REQUIRED_DOCTOR_CASES) {
    if (
      !captures.some(
        (c) =>
          c.platform === platform &&
          c.channel === channel &&
          c.harness === harness &&
          c.scenario === scenario,
      )
    )
      errors.push(`missing capture: ${platform}/${channel}/${harness}/${scenario}`);
  }
  for (const capture of captures) {
    const id = `${capture.platform}/${capture.channel}/${capture.harness}/${capture.scenario}`;
    try {
      if (
        capture.kind !== "process" ||
        capture.upstreamSha !== candidate.upstreamSha ||
        capture.platform !== platform
      )
        throw new Error("candidate provenance mismatch");
      const read = (file: { path: string; sha256: string }) => {
        if (!/^[a-zA-Z0-9._-]+$/.test(file.path))
          throw new Error("candidate paths must be basenames");
        const bytes = readFileSync(path.join(directory, file.path));
        if (hash(bytes) !== file.sha256) throw new Error(`hash mismatch: ${file.path}`);
        return bytes.toString("utf8");
      };
      const expected = JSON.parse(read(capture.expected));
      checkCapturedVersion(capture, expected);
      const outcome = expected.counts.failed
        ? "failed"
        : expected.counts.warnings
          ? "warning"
          : "healthy";
      if (
        ["healthy", "warning", "failed"].includes(capture.scenario) &&
        outcome !== capture.scenario
      )
        errors.push(`${id}: actually ${outcome}`);
      errors.push(
        ...compareDoctorContract(
          { code: capture.code, stdout: read(capture.stdout), stderr: read(capture.stderr) },
          expected,
        ).map((e) => `${id}: ${e}`),
      );
    } catch (error) {
      errors.push(`${id}: ${String(error)}`);
    }
  }
  return errors;
}

/** Replays must reproduce the committed evidence, not just produce parseable text. */
export function compareRecordedCaptures(
  candidate: DoctorRelease,
  recorded: DoctorRelease,
): string[] {
  const errors: string[] = [];
  for (const fresh of candidate.captures ?? []) {
    const id = `${fresh.platform}/${fresh.channel}/${fresh.harness}/${fresh.scenario}`;
    const prior = recorded.captures?.find(
      (c) =>
        c.platform === fresh.platform &&
        c.channel === fresh.channel &&
        c.harness === fresh.harness &&
        c.scenario === fresh.scenario,
    );
    if (!prior) {
      errors.push(`recorded capture missing: ${id}`);
      continue;
    }
    for (const field of ["stdout", "stderr", "expected"] as const)
      if (fresh[field].sha256 !== prior[field].sha256)
        errors.push(`fresh ${id} ${field} differs from committed evidence`);
    if (
      fresh.code !== prior.code ||
      fresh.runtime.sha256 !== prior.runtime.sha256 ||
      fresh.runtime.version !== prior.runtime.version
    )
      errors.push(`fresh ${id} runtime/exit code differs from committed evidence`);
  }
  return errors;
}

if (import.meta.main) {
  const directory = process.argv[2];
  if (!directory) throw new Error("usage: check-doctor-candidate <capture directory>");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const registry = JSON.parse(
    readFileSync(path.join(root, DOCTOR_REGISTRY), "utf8"),
  ) as DoctorRegistry;
  const manifest = JSON.parse(
    readFileSync(path.join(root, "docs/official-docs.manifest.json"), "utf8"),
  );
  const reviewed = registry.releases[manifest.sourceVersion];
  if (!reviewed) throw new Error("target has no reviewed Doctor contract");
  const candidate = JSON.parse(
    readFileSync(path.join(directory, "candidate.json"), "utf8"),
  ) as DoctorRelease;
  const option = (key: string) => {
    const i = process.argv.indexOf(key);
    return i === -1 ? undefined : process.argv[i + 1];
  };
  const version = option("--version") ?? manifest.sourceVersion;
  const sha = option("--sha") ?? manifest.upstreamSha;
  const errors = checkCandidate(directory, reviewed);
  if (candidate.upstreamSha !== sha || candidate.captures?.some((c) => c.version !== version))
    errors.push("candidate is not the requested official release");
  const recorded = registry.releases[version];
  if (recorded?.kind === "captured") errors.push(...compareRecordedCaptures(candidate, recorded));
  const report = errors.length
    ? errors.join("\n")
    : "Doctor process captures match the reviewed format, diagnostics, translations and dependency fingerprints.";
  writeFileSync(path.join(directory, "report.txt"), `${report}\n`);
  console.log(report);
  process.exitCode = errors.length ? 1 : 0;
}
