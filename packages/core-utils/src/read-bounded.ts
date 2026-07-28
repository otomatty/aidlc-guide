import { open, readFile, stat } from "node:fs/promises";

/**
 * S-RC-4: nothing is read without a size check first. This bounds the transient
 * allocation of a single read; BR-RC-6 (no bodies retained in the model) bounds
 * the resident side. Both are needed — they cover different moments.
 */
export const MAX_READ_BYTES = 10 * 1024 * 1024;

/** How much of a cell artifact the verdict scan looks at (performance-requirements.md 設計制約). */
export const VERDICT_TAIL_BYTES = 4096;

/** Raw reasons; callers map these onto their own StandardReason values. */
export type BoundedReason = "not-found" | "not-a-file" | "unreadable" | "file-too-large";

/**
 * Narrower than `ReadResult<string>` on purpose: a bounded read can never be
 * `unsupported`, so call sites do not have to handle a variant that cannot occur.
 */
export type BoundedRead =
  | { ok: true; value: string }
  | { ok?: undefined; error: true; reason: BoundedReason };

/** R-RC-3: an engine mid-write may leave a BOM; strip it before line parsing. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * `stat` → reject oversize → read. The single place a whole file is loaded
 * (security-design.md S-RC-4), used by readState, readArtifact and audit shards.
 */
export async function readBounded(
  file: string,
  max: number = MAX_READ_BYTES,
): Promise<BoundedRead> {
  let size: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) return { error: true, reason: "not-a-file" };
    size = info.size;
  } catch {
    return { error: true, reason: "not-found" };
  }
  if (size > max) return { error: true, reason: "file-too-large" };

  try {
    return { ok: true, value: stripBom(await readFile(file, "utf8")) };
  } catch {
    return { error: true, reason: "unreadable" };
  }
}

/**
 * Last `bytes` of a file as text. The verdict marker sits in the closing
 * `## Review` section, so the matrix scan never loads 593 whole artifacts
 * (P-RC-2a). Returns `null` on any read failure — the caller degrades to
 * `verdict: null` rather than failing the cell.
 */
export async function readTail(
  file: string,
  bytes: number = VERDICT_TAIL_BYTES,
): Promise<string | null> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const info = await stat(file);
    if (!info.isFile()) return null;
    const length = Math.min(bytes, info.size);
    if (length === 0) return "";
    handle = await open(file, "r");
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, info.size - length);
    return buffer.toString("utf8");
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {});
  }
}
