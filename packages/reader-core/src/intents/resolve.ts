import { readdir } from "node:fs/promises";
import path from "node:path";
import { readBounded } from "@aidlc-guide/core-utils";
import type { IntentList, ReadResult } from "@aidlc-guide/shared-types";

/**
 * L4 — cursor resolution and enumeration.
 *
 * Active resolution mirrors aidlc-lib `activeIntent()`:
 *   cursor (if it names a listed record) > lone-intent > null.
 * Enumeration of `all` stays independent of the cursor (failure mode 2).
 */

export const DEFAULT_SPACE = "default";
const WORKSPACE_DIRNAME = "aidlc";

/** Cursors are one short line; the bound guards against a garbage file. */
const CURSOR_MAX_BYTES = 4096;

async function readCursor(file: string): Promise<string | null> {
  const read = await readBounded(file, CURSOR_MAX_BYTES);
  if (!read.ok) return null;
  const first = read.value.split(/\r?\n/)[0]?.trim();
  return first === undefined || first === "" ? null : first;
}

export function intentsDirOf(rootPath: string, space: string): string {
  return path.join(rootPath, WORKSPACE_DIRNAME, "spaces", space, "intents");
}

/**
 * Precedence matches `.claude/tools/aidlc-lib.ts` `activeIntent()`:
 * named cursor, else the single record when exactly one exists, else null.
 */
export function electActive(all: readonly string[], cursor: string | null): string | null {
  if (cursor !== null && all.includes(cursor)) return cursor;
  if (all.length === 1) return all[0] ?? null;
  return null;
}

export async function resolveIntents(rootPath: string): Promise<ReadResult<IntentList>> {
  const space =
    (await readCursor(path.join(rootPath, WORKSPACE_DIRNAME, "active-space"))) ?? DEFAULT_SPACE;
  const dir = intentsDirOf(rootPath, space);

  let all: string[];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    all = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort(); // R-RC-5
  } catch {
    return { ok: true, value: { space, active: null, all: [] } };
  }

  const cursor = await readCursor(path.join(dir, "active-intent"));
  const active = electActive(all, cursor);
  return { ok: true, value: { space, active, all } };
}

/** Record directory of the active intent, or the standard no-active-intent error. */
export async function resolveRecordDir(rootPath: string): Promise<ReadResult<string>> {
  const intents = await resolveIntents(rootPath);
  if (!("ok" in intents)) return intents;
  if (intents.value.active === null) return { error: true, reason: "no-active-intent" };
  return {
    ok: true,
    value: path.join(intentsDirOf(rootPath, intents.value.space), intents.value.active),
  };
}
