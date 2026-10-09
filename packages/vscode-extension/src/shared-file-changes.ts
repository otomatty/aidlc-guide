import { execFile } from "node:child_process";
import path from "node:path";
import { type HarnessId, harnessVersionRel } from "@aidlc-guide/reader-core";

/**
 * Which files a project update changed, for the "commit these" step of the
 * version-check UX (docs/maintenance/version-gate-design.md). Git, not the
 * updater, is the source: it also sees managed blocks in files like
 * `.gitignore`, and it is what the person will commit from.
 */

export type GitStatus = Map<string, string>;

/** `git status --porcelain=v1 -z`: `XY path\0`, with a rename's source as an extra entry. */
export function parseGitStatus(raw: string): GitStatus {
  const status: GitStatus = new Map();
  const entries = raw.split("\0");
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? "";
    if (entry.length < 4) continue;
    const code = entry.slice(0, 2);
    status.set(entry.slice(3), code);
    if (code.includes("R") || code.includes("C")) index += 1;
  }
  return status;
}

/** Null when the folder is not a repository or git is unavailable. */
export function gitStatusSnapshot(root: string, signal?: AbortSignal): Promise<GitStatus | null> {
  const env = { ...process.env };
  // The question is about this folder, not a repository selected by the parent shell.
  for (const key of Object.keys(env)) if (key.toUpperCase().startsWith("GIT_")) delete env[key];
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", root, "status", "--porcelain=v1", "-z", "--untracked-files=normal"],
      { env, signal, windowsHide: true, timeout: 20_000, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => resolve(error ? null : parseGitStatus(stdout)),
    );
  });
}

/** Paths whose status the update changed, sorted; paths already dirty and untouched stay out. */
export function changedSince(before: GitStatus, after: GitStatus): string[] {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].filter((file) => before.get(file) !== after.get(file)).sort();
}

/** The shared paths a project update rewrites, named before it runs. */
export function sharedFilesFor(tools: readonly HarnessId[]): string[] {
  const trees = new Set(
    tools.map(
      (id) =>
        `${path
          .dirname(path.dirname(harnessVersionRel(id)))
          .split(path.sep)
          .join("/")}/`,
    ),
  );
  return [...trees, ".aidlc-version", ".gitignore"];
}

export function updateCommitMessage(target: string): string {
  return `chore: aidlc-workflows を ${target} に更新`;
}
