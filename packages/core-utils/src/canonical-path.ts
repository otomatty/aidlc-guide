import { realpath as walkRealpath, realpathSync } from "node:fs";
import { realpath as osRealpath } from "node:fs/promises";
import { promisify } from "node:util";

const walk = promisify(walkRealpath);

/**
 * The one path identity: the final path the OS reports for `target`.
 *
 * Node ships two resolvers that disagree on Windows. `fs/promises.realpath` and
 * `realpathSync.native` ask the OS, which also expands 8.3 short names
 * (`RUNNER~1`) and subst drives; `realpathSync` and callback
 * `realpath` walk the path in JS and only follow links. A path from one compared
 * with a path from the other names one folder twice, so compare paths only after
 * resolving both here.
 *
 * The OS resolver fails on some virtual volumes (RAM disks and similar) where the
 * JS walk works, so those volumes fall back to the walk rather than stop resolving.
 * A missing path fails both ways and still throws.
 */
export async function canonicalPath(target: string): Promise<string> {
  try {
    return await osRealpath(target);
  } catch {
    return walk(target);
  }
}

/** Synchronous {@link canonicalPath}; both forms return the same path. */
export function canonicalPathSync(target: string): string {
  try {
    return realpathSync.native(target);
  } catch {
    return realpathSync(target);
  }
}
