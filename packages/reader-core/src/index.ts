import type {
  AuditEvent,
  IntentList,
  Matrix,
  NextStep,
  ReadResult,
  StageInfo,
  WatchEvent,
  WorkflowModel,
} from "@aidlc-guide/shared-types";
import { readAuditEvents } from "./audit/events.ts";
import { resolveIntents, resolveRecordDir } from "./intents/resolve.ts";
import { readState } from "./parse/state.ts";
import { buildMatrix } from "./tree/matrix.ts";
import { guardPath } from "./util/guard-path.ts";
import { readBounded } from "./util/read-bounded.ts";
import { withResult } from "./util/with-result.ts";
import { type WatchOptions, watch } from "./watch/watcher.ts";

export { readAuditEvents } from "./audit/events.ts";
export {
  DEFAULT_SPACE,
  electActive,
  intentsDirOf,
  resolveIntents,
  resolveRecordDir,
} from "./intents/resolve.ts";
export { parseState, readState, STATE_FILENAME, SUPPORTED_STATE_VERSION } from "./parse/state.ts";
export { buildMatrix, buildMatrixForUnit, CONSTRUCTION_DIRNAME } from "./tree/matrix.ts";
/** Re-exported for the dashboard-server AnswerWriter path gate (S-RC-2 consumer contract). */
export { guardPath } from "./util/guard-path.ts";
export type { BoundedRead, BoundedReason } from "./util/read-bounded.ts";
export { MAX_READ_BYTES, readBounded, readTail } from "./util/read-bounded.ts";
export { withResult } from "./util/with-result.ts";
export {
  classifyScope,
  createChangeQueue,
  DEFAULT_DEBOUNCE_MS,
  type Scope,
  type WatchOptions,
  watch,
} from "./watch/watcher.ts";

/** The seven public methods (component-methods.md). Every one returns ReadResult. */
export interface Reader {
  getWorkflow(): Promise<ReadResult<WorkflowModel>>;
  getMatrix(): Promise<ReadResult<Matrix>>;
  getAuditEvents(limit: number): Promise<ReadResult<AuditEvent[]>>;
  getIntents(): Promise<ReadResult<IntentList>>;
  getNextStep(): Promise<ReadResult<NextStep>>;
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
        if (!("ok" in state)) return state;
        const { stages, currentStage } = state.value;
        const from = stages.findIndex((s) => s.slug === currentStage);
        const next = stages
          .slice(from + 1)
          .find(
            (s) => s.execution === "EXECUTE" && s.status !== "completed" && s.status !== "skipped",
          );
        return {
          ok: true,
          value: { nextStage: next?.slug ?? null, requirement: requirementFor(next) },
        };
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
