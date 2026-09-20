#!/usr/bin/env bun
/** One candidate for docs, shells, installer metadata and verified Doctor evidence. */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCli as buildArtifacts } from "./build-artifact-map.ts";
import { verifyUpstream } from "./capture-doctor-fixtures.ts";
import { readShellOverrides, shellHash } from "./check-bundled-shells.ts";
import { readFrom, workflowsTarget } from "./check-workflows-compatibility.ts";
import { parseUpstreamStateVersion } from "./check-workflows-drift.ts";
import { recordDoctorCandidates } from "./record-doctor-candidate.ts";
import { runCliWithIndex as syncDocs } from "./sync-official-docs.ts";
import { runCli as syncShells } from "./sync-workflows-shell.ts";

export function updateVersionDeclarations(root: string, previous: string, next: string): void {
  const edit = (file: string, change: (source: string) => string) => {
    const filename = path.join(root, file);
    writeFileSync(filename, change(readFileSync(filename, "utf8")));
  };
  for (const map of ["bridge-map", "agent-map"])
    edit(`packages/docs-bridge/data/${map}.json`, (text) =>
      text.replace(/("sourceVersion": "aidlc )\d+\.\d+\.\d+/, `$1${next}`),
    );
  edit("packages/shared-types/src/workflows-management.ts", (text) =>
    text.replace(/(WORKFLOWS_TARGET_VERSION\s*=\s*")[^"]+/, `$1${next}`),
  );
  edit("AGENTS.md", (text) => text.replace(/(AI-DLC Workflows )\d+\.\d+\.\d+/, `$1${next}`));
  edit("README.md", (text) =>
    text
      .split("\n")
      .map((line) => (line.includes("aidlc-workflows") ? line.replaceAll(previous, next) : line))
      .join("\n"),
  );
}

export async function prepareUpdate(root: string, upstream: string, capturesRoot: string) {
  const previous = workflowsTarget(readFrom(root));
  const next = verifyUpstream(upstream);
  const preserved = new Map<string, string>();
  for (const [file, override] of Object.entries(readShellOverrides(root))) {
    const distribution = file.startsWith(".cursor/") ? "cursor" : "claude";
    const original = path.join(upstream, "dist", distribution, file);
    if (
      shellHash(original) === override.upstreamSha256 &&
      shellHash(path.join(root, file)) === override.workspaceSha256
    )
      preserved.set(file, readFileSync(path.join(root, file), "utf8"));
  }
  const args = ["--workspace", root, "--upstream", upstream, "--upstream-sha", next.upstreamSha];
  const shell = syncShells(args);
  if (shell.status) throw new Error(shell.stderr);
  for (const [file, content] of preserved) writeFileSync(path.join(root, file), content);
  const docs = await syncDocs(args);
  if (docs.status) throw new Error(docs.stderr);
  const state = parseUpstreamStateVersion(
    readFileSync(path.join(upstream, "core/tools/aidlc-lib.ts"), "utf8"),
  );
  if (state !== previous.stateVersion)
    throw new Error(`State Version changed to ${state}; reader compatibility needs review`);
  updateVersionDeclarations(root, previous.version, next.version);
  const artifacts = buildArtifacts(["--workspace", root]);
  if (artifacts.status) throw new Error(artifacts.stdout);
  const directories = readdirSync(capturesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(capturesRoot, e.name));
  recordDoctorCandidates(root, directories, previous.version);
  const formatted = spawnSync(
    process.execPath,
    ["x", "--no-install", "oxfmt", "packages/vscode-extension/data/doctor-compatibility.json"],
    { cwd: root, encoding: "utf8" },
  );
  if (formatted.status !== 0) throw new Error(formatted.stderr);
  console.log(
    `Prepared ${next.version} (${next.upstreamSha}). Run bun run check before publication.`,
  );
}

if (import.meta.main) {
  const [upstream, capturesRoot] = process.argv.slice(2);
  if (!upstream || !capturesRoot)
    throw new Error(
      "usage: prepare-workflows-update <official checkout> <OS capture artifact directories>",
    );
  try {
    await prepareUpdate(process.cwd(), path.resolve(upstream), path.resolve(capturesRoot));
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
