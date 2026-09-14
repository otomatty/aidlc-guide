import { createHash } from "node:crypto";

export function reviewAudit(event: string, fields: Record<string, string>, second = 1): string {
  return `---\n**Event**: ${event}\n**Timestamp**: 2026-09-10T00:00:${String(second).padStart(2, "0")}Z\n${Object.entries(
    fields,
  )
    .map(([name, value]) => `**${name}**: ${value}`)
    .join("\n")}\n`;
}

/** The v2.8.2 writer's JSON and receipt fields, including the record-relative path. */
export function reviewFixture(
  options: {
    unit?: string | null;
    stage?: string;
    attempt?: string;
    iteration?: number;
    id?: string;
    verdict?: "READY" | "NOT-READY";
    second?: number;
    fingerprint?: string;
    sourceFingerprint?: string;
    unitSourceFingerprint?: string;
  } = {},
) {
  const unit = options.unit === undefined ? "unit-alpha" : options.unit;
  const stage = options.stage ?? "functional-design";
  const attempt = options.attempt ?? "a".repeat(16);
  const iteration = options.iteration ?? 1;
  const requestId = `review:${(options.id ?? "a").repeat(32)}`;
  const fingerprint = options.fingerprint ?? `sha256:${"a".repeat(64)}`;
  const verdict = options.verdict ?? "READY";
  const relative = `.aidlc-reviews/${stage}/${unit ? `units/${unit}` : "stage"}/${attempt}/${iteration}.json`;
  const record = {
    version: 1,
    stage,
    unit,
    workflow: null,
    attempt,
    iteration,
    reviewer: "architecture-reviewer",
    verdict,
    request_id: requestId,
    request_challenge: null,
    artifact_fingerprint: fingerprint,
    source_fingerprint: options.sourceFingerprint ?? null,
    unit_source_fingerprint: options.unitSourceFingerprint ?? null,
    findings: [
      {
        id: "R-01",
        severity: "Low",
        location: "design.md",
        finding: "A finding",
        required_action: "Clarify",
        status: "Resolved",
      },
    ],
    body: "## Review\n",
    recorded_at: "2026-09-10T00:00:02Z",
  };
  const bytes = `${JSON.stringify(record, null, 2)}\n`;
  const fields = {
    Stage: stage,
    ...(unit ? { Unit: unit } : {}),
    Reviewer: record.reviewer,
    Iteration: String(iteration),
    "Request Id": requestId,
    "Artifact Fingerprint": fingerprint,
    ...(options.sourceFingerprint === undefined
      ? {}
      : { "Source Fingerprint": options.sourceFingerprint }),
    ...(options.unitSourceFingerprint === undefined
      ? {}
      : { "Unit Source Fingerprint": options.unitSourceFingerprint }),
  };
  const completionFields = {
    ...fields,
    Verdict: verdict,
    "Request Fingerprint": fingerprint,
    ...(options.sourceFingerprint === undefined
      ? {}
      : { "Request Source Fingerprint": options.sourceFingerprint }),
    "Review Record": relative,
    "Review Record Digest": `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  };
  return {
    relative,
    bytes,
    record,
    fields,
    completionFields,
    request: reviewAudit("REVIEW_REQUESTED", fields, options.second ?? 1),
    completion: reviewAudit("REVIEW_COMPLETED", completionFields, (options.second ?? 1) + 1),
  };
}
