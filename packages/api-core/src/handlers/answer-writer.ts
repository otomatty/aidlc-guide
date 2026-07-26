import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { guardPath } from "@aidlc-guide/reader-core";
import type { AnswerError, AnswerRequest, ReadResult } from "@aidlc-guide/shared-types";
import { json, type RouteResult } from "./read.ts";

/**
 * `POST /api/answer` — the entire write surface of this system (BR-DS-1).
 *
 * This is the **only** module in the package allowed to import write APIs; the
 * isolation is enforced by a Biome `noRestrictedImports` override rather than
 * by convention, so a write cannot appear elsewhere without the lint failing
 * (S-DS-3).
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

function denyRoute(error: AnswerError, status: number): RouteResult {
  return { status, body: { error } };
}

function badRequestRoute(reason: string): RouteResult {
  return { status: 400, body: { error: "bad-request", reason } };
}

export interface AnswerContext {
  /** `--host` is running — every write is refused, no client-type branching (BR-DS-3). */
  hostMode: boolean;
  recordDir(): Promise<ReadResult<string>>;
}

interface Span {
  start: number;
  contentEnd: number;
  end: number;
}

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

/** Transport-agnostic answer write — used by HTTP and VS Code postMessage. */
export async function routeAnswer(ctx: AnswerContext, body: unknown): Promise<RouteResult> {
  if (ctx.hostMode) return denyRoute("read-only-mode", 403);
  if (!isAnswerRequest(body)) return badRequestRoute("invalid-body");
  if (/[\r\n]/.test(body.value)) return badRequestRoute("multiline-value");

  if (!QUESTIONS_FILE.test(path.basename(body.file))) {
    return denyRoute("not-a-questions-file", 403);
  }

  const record = await ctx.recordDir();
  if (!("ok" in record)) return denyRoute("outside-record", 403);
  const guarded = await guardPath(record.value, body.file);
  if (!("ok" in guarded)) return denyRoute("outside-record", 403);
  const target = guarded.value;

  let original: Buffer;
  try {
    original = await readFile(target);
  } catch {
    return { status: 404, body: { error: true, reason: "artifact-not-found" } };
  }

  const bomLen = original.subarray(0, BOM.length).equals(BOM) ? BOM.length : 0;
  const spans = lineSpans(original, bomLen);
  const index = body.line - 1;
  const span = spans[index];
  if (span === undefined) return denyRoute("not-an-answer-line", 403);
  const content = original.subarray(span.start, span.contentEnd);
  if (!content.subarray(0, ANSWER_PREFIX.length).equals(Buffer.from(ANSWER_PREFIX))) {
    return denyRoute("not-an-answer-line", 403);
  }

  const replacement = Buffer.from(`${ANSWER_PREFIX} ${body.value}`);
  const next = Buffer.concat([
    original.subarray(0, span.start),
    replacement,
    original.subarray(span.contentEnd),
  ]);
  if (!verifyInvariance(original, next, bomLen, index, replacement)) {
    return denyRoute("write-verification-failed", 500);
  }

  const tmp = path.join(path.dirname(target), `.answer-tmp-${process.pid}`);
  try {
    await writeFile(tmp, next);
    await renameWithRetry(tmp, target);
  } catch {
    return denyRoute("write-verification-failed", 500);
  } finally {
    await unlink(tmp).catch(() => {});
  }

  return { status: 200, body: { ok: true } };
}

export async function handleAnswer(ctx: AnswerContext, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-request", reason: "invalid-json" }, 400);
  }
  const result = await routeAnswer(ctx, body);
  return json(result.body, result.status);
}
