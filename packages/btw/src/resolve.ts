import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fail } from "./errors.ts";
import { projectSlug } from "./slug.ts";

/** A mainline session located for `--fork` (domain-entities.md). */
export interface SessionRef {
  /** Derived from the JSONL filename. */
  sessionId: string;
  /** Where it was found — kept for diagnostics. */
  jsonlPath: string;
  /** Basis of the "latest" decision. */
  mtime: Date;
}

const JSONL = ".jsonl";

export const BRANCH_HINT =
  "If you need the mainline context, run /branch inside the mainline session instead.";

/** `~/.claude/projects/<projectSlug(cwd)>` — exported so errors and tests agree on it. */
export function sessionsDir(cwd: string, home: string = homedir()): string {
  return path.join(home, ".claude", "projects", projectSlug(cwd));
}

/**
 * Newest `*.jsonl` in the project's session directory (F2 / BR-2).
 *
 * One `readdir` plus one `stat` per candidate, keeping only the running maximum:
 * O(n), no sort, and the file bodies are never opened (P-BTW-2, S-BTW-3 — a
 * session transcript may hold sensitive text, so btw does not read it).
 * There is no interactive picker: either it resolves, or it fails with the
 * computed path plus the `/branch` alternative (BR-2, R-BTW-5).
 */
export async function resolveLatestSession(
  cwd: string,
  home: string = homedir(),
): Promise<SessionRef> {
  const dir = sessionsDir(cwd, home);

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    throw fail({
      reason: "no mainline session found: session directory does not exist",
      path: dir,
      hint: BRANCH_HINT,
    });
  }

  let latest: SessionRef | undefined;
  for (const name of entries) {
    if (!name.endsWith(JSONL)) continue;
    const jsonlPath = path.join(dir, name);
    let mtime: Date;
    try {
      mtime = (await stat(jsonlPath)).mtime;
    } catch {
      // Vanished or unreadable between readdir and stat — skip it rather than
      // abort; if nothing survives, the "no session files" failure below fires.
      continue;
    }
    if (latest === undefined || mtime > latest.mtime) {
      latest = { sessionId: name.slice(0, -JSONL.length), jsonlPath, mtime };
    }
  }

  if (latest === undefined) {
    throw fail({
      reason: "no mainline session found: no readable .jsonl session files",
      path: dir,
      hint: BRANCH_HINT,
    });
  }
  return latest;
}
