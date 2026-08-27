import { readdir, stat } from "node:fs/promises";
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
 * The first record (sorted, so the choice is stable across platforms) that
 * actually carries a state file — a record without one cannot satisfy the
 * suites this exists for. `null` when the workspace has no such record.
 */
export async function resolveLiveIntent(
  workspaceRoot: string,
  space: string = DEFAULT_SPACE,
): Promise<string | null> {
  const dir = intentsDirOf(workspaceRoot, space);
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
 * Deliberately a no-op in the two cases where an answer already exists: an
 * explicit environment pin (someone is testing a specific record) and a real
 * cursor file (a developer's live session — the file wins over the variable in
 * `resolveIntents` anyway, so writing one here would be inert *and*
 * misleading).
 */
export async function pinLiveIntent(
  workspaceRoot: string,
  space: string = DEFAULT_SPACE,
): Promise<string | null> {
  const existing = process.env[LIVE_INTENT_ENV]?.trim();
  if (existing !== undefined && existing !== "") return existing;

  if (await isFile(path.join(intentsDirOf(workspaceRoot, space), "active-intent"))) return null;

  const elected = await resolveLiveIntent(workspaceRoot, space);
  if (elected === null) return null;
  process.env[LIVE_INTENT_ENV] = elected;
  return elected;
}
