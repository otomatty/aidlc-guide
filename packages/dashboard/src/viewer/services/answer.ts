import type { AnswerError, AnswerRequest } from "@aidlc-guide/shared-types";
import { fetchArtifact } from "../../services/api.ts";

/**
 * **S-AV-1: the entire write surface of the client.** This is the only module
 * in `packages/dashboard` that issues a non-GET request, and
 * `dependency-direction.test.ts` fails if a second one appears.
 */

export type SaveResult =
  /** 200 + re-read. `verified` is BR-DS-7's check, re-run on the client. */
  | { kind: "saved"; markdown: string; verified: boolean }
  /** One of the server's five gate rejections (D2). */
  | { kind: "rejected"; error: AnswerError }
  /** Unknown identifier, transport failure, or a failed re-read (D2 default). */
  | { kind: "failed"; reason: string };

/**
 * Byte-span of a 1-based line, terminator **excluded** — the CR/LF stays in
 * the suffix, so a terminator that changed shows up as a mismatch.
 */
function lineBounds(text: string, line: number): { start: number; end: number } | null {
  let start = 0;
  for (let i = 1; i < line; i += 1) {
    const newline = text.indexOf("\n", start);
    if (newline === -1) return null;
    start = newline + 1;
  }
  if (start > text.length) return null;
  const newline = text.indexOf("\n", start);
  let end = newline === -1 ? text.length : newline;
  if (end > start && text.charAt(end - 1) === "\r") end -= 1;
  return { start, end };
}

/**
 * P-AV-4: everything except the edited line, concatenated — one string compare,
 * no diff algorithm. The caller only ever sees the boolean (S-AV-5): the file's
 * other lines must not reach an error message.
 */
export function unchangedOutsideLine(before: string, after: string, line: number): boolean {
  const a = lineBounds(before, line);
  const b = lineBounds(after, line);
  if (a === null || b === null) return false;
  return (
    before.slice(0, a.start) + before.slice(a.end) === after.slice(0, b.start) + after.slice(b.end)
  );
}

/** Narrow the server's rejection body onto the five known identifiers. */
const GATE_ERRORS: ReadonlySet<string> = new Set<AnswerError>([
  "read-only-mode",
  "not-a-questions-file",
  "outside-record",
  "not-an-answer-line",
  "write-verification-failed",
]);

/**
 * `POST /api/answer`, then **re-read and re-verify** (D2).
 *
 * There is no optimistic update: what gets displayed is the body the server
 * hands back on the second request, so the file on disk stays the only truth
 * even for the split second after a successful write.
 */
export async function saveAnswer(request: AnswerRequest, before: string): Promise<SaveResult> {
  let response: Response;
  try {
    response = await fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    return { kind: "failed", reason: "server-unreachable" };
  }

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    return { kind: "failed", reason: `http-${response.status}` };
  }
  const record = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  if (response.ok && record.ok === true) {
    const reread = await fetchArtifact(request.file);
    if (!("ok" in reread)) {
      // The write may well have landed; what failed is the confirmation, and
      // saying so beats showing content we did not re-read.
      return {
        kind: "failed",
        reason: "unsupported" in reread ? `unsupported-version-${reread.version}` : reread.reason,
      };
    }
    return {
      kind: "saved",
      markdown: reread.value,
      verified: unchangedOutsideLine(before, reread.value, request.line),
    };
  }

  const error = record.error;
  if (typeof error === "string" && GATE_ERRORS.has(error)) {
    return { kind: "rejected", error: error as AnswerError };
  }
  // Default branch: a gate the server grew after this client shipped, or a
  // reason-shaped body. Never silently swallowed (D2).
  const reason =
    typeof error === "string"
      ? error
      : typeof record.reason === "string"
        ? record.reason
        : `http-${response.status}`;
  return { kind: "failed", reason };
}
