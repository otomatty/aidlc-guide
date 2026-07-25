import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { guardPath } from "@aidlc-guide/reader-core";
import type { AnswerError, AnswerRequest, ReadResult } from "@aidlc-guide/shared-types";
import { json } from "./read.ts";

/**
 * `POST /api/answer` — the entire write surface of this system (BR-DS-1).
 *
 * This is the **only** module in the package allowed to import write APIs; the
 * isolation is enforced by a Biome `noRestrictedImports` override rather than
 * by convention, so a write cannot appear elsewhere without the lint failing
 * (S-DS-3).
 *
 * The seven steps run as a straight line of early returns, in this order:
 *   1. host mode        → 403 read-only-mode
 *   2. filename         → 403 not-a-questions-file
 *   3. path containment → 403 outside-record
 *   4. target line      → 403 not-an-answer-line
 *   5. build + verify   → 500 write-verification-failed  (**before** any write)
 *   6. tmp write + atomic rename
 *   7. 200 ok
 */

const ANSWER_PREFIX = "[Answer]:";
const QUESTIONS_FILE = /-questions\.md$/;
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const LF = 0x0a;
const CR = 0x0d;

/** R-DS-5: one short backoff for the Windows locked-file case. */
export const RENAME_RETRY_MS = 50;

/** Windows reports a locked destination as any of these; all are retryable once. */
const RETRYABLE_RENAME_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);

function deny(error: AnswerError, status: number): Response {
  return json({ error }, status);
}

function badRequest(reason: string): Response {
  return json({ error: "bad-request", reason }, 400);
}

export interface AnswerContext {
  /** `--host` is running — every write is refused, no client-type branching (BR-DS-3). */
  hostMode: boolean;
  recordDir(): Promise<ReadResult<string>>;
}

interface Span {
  start: number;
  /** Offset just past the last content byte, i.e. excluding CR/LF. */
  contentEnd: number;
  /** Offset just past the terminator. */
  end: number;
}

/**
 * Split on raw bytes, keeping each line's terminator as a distinct slice.
 *
 * Never decodes to a string and never rejoins: that is what preserves CRLF,
 * a missing final newline, and any non-UTF-8 byte the file happens to carry
 * (BR-DS-7 byte invariance).
 */
function lineSpans(buf: Buffer, from: number): Span[] {
  const spans: Span[] = [];
  let start = from;
  for (let i = from; i < buf.length; i += 1) {
    if (buf[i] !== LF) continue;
    const hasCr = i > start && buf[i - 1] === CR;
    spans.push({ start, contentEnd: hasCr ? i - 1 : i, end: i + 1 });
    start = i + 1;
  }
  if (start < buf.length) spans.push({ start, contentEnd: buf.length, end: buf.length });
  return spans;
}

/**
 * Re-derive the line structure of the *candidate* buffer and compare it to the
 * original, line by line.
 *
 * Deliberately not a restatement of how `next` was built — it re-splits the
 * result from scratch, so an off-by-one in the offset arithmetic shows up here
 * as a mismatch instead of being written to the user's file.
 */
function verifyInvariance(
  before: Buffer,
  after: Buffer,
  bomLen: number,
  target: number,
  expected: Buffer,
): boolean {
  if (!before.subarray(0, bomLen).equals(after.subarray(0, bomLen))) return false;
  const olds = lineSpans(before, bomLen);
  const news = lineSpans(after, bomLen);
  if (olds.length !== news.length) return false;

  for (let i = 0; i < olds.length; i += 1) {
    const a = olds[i];
    const b = news[i];
    if (a === undefined || b === undefined) return false;
    // Terminators must survive byte-for-byte: this is the CRLF guarantee.
    if (!before.subarray(a.contentEnd, a.end).equals(after.subarray(b.contentEnd, b.end))) {
      return false;
    }
    const content = after.subarray(b.start, b.contentEnd);
    const matches =
      i === target
        ? content.equals(expected)
        : content.equals(before.subarray(a.start, a.contentEnd));
    if (!matches) return false;
  }
  return true;
}

function isAnswerRequest(body: unknown): body is AnswerRequest {
  if (typeof body !== "object" || body === null) return false;
  const { file, line, value } = body as Record<string, unknown>;
  return (
    typeof file === "string" &&
    file !== "" &&
    typeof line === "number" &&
    Number.isInteger(line) &&
    line >= 1 &&
    typeof value === "string"
  );
}

/**
 * Rename, retried once after a short backoff when the destination is locked by
 * another process — the common Windows case with an editor or virus scanner on
 * the file (R-DS-5). `doRename` is injectable so that retry is testable without
 * reproducing a real lock.
 */
export async function renameWithRetry(
  from: string,
  to: string,
  doRename: (a: string, b: string) => Promise<void> = rename,
): Promise<void> {
  try {
    await doRename(from, to);
  } catch (cause) {
    const code = (cause as { code?: string }).code;
    if (code === undefined || !RETRYABLE_RENAME_CODES.has(code)) throw cause;
    await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_MS));
    await doRename(from, to);
  }
}

export async function handleAnswer(ctx: AnswerContext, request: Request): Promise<Response> {
  // 1. Mode gate — first, so that no other step can be reached in host mode.
  if (ctx.hostMode) return deny("read-only-mode", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid-json");
  }
  if (!isAnswerRequest(body)) return badRequest("invalid-body");
  // A newline in the value would inject extra lines into the artifact, which
  // no byte-invariance check downstream could undo. Refuse it at the boundary.
  if (/[\r\n]/.test(body.value)) return badRequest("multiline-value");

  // 2. Filename gate.
  if (!QUESTIONS_FILE.test(path.basename(body.file))) return deny("not-a-questions-file", 403);

  // 3. Path gate — the single check point on the write path (S-DS-4): writes do
  //    not go through the reader, so nothing else re-checks containment.
  const record = await ctx.recordDir();
  if (!("ok" in record)) return deny("outside-record", 403);
  const guarded = await guardPath(record.value, body.file);
  if (!("ok" in guarded)) return deny("outside-record", 403);
  const target = guarded.value;

  let original: Buffer;
  try {
    original = await readFile(target);
  } catch {
    return json({ error: true, reason: "artifact-not-found" }, 404);
  }

  // 4. Line gate.
  const bomLen = original.subarray(0, BOM.length).equals(BOM) ? BOM.length : 0;
  const spans = lineSpans(original, bomLen);
  const index = body.line - 1;
  const span = spans[index];
  if (span === undefined) return deny("not-an-answer-line", 403);
  const content = original.subarray(span.start, span.contentEnd);
  if (!content.subarray(0, ANSWER_PREFIX.length).equals(Buffer.from(ANSWER_PREFIX))) {
    return deny("not-an-answer-line", 403);
  }

  // 5. Build by offset replacement, then verify — before touching the disk.
  const replacement = Buffer.from(`${ANSWER_PREFIX} ${body.value}`);
  const next = Buffer.concat([
    original.subarray(0, span.start),
    replacement,
    original.subarray(span.contentEnd),
  ]);
  if (!verifyInvariance(original, next, bomLen, index, replacement)) {
    return deny("write-verification-failed", 500);
  }

  // 6. Commit. The tmp lives in the *same* directory to avoid a cross-volume
  //    rename (EXDEV), and is removed on both paths so no debris is left.
  const tmp = path.join(path.dirname(target), `.answer-tmp-${process.pid}`);
  try {
    await writeFile(tmp, next);
    await renameWithRetry(tmp, target);
  } catch {
    // The rename either happened or it did not; the original is never a
    // partially written file (R-DS-2).
    return deny("write-verification-failed", 500);
  } finally {
    await unlink(tmp).catch(() => {});
  }

  // 7. Done — the watcher picks the change up and pushes it to every client.
  return json({ ok: true });
}
