import {
  type Matrix,
  type NextStep,
  type ReadResult,
  type StandardReason,
  supportedVersionsLabel,
  type WorkflowModel,
  type WorkflowPayload,
} from "@aidlc-guide/shared-types";
import type { ViewState } from "./state.ts";

/**
 * The single payload→ViewState funnel (R-UI-2). Every degradation the server
 * reports — `unsupported`, `error`, `warnings`, field-level `unparseable`,
 * cell-level `error` — has to come out the other side as something the UI
 * renders. There is deliberately no code path that drops one.
 */

/** The server vocabulary plus the two reasons this client mints itself. */
type UiReason = StandardReason | "server-unreachable" | "unexpected-response";

/**
 * `Record<UiReason, string>` on purpose: adding a reason to `StandardReason`
 * fails this compile until the UI has a wording for it (no silent fallback).
 */
const REASON_TEXT: Readonly<Record<UiReason, string>> = {
  "state-missing":
    "インテントはありますが状態ファイル (aidlc-state.md) がまだありません。Claude Code の /aidlc が最初のステージで作成します",
  "state-unreadable": "状態ファイルを読み取れません",
  "no-active-intent": "アクティブなインテントがありません",
  "no-selected-intent": "インテントを選んでください",
  "outside-record": "レコード外のパスは読み取れません",
  "artifact-not-found": "成果物が見つかりません",
  "file-too-large": "ファイルが大きすぎます",
  "not-found": "見つかりません",
  "undefined-term": "用語集に定義がありません",
  "config-invalid": "aidlc-guide.config.json を読み込めません（JSON 構文を確認してください）",
  "unknown-route": "サーバが知らない API パスです（クライアントとサーバの版ずれの可能性）",
  "missing-path": "パスが指定されていません",
  "server-unreachable": "サーバに接続できません（dashboard を起動してください）",
  "unexpected-response": "サーバの応答を解釈できません",
};

/** `error` reasons that mean "nothing to show yet", not "something broke". */
const EMPTY_REASONS: ReadonlySet<string> = new Set([
  "no-active-intent",
  "no-selected-intent",
  "state-missing",
]);

export function reasonText(reason: string): string {
  return (REASON_TEXT as Readonly<Record<string, string>>)[reason] ?? `解析できません（${reason}）`;
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
      detail: `State Version ${result.version} は未対応です（このツールは Version ${supportedVersionsLabel()} を解析します）`,
    };
  }
  if ("error" in result) {
    return EMPTY_REASONS.has(result.reason)
      ? { kind: "empty", hint: reasonText(result.reason), reason: result.reason }
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
