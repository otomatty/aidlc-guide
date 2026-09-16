#!/usr/bin/env bun
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkCandidate } from "./check-doctor-candidate.ts";
import { readFrom, workflowsTarget } from "./check-workflows-compatibility.ts";
import {
  DOCTOR_FIXTURES,
  DOCTOR_REGISTRY,
  type DoctorCapture,
  type DoctorRegistry,
  type DoctorRelease,
} from "./doctor-evidence.ts";

/** Records evidence only after every supplied OS satisfies a previously reviewed contract. */
export function recordDoctorCandidates(
  root: string,
  directories: string[],
  reviewedVersion: string,
): void {
  const target = workflowsTarget(readFrom(root));
  const registry = JSON.parse(
    readFileSync(path.join(root, DOCTOR_REGISTRY), "utf8"),
  ) as DoctorRegistry;
  const reviewed = registry.releases[reviewedVersion];
  if (reviewed?.kind !== "captured")
    throw new Error("a previously reviewed process contract is required");
  const records = directories.map((directory) => {
    const candidate = JSON.parse(
      readFileSync(path.join(directory, "candidate.json"), "utf8"),
    ) as DoctorRelease;
    const platform = candidate.captures?.[0]?.platform;
    if (!platform || !["win32", "darwin", "linux"].includes(platform))
      throw new Error("unsupported capture platform");
    const errors = checkCandidate(directory, reviewed, platform);
    if (
      candidate.upstreamSha !== target.upstreamSha ||
      candidate.captures?.some((c) => c.version !== target.version)
    )
      errors.push("candidate differs from manifest version/SHA");
    if (errors.length) throw new Error(errors.join("\n"));
    return { directory, candidate, platform };
  });
  if (!records.length) throw new Error("no candidates supplied");
  const current = registry.releases[target.version];
  if (current && current.upstreamSha !== target.upstreamSha)
    throw new Error("an existing release cannot be rebound to another SHA");
  const replaced = new Set(records.map((r) => r.platform));
  if (replaced.size !== records.length) throw new Error("duplicate candidate platform");
  const captures: DoctorCapture[] = (current?.captures ?? []).filter(
    (c) => !replaced.has(c.platform),
  );
  for (const { directory, candidate } of records) {
    for (const capture of candidate.captures ?? []) {
      for (const field of ["stdout", "stderr", "expected"] as const) {
        const source = path.join(directory, capture[field].path);
        const relative = `captured/${target.version}/${capture[field].path}`;
        const dest = path.join(root, DOCTOR_FIXTURES, relative);
        mkdirSync(path.dirname(dest), { recursive: true });
        cpSync(source, dest);
        capture[field] = { ...capture[field], path: relative };
      }
      captures.push(capture);
    }
  }
  captures.sort((a, b) =>
    `${a.platform}/${a.channel}/${a.harness}/${a.scenario}`.localeCompare(
      `${b.platform}/${b.channel}/${b.harness}/${b.scenario}`,
    ),
  );
  registry.releases[target.version] = { ...records[0]?.candidate, captures } as DoctorRelease;
  writeFileSync(path.join(root, DOCTOR_REGISTRY), `${JSON.stringify(registry, null, 2)}\n`);
}

if (import.meta.main) {
  const [reviewed, ...directories] = process.argv.slice(2);
  if (!reviewed || !directories.length)
    throw new Error("usage: record-doctor-candidate <reviewed version> <capture directories...>");
  recordDoctorCandidates(process.cwd(), directories, reviewed);
}
