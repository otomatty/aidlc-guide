import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Which intent record the **live-workspace tests** run against.
 *
 * Several suites read this repository's own AI-DLC record rather than a
 * fixture (reader-core's intent election, mcp-server's stdio smoke test,
 * api-core's timings). Election needs a cursor: with more than one record
 * present, `resolveIntents` cannot elect on its own and every one of those
 * suites degrades to `no-active-intent`.
 *
 * That cursor — `aidlc/spaces/<space>/intents/active-intent` — is per-user and
 * gitignored, so a fresh clone has none and the gate used to fail there while
 * passing in CI, which injected `AIDLC_ACTIVE_INTENT` from the workflow file.
 * A gate that only goes green with material the caller supplies is not the
 * single definition team.md says it is (`bun run check` is the gate; CI just
 * calls it), so the precondition is established here, inside the gate, and
 * derived from the workspace instead of a pinned slug that would rot.
 */

const WORKSPACE_DIRNAME = "aidlc";
const DEFAULT_SPACE = "default";
const STATE_FILE = "aidlc-state.md";

/** Same variable `reader-core`'s `resolveIntents` reads as the cursor fallback. */
export const LIVE_INTENT_ENV = "AIDLC_ACTIVE_INTENT";

function intentsDirOf(workspaceRoot: string, space: string): string {
  return path.join(workspaceRoot, WORKSPACE_DIRNAME, "spaces", space, "intents");
}

async function isFile(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

/**
 * First non-empty line of a cursor file, or `null` when the file is missing,
 * unreadable, or carries nothing usable — the same thing `resolveIntents`
 * means by "there is no cursor". Existence alone is not the question: an empty
 * or whitespace-only `active-intent` is not a cursor downstream, so treating
 * it as one would suppress the pin and leave the live suites degraded over a
 * gitignored, per-user file.
 */
async function readCursor(file: string): Promise<string | null> {
  try {
    const first = (await readFile(file, "utf8")).split(/\r?\n/)[0]?.trim();
    return first === undefined || first === "" ? null : first;
  } catch {
    return null;
  }
}

/**
 * The space `resolveIntents` will resolve — read the same way it reads it, so
 * the precondition is established in the space the application actually looks
 * in. Electing a record from `spaces/default` while the workspace points at
 * another space pins a slug that is not listed there, and the live suites
 * degrade to `no-active-intent` exactly as if nothing had been pinned.
 *
 * Read here rather than borrowed from reader-core on purpose: a harness that
 * establishes a precondition through the code under test cannot fail loudly
 * when that code breaks.
 */
export async function resolveActiveSpace(workspaceRoot: string): Promise<string> {
  const named = await readCursor(path.join(workspaceRoot, WORKSPACE_DIRNAME, "active-space"));
  return named ?? DEFAULT_SPACE;
}

/** Record directories of a space, sorted so the order is stable per platform. */
async function listRecords(intentsDir: string): Promise<string[]> {
  try {
    const entries = await readdir(intentsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * The first record (sorted, so the choice is stable across platforms) that
 * actually carries a state file — a record without one cannot satisfy the
 * suites this exists for. `null` when the workspace has no such record.
 */
export async function resolveLiveIntent(
  workspaceRoot: string,
  space?: string,
): Promise<string | null> {
  const dir = intentsDirOf(workspaceRoot, space ?? (await resolveActiveSpace(workspaceRoot)));
  for (const name of await listRecords(dir)) {
    if (await isFile(path.join(dir, name, STATE_FILE))) return name;
  }
  return null;
}

/**
 * Point {@link LIVE_INTENT_ENV} at the record this run resolves. Returns that
 * record, or `null` when none can be named.
 *
 * The variable is the only channel every live consumer shares, so it has to
 * carry the answer even when it is not the thing that decides it. Two
 * consumers read the workspace differently: reader-core (and through it the
 * MCP smoke test) resolves `fileCursor ?? envCursor`, while api-core's timings
 * suite pins a *dashboard view* — a separate mechanism that never reads the
 * cursor and falls back to a slug of its own. Leaving the variable unset
 * because a cursor already decided things is what let those two exercise
 * different records in the same run, so a cursor naming a listed record is
 * mirrored into the variable rather than merely deferred to. Downstream
 * precedence is unchanged: the file still wins, and now agrees with itself.
 *
 * A **dangling** cursor is the one case left unpinned. It short-circuits
 * `fileCursor ?? envCursor` while electing nothing, so no variable can rescue
 * it, and mirroring it would only spread a name that resolves to nothing —
 * that is a broken workspace, not something for the harness to paper over.
 */
export async function pinLiveIntent(workspaceRoot: string, space?: string): Promise<string | null> {
  const active = space ?? (await resolveActiveSpace(workspaceRoot));
  const dir = intentsDirOf(workspaceRoot, active);

  const cursor = await readCursor(path.join(dir, "active-intent"));
  if (cursor !== null) {
    if (!(await listRecords(dir)).includes(cursor)) return null;
    process.env[LIVE_INTENT_ENV] = cursor;
    return cursor;
  }

  const existing = process.env[LIVE_INTENT_ENV]?.trim();
  if (existing !== undefined && existing !== "") return existing;

  const elected = await resolveLiveIntent(workspaceRoot, active);
  if (elected === null) return null;
  process.env[LIVE_INTENT_ENV] = elected;
  return elected;
}
