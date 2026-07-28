import { guardPath, readBounded, withResult } from "@aidlc-guide/core-utils";
import type {
  AuditEvent,
  IntentList,
  Matrix,
  NextStep,
  ReadResult,
  StageInfo,
  TimingsPayload,
  WatchEvent,
  WorkflowModel,
} from "@aidlc-guide/shared-types";
import { readAuditEvents } from "./audit/events.ts";
import { resolveIntents, resolveRecordDir } from "./intents/resolve.ts";
import { readState } from "./parse/state.ts";
import { estimateRemaining } from "./timing/estimate.ts";
import { getStageTimingSamples, getStageTimings } from "./timing/read.ts";
import { resolveStageViews } from "./timing/stage-view.ts";
import { buildMatrix } from "./tree/matrix.ts";
import { type WatchOptions, watch } from "./watch/watcher.ts";

/** Re-exported from core-utils so existing consumers keep one import site (S-RC-2 consumer contract). */
export type { BoundedRead, BoundedReason } from "@aidlc-guide/core-utils";
export {
  guardPath,
  MAX_READ_BYTES,
  readBounded,
  readTail,
  withResult,
} from "@aidlc-guide/core-utils";
export { readAllAuditEvents, readAuditEvents } from "./audit/events.ts";
export {
  DEFAULT_SPACE,
  electActive,
  intentsDirOf,
  resolveIntents,
  resolveRecordDir,
} from "./intents/resolve.ts";
export { parseState, readState, STATE_FILENAME, SUPPORTED_STATE_VERSION } from "./parse/state.ts";
export { deriveStageTimings, IDLE_THRESHOLD_MS } from "./timing/derive.ts";
export { createStageEstimator, estimateRemaining } from "./timing/estimate.ts";
export { getStageTimingSamples, getStageTimings } from "./timing/read.ts";
export { resolveStageViews } from "./timing/stage-view.ts";
export { buildMatrix, buildMatrixForUnit, CONSTRUCTION_DIRNAME } from "./tree/matrix.ts";
export {
  classifyScope,
  createChangeQueue,
  DEFAULT_DEBOUNCE_MS,
  type Scope,
  type WatchOptions,
  watch,
} from "./watch/watcher.ts";

/** The eight public methods (component-methods.md). Every one returns ReadResult. */
export interface Reader {
  getWorkflow(): Promise<ReadResult<WorkflowModel>>;
  getMatrix(): Promise<ReadResult<Matrix>>;
  getAuditEvents(limit: number): Promise<ReadResult<AuditEvent[]>>;
  getIntents(): Promise<ReadResult<IntentList>>;
  getNextStep(): Promise<ReadResult<NextStep>>;
  /** `now` is injectable so tests measure an open run deterministically. */
  getTimings(now?: number): Promise<ReadResult<TimingsPayload>>;
  readArtifact(relPath: string): Promise<ReadResult<string>>;
  watch(onChange: (event: WatchEvent) => void, options?: WatchOptions): () => void;
}

export interface ReaderOptions {
  /**
   * Record directory override. Without it the reader re-resolves the active
   * intent on every call, which is what makes an intent switch visible to the
   * next read (L7) — do not add caching here.
   */
  recordDir?: string;
}

/**
 * Pure next-step derivation over an already-read {@link WorkflowModel}.
 * Exported so callers that hold a workflow (the `/api/workflow` handler, the
 * hub's state push) derive the next step from that one read instead of paying
 * a second cursor-resolve + state parse via {@link Reader.getNextStep} — both
 * sit on the ≤3s first-paint / ≤2s change-reflect critical paths.
 */
export function nextStepOf(model: WorkflowModel): NextStep {
  const from = model.stages.findIndex((s) => s.slug === model.currentStage);
  const next = model.stages
    .slice(from + 1)
    .find((s) => s.execution === "EXECUTE" && s.status !== "completed" && s.status !== "skipped");
  return { nextStage: next?.slug ?? null, requirement: requirementFor(next) };
}

/** What the human is asked for at `stage`. */
function requirementFor(stage: StageInfo | undefined): string {
  if (stage === undefined) return "残りの in-scope ステージはありません（ワークフロー完了）";
  switch (stage.status) {
    case "awaiting-approval":
      return `${stage.slug}: 承認ゲートが開いています — 成果物を確認して承認または差し戻しを返してください`;
    case "revising":
      return `${stage.slug}: 差し戻し後の修正中 — 修正内容を確認して再承認してください`;
    case "in-progress":
      return `${stage.slug}: 実行中 — 完了後に承認ゲートで確認を求められます`;
    default:
      return `${stage.slug}: 未着手 — 実行を開始し、完了時に承認ゲートで確認を求められます`;
  }
}

/**
 * L7 facade. Holds no state and touches no filesystem at construction time
 * (P-RC-7), so creating a reader is free and every read sees the current
 * workspace.
 */
export function createReader(rootPath: string, options: ReaderOptions = {}): Reader {
  /** Record-dependent methods share this; `no-active-intent` is failure mode 1. */
  const recordDir = async (): Promise<ReadResult<string>> =>
    options.recordDir === undefined
      ? await resolveRecordDir(rootPath)
      : { ok: true, value: options.recordDir };

  const workflow = async (): Promise<ReadResult<WorkflowModel>> => {
    const record = await recordDir();
    return "ok" in record ? await readState(record.value) : record;
  };

  return {
    getIntents: () => withResult(() => resolveIntents(rootPath)),

    getWorkflow: () => withResult(workflow),

    getMatrix: () =>
      withResult(async () => {
        const record = await recordDir();
        if (!("ok" in record)) return record;
        // L2 receives the CONSTRUCTION slug set from L1 — the version knowledge
        // stays in parse/ (BR-RC-4).
        const state = await readState(record.value);
        if (!("ok" in state)) return state;
        const slugs = state.value.stages
          .filter((s) => s.phase === "CONSTRUCTION")
          .map((s) => s.slug);
        return await buildMatrix(record.value, slugs);
      }),

    getAuditEvents: (limit) =>
      withResult(async () => {
        const record = await recordDir();
        return "ok" in record ? await readAuditEvents(record.value, limit) : record;
      }),

    getNextStep: () =>
      withResult(async () => {
        const state = await workflow();
        return "ok" in state ? { ok: true, value: nextStepOf(state.value) } : state;
      }),

    getTimings: (now = Date.now()) =>
      withResult(async () => {
        const record = await recordDir();
        if (!("ok" in record)) return record;
        const state = await readState(record.value);
        if (!("ok" in state)) return state;

        const timings = await getStageTimings(record.value, now);
        if (!("ok" in timings)) return timings;

        // Two reads in the unpinned case: the active record's own runs for the
        // stage rail, the whole space for the estimate's sample pool. A full
        // audit parse is ~15ms, so sharing one pass is not worth threading an
        // intent id through StageTiming.
        //
        // A pinned recordDir (tests) scopes the pool to that one record, so the
        // second read would be the same read — `null` here rather than reusing
        // the object, so its warnings cannot be merged in twice.
        const samples =
          options.recordDir === undefined ? await getStageTimingSamples(rootPath, now) : null;
        if (samples !== null && !("ok" in samples)) return samples;

        const warnings = [...(timings.warnings ?? []), ...(samples?.warnings ?? [])];
        // One reconciliation, then two readers of it: the roll-up below and
        // every surface downstream (issue #9). `timings.value` is the active
        // record's own runs — what "this stage's current attempt" is measured
        // against — while the sample pool only ever sizes the estimates.
        const stageViews = resolveStageViews(
          state.value,
          timings.value,
          (samples ?? timings).value,
        );
        const value = {
          timings: timings.value,
          stageViews,
          remaining: estimateRemaining(stageViews),
        };
        return warnings.length > 0 ? { ok: true, value, warnings } : { ok: true, value };
      }),

    readArtifact: (relPath) =>
      withResult(async () => {
        const record = await recordDir();
        if (!("ok" in record)) return record;
        // Containment before the size probe: a path outside the record must not
        // even get a stat (nfr-design/logical-components.md dataflow note).
        const guarded = await guardPath(record.value, relPath);
        if (!("ok" in guarded)) return guarded;
        const read = await readBounded(guarded.value);
        if (read.ok) return { ok: true, value: read.value };
        return {
          error: true,
          reason: read.reason === "file-too-large" ? "file-too-large" : "artifact-not-found",
        };
      }),

    watch: (onChange, watchOptions) => {
      if (options.recordDir !== undefined) return watch(options.recordDir, onChange, watchOptions);
      let dispose: (() => void) | null = null;
      let disposed = false;
      void resolveRecordDir(rootPath).then((record) => {
        if (disposed || !("ok" in record)) return;
        dispose = watch(record.value, onChange, watchOptions);
      });
      return () => {
        disposed = true;
        dispose?.();
      };
    },
  };
}
