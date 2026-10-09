#!/usr/bin/env bun
/**
 * Write the metadata asset a release carries next to its VSIX.
 *
 * Usage:
 *   bun scripts/release-metadata.ts <extension version> <output file>
 *
 * The extension's update dialog reads it before installing a new Guide: when
 * the new Guide supports another aidlc-workflows release, the current project
 * stays blocked until it is updated, so the person is told before choosing
 * (docs/maintenance/version-gate-design.md). The release job runs this from
 * the commit it packaged, so the value is the one inside that VSIX.
 */
import { writeFileSync } from "node:fs";
import { WORKFLOWS_TARGET_VERSION } from "../packages/shared-types/src/index.ts";

export type ReleaseMetadataFile = {
  schemaVersion: 1;
  version: string;
  workflowsTarget: string;
};

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function releaseMetadata(version: string): ReleaseMetadataFile {
  if (!SEMVER.test(version)) throw new Error(`not an extension version: ${version}`);
  return { schemaVersion: 1, version, workflowsTarget: WORKFLOWS_TARGET_VERSION };
}

if (import.meta.main) {
  const [version, out] = process.argv.slice(2);
  if (version === undefined || out === undefined) {
    console.error("usage: bun scripts/release-metadata.ts <version> <output file>");
    process.exit(2);
  }
  writeFileSync(out, `${JSON.stringify(releaseMetadata(version), null, 2)}\n`);
  console.log(`wrote ${out}: aidlc-workflows ${WORKFLOWS_TARGET_VERSION}`);
}
