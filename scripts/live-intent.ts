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
  try {
    const raw = await readFile(path.join(workspaceRoot, WORKSPACE_DIRNAME, "active-space"), "utf8");
    const first = raw.split(/\r?\n/)[0]?.trim();
    return first === undefined || first === "" ? DEFAULT_SPACE : first;
  } catch {
    return DEFAULT_SPACE;
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
  let names: string[];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    names = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return null;
  }

  for (const name of names) {
    if (await isFile(path.join(dir, name, STATE_FILE))) return name;
  }
  return null;
}

/**
 * Set {@link LIVE_INTENT_ENV} for this process when nothing else elects a
 * record. Returns the value now in effect, or `null` when the pin was not
 * needed and not possible.
 *
 * Deliberately a no-op in the two cases where an answer already exists: a real
 * cursor file (a developer's live session) and an explicit environment pin
 * (someone is testing a specific record).
 *
 * The cursor is checked first because that is the order downstream:
 * `resolveIntents` reads `fileCursor ?? envCursor`, so a cursor on disk makes
 * the variable inert. Returning the variable while a cursor exists would name
 * a record the run is not actually using.
 */
export async function pinLiveIntent(workspaceRoot: string, space?: string): Promise<string | null> {
  const active = space ?? (await resolveActiveSpace(workspaceRoot));
  if (await isFile(path.join(intentsDirOf(workspaceRoot, active), "active-intent"))) return null;

  const existing = process.env[LIVE_INTENT_ENV]?.trim();
  if (existing !== undefined && existing !== "") return existing;

  const elected = await resolveLiveIntent(workspaceRoot, active);
  if (elected === null) return null;
  process.env[LIVE_INTENT_ENV] = elected;
  return elected;
}
