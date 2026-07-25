import { realpath } from "node:fs/promises";
import path from "node:path";
import type { ReadResult } from "@aidlc-guide/shared-types";

/*
 * Deliberate duplicate of `packages/reader-core/src/util/guard-path.ts`.
 *
 * Why not import it: reader-core depends on chokidar, so a workspace dependency
 * would pull a third-party package into docs-bridge's install closure and break
 * this unit's "zero third-party runtime dependencies"
 * (nfr-requirements/tech-stack-decisions.md). The unit DAG scopes the
 * docs-bridge -> reader-core edge to *type contracts only*
 * (inception/units-generation/unit-of-work-dependency.md), and
 * nfr-design/security-design.md S-DB-2 names algorithm duplication as the
 * default, with shared test vectors guaranteeing equivalence.
 *
 * Those vectors live in `tests/vectors/guard-path-vectors.ts` and are run
 * against BOTH copies (here and in reader-core's own suite), so any drift
 * between the two implementations fails a test.
 */

/**
 * Is `target` inside `root`?
 *
 * Deliberately `path.relative`-based, never `startsWith` on the absolute paths:
 * `"/rec/foobar".startsWith("/rec/foo")` is true, yet `/rec/foobar` is outside
 * the root. `path.relative` yields `"../foobar"` for that pair, which the `..`
 * test rejects.
 *
 * `path.sep` is used for the segment boundary rather than hardcoding `/`, and
 * both sides are resolved first so drive letters and casing are normalised by
 * the platform's own rules.
 */
function contains(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  if (rel === "") return true; // the root itself
  if (path.isAbsolute(rel)) return false; // different drive/root — no relation
  return rel !== ".." && !rel.startsWith(`..${path.sep}`);
}

/**
 * Enforcement of the docs read boundary (S-DB-2). Rejects three vectors, all as
 * `"outside-record"`:
 *  1. `../` traversal,
 *  2. an absolute path outside the root (absorbed by `path.relative`),
 *  3. symlink escape — the lexical answer is re-checked against `realpath`.
 */
export async function guardPath(root: string, relPath: string): Promise<ReadResult<string>> {
  const base = path.resolve(root);
  const target = path.resolve(base, relPath);
  if (!contains(base, target)) return { error: true, reason: "outside-record" };

  // Vector 3. A path that does not exist yet cannot be a symlink escape, so an
  // unresolvable realpath falls through to the lexical verdict; the subsequent
  // read reports it as not-found.
  try {
    const realBase = await realpath(base);
    const realTarget = await realpath(target);
    if (!contains(realBase, realTarget)) return { error: true, reason: "outside-record" };
  } catch {
    /* not resolvable — nothing to escape through */
  }

  return { ok: true, value: target };
}
