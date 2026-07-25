import type { Matrix, NextStep, ReadResult, WorkflowModel } from "@aidlc-guide/shared-types";
import type { ViewState, WorkflowPayload } from "./state.ts";

/**
 * The single payload→ViewState funnel (R-UI-2). Every degradation the server
 * reports — `unsupported`, `error`, `warnings`, field-level `unparseable`,
 * cell-level `error` — has to come out the other side as something the UI
 * renders. There is deliberately no code path that drops one.
 */

/** Reason strings the UI is allowed to branch on, plus our own transport one. */
const REASON_TEXT: Readonly<Record<string, string>> = {
  "state-missing": "状態ファイル (aidlc-state.md) が見つかりません",
  "state-unreadable": "状態ファイルを読み取れません",
  "no-active-intent": "アクティブなインテントがありません",
  "outside-record": "レコード外のパスは読み取れません",
  "artifact-not-found": "成果物が見つかりません",
  "file-too-large": "ファイルが大きすぎます",
  "server-unreachable": "サーバに接続できません（dashboard を起動してください）",
};

/** `error` reason that means "nothing to show yet", not "something broke". */
const EMPTY_REASON = "no-active-intent";

export function reasonText(reason: string): string {
  return REASON_TEXT[reason] ?? `解析できません（${reason}）`;
}

/**
 * @param degrade extracts value-level degradation notes; returning a non-empty
 *   array downgrades `success` to `partial` so the notes get rendered.
 */
export function deriveViewState<T>(
  result: ReadResult<T>,
  degrade?: (value: T) => string[],
): ViewState<T> {
  if ("unsupported" in result) {
    return {
      kind: "error",
      detail: `State Version ${result.version} は未対応です（このツールは Version 7 のみ解析します）`,
    };
  }
  if ("error" in result) {
    return result.reason === EMPTY_REASON
      ? { kind: "empty", hint: reasonText(EMPTY_REASON) }
      : { kind: "error", detail: reasonText(result.reason) };
  }

  const notes = [...(result.warnings ?? []), ...(degrade?.(result.value) ?? [])];
  return notes.length === 0
    ? { kind: "success", value: result.value }
    : { kind: "partial", value: result.value, notes };
}

/** Field- and stage-level degradation carried inside a WorkflowModel. */
export function workflowNotes(workflow: WorkflowModel): string[] {
  const notes = Object.entries(workflow.unparseable ?? {}).map(
    ([field, detail]) => `${field}: ${detail}`,
  );
  for (const stage of workflow.stages) {
    if (stage.unparseable !== undefined) notes.push(`${stage.slug}: ${stage.unparseable}`);
  }
  return notes;
}

/** Cell-level degradation carried inside a Matrix (failure mode 4). */
export function matrixNotes(matrix: Matrix): string[] {
  return matrix.cells
    .filter((cell) => cell.error !== undefined)
    .map((cell) => `${cell.unit} / ${cell.stage}: ${cell.error}`);
}

/**
 * `/api/workflow` answers with one body for two slices, so both are derived
 * from the same result — a warning on the state file degrades both.
 */
export function deriveWorkflow(result: ReadResult<WorkflowPayload>): {
  workflow: ViewState<WorkflowModel>;
  nextStep: ViewState<NextStep>;
  /**
   * `null` = **unknown**, not `false`. A failed read says nothing about the
   * server's mode, and answering `false` would drop the ReadOnlyBadge and put
   * the edit DOM back in front of participants on nothing worse than a
   * transport blip (mob-mode S-MM-5 / 受入条件). Only a successful
   * `/api/workflow` may change `hostMode`; the caller keeps the last known.
   */
  hostMode: boolean | null;
} {
  const workflow = deriveViewState(
    unwrap(result, (p) => p.workflow),
    workflowNotes,
  );
  const nextStep = deriveViewState(unwrap(result, (p) => p.nextStep));
  return {
    workflow,
    nextStep,
    hostMode: "ok" in result ? result.value.serverMode.hostMode : null,
  };
}

/** Narrow a ReadResult onto one field of its value, keeping warnings intact. */
function unwrap<T, U>(result: ReadResult<T>, pick: (value: T) => U): ReadResult<U> {
  if (!("ok" in result)) return result;
  return result.warnings === undefined
    ? { ok: true, value: pick(result.value) }
    : { ok: true, value: pick(result.value), warnings: result.warnings };
}
