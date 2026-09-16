#!/usr/bin/env bun
/** Offline release gate. The docs manifest is the only target-version authority. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  expectedSourceVersion,
  parseAgentsDeclaration,
  parseReadmeDeclaration,
  parseUpstreamStateVersion,
  parseWorkspaceStateVersions,
} from "./check-workflows-drift.ts";
import { checkDoctorEvidence } from "./doctor-evidence.ts";
import { parseAidlcVersion } from "./sync-official-docs.ts";

export type ReadText = (relativePath: string) => string;
export const readFrom =
  (root: string): ReadText =>
  (file) =>
    readFileSync(path.join(root, file), "utf8");

/** Required declarations never silently disappear when a source file is reformatted. */
export function workflowsTarget(read: ReadText) {
  const manifest = JSON.parse(read("docs/official-docs.manifest.json"));
  if (!/^\d+\.\d+\.\d+$/.test(manifest.sourceVersion ?? "")) {
    throw new Error("manifest: sourceVersion must be a stable release");
  }
  if (!/^[a-f0-9]{40}$/.test(manifest.upstreamSha ?? "")) {
    throw new Error("manifest: upstreamSha must be a full commit SHA");
  }
  const stateVersion = parseUpstreamStateVersion(read(".claude/tools/aidlc-lib.ts"));
  if (stateVersion === null) throw new Error("Claude engine State Version is missing");
  const version: string = manifest.sourceVersion;
  const upstreamSha: string = manifest.upstreamSha;
  return {
    version,
    upstreamSha,
    stateVersion,
    sourceVersion: expectedSourceVersion(version, stateVersion),
  };
}

export function checkMetadata(read: ReadText): string[] {
  const errors: string[] = [];
  const verify = (label: string, inspect: () => void) => {
    try {
      inspect();
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const equal = (actual: unknown, expected: unknown) => {
    if (actual !== expected)
      throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  };
  try {
    const target = workflowsTarget(read);
    const json = (file: string) => JSON.parse(read(file));
    for (const field of ["sourceVersion", "upstreamSha"] as const) {
      verify(`docs index ${field}`, () =>
        equal(
          json("docs/official-docs.index.json")[field],
          field === "sourceVersion" ? target.version : target.upstreamSha,
        ),
      );
    }
    for (const map of ["bridge-map", "agent-map", "artifact-map"]) {
      verify(map, () =>
        equal(json(`packages/docs-bridge/data/${map}.json`).sourceVersion, target.sourceVersion),
      );
    }
    for (const harness of ["claude", "cursor"]) {
      verify(`${harness} version`, () =>
        equal(parseAidlcVersion(read(`.${harness}/tools/aidlc-version.ts`)), target.version),
      );
      verify(`${harness} state`, () =>
        equal(
          parseUpstreamStateVersion(read(`.${harness}/tools/aidlc-lib.ts`)),
          target.stateVersion,
        ),
      );
      verify(`${harness} stamp`, () => {
        const stamp = json(`.${harness}/tools/data/aidlc-stamp.json`);
        equal(stamp.schemaVersion, 1);
        equal(stamp.frameworkVersion, target.version);
        equal(stamp.distribution, harness);
        equal(stamp.harnessDir, `.${harness}`);
      });
    }
    verify("installer target", () =>
      equal(
        /WORKFLOWS_TARGET_VERSION\s*=\s*["']([^"']+)["']/.exec(
          read("packages/shared-types/src/workflows-management.ts"),
        )?.[1],
        target.version,
      ),
    );
    verify("reader state", () => {
      const state = parseWorkspaceStateVersions(read("packages/shared-types/src/index.ts"));
      equal(state?.current, target.stateVersion);
      equal(state?.supported.includes(target.stateVersion), true);
    });
    const stages = json(".claude/tools/data/stage-graph.json").length;
    verify("AGENTS declaration", () => {
      const declared = parseAgentsDeclaration(read("AGENTS.md"));
      equal(declared.version, target.version);
      equal(declared.stateVersion, target.stateVersion);
      equal(declared.stages, stages);
    });
    verify("README declaration", () => {
      const declared = parseReadmeDeclaration(read("README.md"));
      equal(declared.version, target.version);
      equal(declared.stateVersion, target.stateVersion);
      equal(declared.stages, stages);
      for (const version of declared.otherVersions) equal(version, target.version);
    });
  } catch (error) {
    errors.push(String(error));
  }
  return errors;
}

export function checkCompatibility(root: string): string[] {
  const read = readFrom(root);
  const errors = checkMetadata(read);
  try {
    errors.push(...checkDoctorEvidence(root, workflowsTarget(read)));
  } catch (error) {
    errors.push(`Doctor evidence: ${String(error)}`);
  }
  return errors;
}

if (import.meta.main) {
  const errors = checkCompatibility(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  );
  console.log(
    errors.length
      ? errors.join("\n")
      : "workflows compatibility: metadata and Doctor evidence match the pinned release",
  );
  process.exitCode = errors.length ? 1 : 0;
}
