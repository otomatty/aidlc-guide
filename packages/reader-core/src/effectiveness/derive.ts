import type {
  EffectivenessApprovalWait,
  EffectivenessReviews,
  EffectivenessSensors,
  IntentEffectiveness,
} from "@aidlc-guide/shared-types";
import type { MeasurementEvent } from "./events.ts";

type Interval = [number, number];
export function unionDuration(intervals: Interval[]): number {
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let end = -Infinity;
  for (const [start, stop] of intervals) {
    total += Math.max(0, stop - Math.max(start, end));
    end = Math.max(end, stop);
  }
  return total;
}

function stageOf(e: MeasurementEvent): string | undefined {
  return e.fields.Stage ?? e.fields["Stage slug"];
}
function scopeKey(e: MeasurementEvent): string {
  return JSON.stringify([
    stageOf(e) ?? e.fields["Gate Stages"] ?? "",
    e.fields.Unit ?? "",
    e.fields["Attempt Generation"] ?? "",
    e.fields["Gate Scope"] ?? "",
  ]);
}
function stageUnitKey(stage: string, unit: string): string {
  return JSON.stringify([stage, unit]);
}
function ordered(a: MeasurementEvent, b: MeasurementEvent): boolean {
  return b.time > a.time || (b.time === a.time && a.shard === b.shard && b.position > a.position);
}

export function deriveEffectiveness(
  events: readonly MeasurementEvent[],
  now: number,
): Pick<
  IntentEffectiveness,
  | "startedAt"
  | "completedAt"
  | "completionMs"
  | "elapsedMs"
  | "auditEventCount"
  | "approvalWait"
  | "rejections"
  | "revisions"
  | "humanTurns"
  | "reviews"
  | "sensors"
  | "warnings"
> {
  const warnings: string[] = [];
  const starts = events.filter((e) => e.event === "WORKFLOW_STARTED");
  const start = starts[0];
  const latestStart = starts.at(-1);
  const completion = events
    .filter((e) => e.event === "WORKFLOW_COMPLETED" && (!latestStart || ordered(latestStart, e)))
    .at(-1);
  if (starts.length > 1)
    warnings.push("multiple workflow starts: elapsed time spans the intent history");
  if (events.some((e) => e.time > now))
    warnings.push("audit timestamps are ahead of the measurement clock");
  const duration = (end: number): number | null =>
    start && end >= start.time ? end - start.time : null;

  const waits = new Map<string, MeasurementEvent>();
  const closed: Interval[] = [];
  const pending: Interval[] = [];
  let excludedIntervals = 0;
  let hasGate = false;
  let rejections = 0;
  let revisions = 0;
  let humanTurns = 0;
  const review: EffectivenessReviews = {
    completed: 0,
    ready: 0,
    notReady: 0,
    firstPassReady: 0,
    firstPassTotal: 0,
    firstPassRate: null,
    unmatched: 0,
  };
  const reviewRequests = new Map<string, MeasurementEvent>();
  const reviewTerminals = new Set<string>();
  const epochs = new Map<string, number>();
  const unitEpochs = new Map<string, number>();
  let globalEpoch = 0;
  const firstReviews = new Set<string>();
  const sensor: EffectivenessSensors = {
    scope: "intent-record",
    verifiedPassed: 0,
    failed: 0,
    skipped: 0,
    incomplete: 0,
    findings: 0,
  };
  const firings = new Map<string, MeasurementEvent>();
  const sensorTerminals = new Set<string>();
  let hasReview = false;
  let hasSensor = false;

  for (const e of events) {
    const key = scopeKey(e);
    const stage = stageOf(e);
    if (e.event === "WORKFLOW_STARTED" || e.event === "STAGE_JUMPED") {
      excludedIntervals += waits.size;
      waits.clear();
      review.unmatched += reviewRequests.size;
      reviewRequests.clear();
      globalEpoch++;
    }
    if (e.event === "BOLT_STARTED") {
      for (const unit of (e.fields["Bolt names"] ?? e.fields["Bolt slug"] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        unitEpochs.set(unit, (unitEpochs.get(unit) ?? 0) + 1);
        for (const [waitKey, opened] of waits)
          if (opened.fields.Unit === unit) {
            waits.delete(waitKey);
            excludedIntervals++;
          }
      }
    }
    if (["STAGE_STARTED", "GATE_REJECTED"].includes(e.event)) {
      const resetStages = e.fields["Gate Stages"]
        ? e.fields["Gate Stages"]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : stage
          ? [stage]
          : [];
      for (const resetStage of resetStages) {
        const attemptKey = stageUnitKey(resetStage, e.fields.Unit ?? "");
        epochs.set(attemptKey, (epochs.get(attemptKey) ?? 0) + 1);
      }
      if (e.event !== "GATE_REJECTED" && waits.has(key)) {
        excludedIntervals++;
        waits.delete(key);
      }
    }
    if (e.event === "STAGE_AWAITING_APPROVAL") {
      hasGate = true;
      if ((!stage && !e.fields["Gate Stages"]) || e.fields.Recovered === "true") {
        excludedIntervals++;
        continue;
      }
      if (e.fields.Revalidated === "true") continue;
      if (waits.has(key)) {
        warnings.push("duplicate gate opening ignored");
        continue;
      }
      waits.set(key, e);
    }
    if (e.event === "GATE_APPROVED" || e.event === "GATE_REJECTED") {
      hasGate = true;
      if (e.event === "GATE_REJECTED") rejections++;
      const opened = waits.get(key);
      if (opened && e.fields.Recovered !== "true" && ordered(opened, e))
        closed.push([opened.time, e.time]);
      else excludedIntervals++;
      waits.delete(key);
    }
    if (e.event === "STAGE_REVISING") revisions++;
    if (e.event === "STAGE_SKIPPED" && waits.has(key)) {
      excludedIntervals++;
      waits.delete(key);
    }
    if (e.event === "HUMAN_TURN") humanTurns++;
    if (e.event === "REVIEW_REQUESTED" || e.event === "REVIEW_COMPLETED") {
      hasReview = true;
      const iteration = Number(e.fields.Iteration);
      if (!stage || !e.fields.Reviewer || !Number.isInteger(iteration) || iteration < 1) {
        review.unmatched++;
        continue;
      }
      const unit = e.fields.Unit ?? "";
      const reviewScope = JSON.stringify([
        globalEpoch,
        stage,
        unit,
        e.fields["Attempt Generation"] ?? "",
        epochs.get(stageUnitKey(stage, unit)) ?? 0,
        unitEpochs.get(unit) ?? 0,
        e.fields.Reviewer,
      ]);
      const reviewKey = JSON.stringify([reviewScope, iteration]);
      if (e.event === "REVIEW_REQUESTED") {
        if (!reviewRequests.has(reviewKey)) reviewRequests.set(reviewKey, e);
      } else {
        if (reviewTerminals.has(reviewKey)) {
          warnings.push("duplicate review completion ignored");
          continue;
        }
        const request = reviewRequests.get(reviewKey);
        const verdict = e.fields.Verdict;
        if (
          !request ||
          !ordered(request, e) ||
          (verdict !== "READY" && verdict !== "NOT-READY") ||
          (request.fields["Artifact Fingerprint"] &&
            request.fields["Artifact Fingerprint"] !== e.fields["Request Fingerprint"])
        ) {
          review.unmatched++;
          continue;
        }
        reviewRequests.delete(reviewKey);
        reviewTerminals.add(reviewKey);
        review.completed++;
        if (verdict === "READY") review.ready++;
        else review.notReady++;
        if (iteration === 1 && !firstReviews.has(reviewScope)) {
          firstReviews.add(reviewScope);
          review.firstPassTotal++;
          if (verdict === "READY") review.firstPassReady++;
        }
      }
    }
    if (e.event.startsWith("SENSOR_")) {
      if (
        !["SENSOR_FIRED", "SENSOR_PASSED", "SENSOR_FAILED", "SENSOR_BUDGET_OVERRIDE"].includes(
          e.event,
        )
      )
        continue;
      const fire = e.fields["Fire id"];
      if (!fire || !e.fields["Sensor ID"] || !stage) {
        warnings.push("sensor receipt missing correlation fields");
        continue;
      }
      const sensorKey = JSON.stringify([fire, e.fields["Sensor ID"], stage]);
      if (e.event === "SENSOR_FIRED") {
        hasSensor = true;
        if (firings.has(sensorKey) || sensorTerminals.has(sensorKey))
          warnings.push("duplicate sensor firing ignored");
        else firings.set(sensorKey, e);
      } else {
        const fired = firings.get(sensorKey);
        if (!fired || !ordered(fired, e) || sensorTerminals.has(sensorKey)) {
          warnings.push("unmatched sensor terminal ignored");
          continue;
        }
        sensorTerminals.add(sensorKey);
        firings.delete(sensorKey);
        if (e.event === "SENSOR_PASSED" && !e.fields.Note) sensor.verifiedPassed++;
        else if (e.event === "SENSOR_FAILED") {
          sensor.failed++;
          const count = Number(e.fields["Findings count"]);
          if (Number.isSafeInteger(count) && count >= 0) sensor.findings += count;
          else warnings.push("sensor findings count unavailable");
        } else sensor.skipped++;
      }
    }
  }
  for (const opened of waits.values()) {
    if (completion || now < opened.time) excludedIntervals++;
    else pending.push([opened.time, now]);
  }
  if (excludedIntervals)
    warnings.push("some approval intervals lack a trustworthy opening/resolution pair");
  review.unmatched += reviewRequests.size;
  if (review.firstPassTotal) review.firstPassRate = review.firstPassReady / review.firstPassTotal;
  sensor.incomplete = firings.size;
  const approvalWait: EffectivenessApprovalWait = {
    completedMs: closed.length ? unionDuration(closed) : null,
    pendingMs: pending.length ? unionDuration(pending) : null,
    completedIntervals: closed.length,
    pendingIntervals: pending.length,
    excludedIntervals,
  };
  return {
    startedAt: start?.timestamp ?? null,
    completedAt: completion?.timestamp ?? null,
    completionMs: completion ? duration(completion.time) : null,
    elapsedMs: duration(completion?.time ?? now),
    auditEventCount: events.length,
    approvalWait: hasGate ? approvalWait : null,
    rejections: hasGate ? rejections : null,
    revisions: hasGate || revisions ? revisions : null,
    humanTurns: humanTurns || null,
    reviews: hasReview ? review : null,
    sensors: hasSensor ? sensor : null,
    warnings: [...new Set(warnings)],
  };
}
