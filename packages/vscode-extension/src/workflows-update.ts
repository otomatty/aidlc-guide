import { WORKFLOWS_TARGET_VERSION } from "@aidlc-guide/shared-types";
import { formatDoctorDetailsForLog } from "./doctor-output.ts";
import { detectHarnesses } from "./harness-detect.ts";
import { readNativeInstall, runNativeDoctor } from "./native-setup.ts";
import { inspectWorkflowsManagement } from "./workflows-management.ts";
import {
  applyNativeWorkflowsUpdate,
  type NativeWorkflowsUpdateResult,
  type WorkflowsToolUpdateResult,
} from "./workflows-native-update.ts";
import { acquireWorkflowsOperation } from "./workflows-operation.ts";

/** Application boundary: the caller cannot choose a version or omit installed tools. */
export async function updateInstalledWorkflows(opts: {
  workspaceRoot: string;
  log: (line: string) => void;
  isCurrent: () => boolean;
  canRestore: () => boolean;
  needsRepair: boolean;
  setNeedsRepair: (value: boolean) => Promise<void>;
  onHarnessResult: (result: WorkflowsToolUpdateResult) => void;
}): Promise<NativeWorkflowsUpdateResult> {
  const target = WORKFLOWS_TARGET_VERSION;
  const release = acquireWorkflowsOperation(opts.workspaceRoot);
  if (!release) {
    opts.log("このフォルダのインストールまたは更新は実行中です。");
    return { ok: false, target, reason: "busy" };
  }
  try {
    if (!opts.isCurrent()) return { ok: false, target, reason: "cancelled" };
    const state = inspectWorkflowsManagement(opts.workspaceRoot, opts.needsRepair);
    if (!state.canUpdate) {
      opts.log(state.message);
      return { ok: state.status === "current", target, reason: state.status };
    }
    const detected = detectHarnesses(opts.workspaceRoot).harnesses.map((tool) => tool.id);
    await opts.setNeedsRepair(true);
    const result = await applyNativeWorkflowsUpdate({
      ...opts,
      pin: target,
      selected: detected,
      detected,
    });
    if (!opts.isCurrent()) return { ok: false, target, reason: "cancelled" };
    if (!result.ok) return result;
    const after = inspectWorkflowsManagement(opts.workspaceRoot);
    if (
      after.status !== "current" ||
      after.projectPin !== target ||
      after.tools.length !== detected.length ||
      detected.some((id) => !after.tools.some((tool) => tool.id === id))
    ) {
      opts.log("更新後のバージョンが揃っていません。状態を確認して再実行してください。");
      return { ok: false, target, reason: "verification" };
    }
    const runtime = readNativeInstall(opts.workspaceRoot);
    if (!runtime || runtime.version !== target)
      return { ok: false, target, reason: "runtime-verification" };
    // Earlier tool diagnostics may observe later tools before they have been updated.
    const doctor = await runNativeDoctor(runtime, opts.workspaceRoot, undefined, {
      isCurrent: opts.isCurrent,
    });
    opts.log(formatDoctorDetailsForLog(doctor));
    const healthy = doctor.outcome === "ok" || doctor.outcome === "warning";
    for (const id of detected)
      opts.onHarnessResult({
        id,
        status: healthy ? "completed" : "failed",
        message: healthy ? "更新完了" : "最終診断に失敗しました。詳細を確認してください。",
      });
    if (!healthy) return { ok: false, target, reason: "doctor" };
    await opts.setNeedsRepair(false);
    return result;
  } catch (cause) {
    opts.log(cause instanceof Error ? cause.message : String(cause));
    return { ok: false, target, reason: "update-failed" };
  } finally {
    release();
  }
}
