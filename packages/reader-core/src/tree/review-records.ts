import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { guardPath, mapBounded, readBounded } from "@aidlc-guide/core-utils";
import type { Verdict } from "@aidlc-guide/shared-types";

// aidlc-workflows v2.8.2: aidlc-lib.ts reviewCompletionMatchesRequest,
// ReviewRecord, and isReviewRecordRelativePath. Badges expose current readiness,
// so unlike the engine's historical review context they reset on a new attempt.

export const REVIEW_DIRNAME = ".aidlc-reviews";
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const REQUEST_ID = /^review:[0-9a-f]{32}$/;
const MAX_REVIEW_BYTES = 4 * 1024 * 1024;
const BOUNDARIES = new Set(["WORKFLOW_STARTED", "STAGE_JUMPED", "STAGE_STARTED", "GATE_REJECTED"]);
const FIELDS = new Set([
  "Event",
  "Timestamp",
  "Stage",
  "Unit",
  "Workflow",
  "Reviewer",
  "Iteration",
  "Attempt Generation",
  "Request Id",
  "Artifact Fingerprint",
  "Request Fingerprint",
  "Source Fingerprint",
  "Request Source Fingerprint",
  "Unit Source Fingerprint",
  "Review Challenge",
  "Review Appendix Artifact",
  "Review Appendix Offset",
  "Review Appendix Prior Digest",
  "Review Appendix Prior Length",
  "Review Record",
  "Review Record Digest",
  "Verdict",
]);
type Fields = Record<string, string>;
type Row = { fields: Fields; valid: boolean; time: number; shard: string; position: number };
export type ReviewVerdicts = { cells: Map<string, Verdict | null>; unavailable: boolean };
export const reviewCellKey = (unit: string, stage: string): string => `${unit}\0${stage}`;

function parseRows(text: string, shard: string): Row[] {
  return text.split(/^---\s*$/m).flatMap((block, position) => {
    const fields: Fields = Object.create(null);
    const seen = new Set<string>();
    let valid = true;
    for (const match of block.matchAll(/^(?:-\s*)?\*\*([^*\r\n]+)\*\*:[ \t]*([^\r\n]*)$/gm)) {
      const name = (match[1] ?? "").trim();
      if (seen.has(name)) valid = false;
      seen.add(name);
      if (FIELDS.has(name) && !Object.hasOwn(fields, name)) fields[name] = (match[2] ?? "").trim();
    }
    const time = Date.parse(fields.Timestamp ?? "");
    if (!fields.Event || fields.Workflow || !Number.isFinite(time)) return [];
    return [{ fields, valid, time, shard, position }];
  });
}

/** Units affected by an audit write, including attempt resets after a review. */
export async function reviewUnitsInAuditShard(
  recordDir: string,
  changedPath: string,
): Promise<string[] | null> {
  const guarded = await guardPath(recordDir, changedPath);
  if (!("ok" in guarded)) return null;
  const rel = path.relative(path.resolve(recordDir), guarded.value).split(path.sep);
  if (rel.length !== 2 || rel[0] !== "audit" || !rel[1]?.endsWith(".md")) return null;
  const read = await readBounded(guarded.value);
  if (!read.ok) return null;
  const changed = parseRows(read.value, rel[1]);
  const units = new Set(
    changed.flatMap(({ fields }) =>
      fields.Event?.startsWith("REVIEW_") && fields.Unit && SEGMENT.test(fields.Unit)
        ? [fields.Unit]
        : [],
    ),
  );
  const boundaries = changed.filter(({ fields }) => BOUNDARIES.has(fields.Event ?? ""));
  if (boundaries.length > 0) {
    // A reset may land in a different clone's shard from the review it retires.
    // Read only audit metadata to discover those units; never scan their artifacts here.
    const snapshot = await auditRows(recordDir);
    for (const { fields } of snapshot.rows) {
      if (!fields.Event?.startsWith("REVIEW_") || !SEGMENT.test(fields.Unit ?? "")) continue;
      if (
        boundaries.some(
          ({ fields: boundary }) =>
            boundary.Event === "WORKFLOW_STARTED" ||
            boundary.Event === "STAGE_JUMPED" ||
            (boundary.Stage === fields.Stage && (!boundary.Unit || boundary.Unit === fields.Unit)),
        )
      )
        units.add(fields.Unit as string);
    }
  }
  return [...units].sort();
}

/** Read exact bytes without following a redirected container or leaf. */
async function recordBytes(root: string, relative: string): Promise<Buffer | null> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    let cursor = await realpath(root);
    const parts = relative.split("/");
    for (const part of parts) {
      cursor = path.join(cursor, part);
      if ((await lstat(cursor)).isSymbolicLink()) return null;
    }
    handle = await open(cursor, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.size > MAX_REVIEW_BYTES) return null;
    const bytes = Buffer.alloc(before.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = await handle.read(bytes, length, bytes.length - length, length);
      if (read.bytesRead === 0) break;
      length += read.bytesRead;
    }
    if (length !== before.size) return null;
    return bytes.subarray(0, length);
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {});
  }
}

function recordPath(fields: Fields): string | null {
  const relative = fields["Review Record"] ?? "";
  const parts = relative.split("/");
  const unit = fields.Unit;
  const attempt = unit ? parts[4] : parts[3];
  if (!SEGMENT.test(fields.Stage ?? "") || !DIGEST.test(fields["Review Record Digest"] ?? ""))
    return null;
  if (
    parts[0] !== REVIEW_DIRNAME ||
    parts[1] !== fields.Stage ||
    !/^[0-9a-f]{16}$/.test(attempt ?? "")
  )
    return null;
  if (
    unit
      ? parts.length !== 6 || parts[2] !== "units" || parts[3] !== unit || !SEGMENT.test(unit)
      : parts.length !== 5 || parts[2] !== "stage"
  )
    return null;
  return parts.at(-1) === `${fields.Iteration}.json` && /^[1-9][0-9]*$/.test(fields.Iteration ?? "")
    ? relative
    : null;
}

async function verifiedVerdict(root: string, fields: Fields): Promise<Verdict | null> {
  const relative = recordPath(fields);
  if (!relative) return null;
  const bytes = await recordBytes(root, relative);
  if (
    !bytes ||
    `sha256:${createHash("sha256").update(bytes).digest("hex")}` !== fields["Review Record Digest"]
  )
    return null;
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1)
    return null;
  const bindings = {
    stage: "Stage",
    unit: "Unit",
    workflow: "Workflow",
    reviewer: "Reviewer",
    verdict: "Verdict",
    request_id: "Request Id",
    artifact_fingerprint: "Artifact Fingerprint",
    source_fingerprint: "Source Fingerprint",
    unit_source_fingerprint: "Unit Source Fingerprint",
    request_challenge: "Review Challenge",
  };
  for (const [name, field] of Object.entries(bindings))
    if (value[name] !== (fields[field] ?? null)) return null;
  const parts = relative.split("/");
  if (
    value.attempt !== parts.at(-2) ||
    value.iteration !== Number(fields.Iteration) ||
    typeof value.body !== "string" ||
    typeof value.recorded_at !== "string" ||
    !Array.isArray(value.findings)
  )
    return null;
  if (
    !value.findings.every(
      (finding) =>
        finding &&
        typeof finding === "object" &&
        /^R-[0-9]+$/.test(finding.id) &&
        ["severity", "location", "finding", "required_action", "status"].every(
          (key) => typeof finding[key] === "string",
        ) &&
        (["New", "Unresolved", "Resolved", "Accepted risk"].includes(finding.status) ||
          /^Rejected: \S[\s\S]*$/.test(finding.status)),
    )
  )
    return null;
  return value.verdict === "READY" || value.verdict === "NOT-READY" ? value.verdict : null;
}

function pairKey(f: Fields): string {
  return [f.Stage, f.Unit ?? "", f.Reviewer, f.Iteration, f["Request Id"] ?? ""].join("\0");
}

function matches(request: Row, completion: Row): boolean {
  const a = request.fields;
  const b = completion.fields;
  for (const field of [
    "Review Challenge",
    "Review Appendix Artifact",
    "Review Appendix Offset",
    "Review Appendix Prior Digest",
    "Review Appendix Prior Length",
  ]) {
    if ((a[field] ?? null) !== (b[field] ?? null)) return false;
  }
  return (
    request.valid &&
    completion.valid &&
    (b.Verdict === "READY" || b.Verdict === "NOT-READY") &&
    recordPath(b) !== null &&
    REQUEST_ID.test(a["Request Id"] ?? "") &&
    DIGEST.test(a["Artifact Fingerprint"] ?? "") &&
    DIGEST.test(b["Artifact Fingerprint"] ?? "") &&
    (b["Request Fingerprint"] ?? b["Artifact Fingerprint"]) === a["Artifact Fingerprint"] &&
    (!a["Source Fingerprint"] ||
      (a["Source Fingerprint"] === b["Request Source Fingerprint"] &&
        a["Source Fingerprint"] === b["Source Fingerprint"])) &&
    (!a["Unit Source Fingerprint"] ||
      a["Unit Source Fingerprint"] === b["Unit Source Fingerprint"]) &&
    (a["Attempt Generation"] ?? "") === (b["Attempt Generation"] ?? "")
  );
}

async function auditRows(recordDir: string): Promise<{ rows: Row[]; unavailable: boolean }> {
  let shards: string[];
  try {
    shards = (await readdir(path.join(recordDir, "audit")))
      .filter((name) => name.endsWith(".md"))
      .sort();
  } catch (error) {
    return { rows: [], unavailable: (error as { code?: string }).code !== "ENOENT" };
  }
  let unavailable = false;
  const reads = await mapBounded(shards, 4, async (shard) => {
    const guarded = await guardPath(recordDir, `audit/${shard}`);
    if (!("ok" in guarded)) {
      unavailable = true;
      return [];
    }
    const read = await readBounded(guarded.value);
    if (!read.ok) {
      unavailable = true;
      return [];
    }
    return parseRows(read.value, shard);
  });
  const rows = reads
    .flat()
    .sort((a, b) => a.time - b.time || a.shard.localeCompare(b.shard) || a.position - b.position);
  return { rows, unavailable };
}

/** One bounded audit snapshot per matrix build; never retain review bodies. */
export async function readReviewVerdicts(recordDir: string): Promise<ReviewVerdicts> {
  const { rows, unavailable } = await auditRows(recordDir);
  const cells = new Map<string, Verdict | null>();
  const completed = new Map<string, Fields[]>();
  const pending = new Map<string, Row>();
  const latestRequest = new Map<string, Row>();
  for (const row of rows) {
    const f = row.fields;
    if (BOUNDARIES.has(f.Event ?? "")) {
      const global = f.Event === "WORKFLOW_STARTED" || f.Event === "STAGE_JUMPED";
      for (const [key, request] of latestRequest) {
        const target = request.fields;
        if (global || (target.Stage === f.Stage && (!f.Unit || f.Unit === target.Unit))) {
          cells.set(key, null);
          completed.delete(key);
          latestRequest.delete(key);
        }
      }
      for (const [key, request] of pending) {
        if (
          global ||
          (request.fields.Stage === f.Stage && (!f.Unit || request.fields.Unit === f.Unit))
        )
          pending.delete(key);
      }
      continue;
    }
    if (
      !f.Event?.startsWith("REVIEW_") ||
      !SEGMENT.test(f.Stage ?? "") ||
      !SEGMENT.test(f.Unit ?? "")
    )
      continue;
    const key = reviewCellKey(f.Unit as string, f.Stage as string);
    const modern =
      f["Request Id"] !== undefined ||
      f["Review Record"] !== undefined ||
      f["Review Record Digest"] !== undefined;
    if (!modern) continue;
    if (!cells.has(key)) cells.set(key, null);
    if (f.Event === "REVIEW_REQUESTED") {
      cells.set(key, null);
      completed.delete(key);
      latestRequest.set(key, row);
      if (
        row.valid &&
        REQUEST_ID.test(f["Request Id"] ?? "") &&
        f.Reviewer &&
        /^[1-9][0-9]*$/.test(f.Iteration ?? "")
      )
        pending.set(pairKey(f), row);
    } else if (f.Event === "REVIEW_COMPLETED") {
      const request = pending.get(pairKey(f));
      if (!request || latestRequest.get(key) !== request || !matches(request, row)) continue;
      const candidates = completed.get(key) ?? [];
      candidates.push(f);
      completed.set(key, candidates);
    }
  }
  // Only the latest candidate matters to readiness. Historical JSON need not
  // be reopened on each watch event, and independent current cells read in parallel.
  if (!unavailable)
    await mapBounded([...completed], 4, async ([key, candidates]) => {
      // A malformed/unavailable completion does not consume its request. The
      // first verified completion does; a replay cannot replace its decision.
      for (const fields of candidates) {
        const verdict = await verifiedVerdict(recordDir, fields);
        if (verdict !== null) {
          cells.set(key, verdict);
          break;
        }
      }
    });
  return { cells, unavailable };
}

/** An unpaired modern record must never resurrect a legacy READY appendix. */
export async function hasReviewRecordDirectory(
  recordDir: string,
  unit: string,
  stage: string,
): Promise<boolean> {
  try {
    await lstat(path.join(recordDir, REVIEW_DIRNAME, stage, "units", unit));
    return true;
  } catch (error) {
    return (error as { code?: string }).code !== "ENOENT";
  }
}
