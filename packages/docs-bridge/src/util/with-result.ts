import type { ReadResult } from "@aidlc-guide/shared-types";

/**
 * Last line of defence for R-DB-1 ("throw ゼロ"): every public method body runs
 * inside this, so an unexpected internal fault becomes `{error, reason}` rather
 * than an exception crossing the package boundary.
 *
 * Duplicated from reader-core for the same dependency-isolation reason as
 * `guard-path.ts` — see the note there.
 */
export async function withResult<T>(fn: () => Promise<ReadResult<T>>): Promise<ReadResult<T>> {
  try {
    return await fn();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { error: true, reason: `internal: ${message}` };
  }
}
